"""
NoblePort OS — Internal Tracking Agents: Base Runtime

Every internal tracking agent ingests a ``Signal`` (one telemetry/event tick
from the field) and emits zero or more ``AgentOutput`` records. This module
provides the shared contract: signal/output models, severity, retention
enforcement, and the high-cost human-approval gate driven by the config's
``fallback_mode``.

These agents are deliberately I/O-free and deterministic so they can run on
edge hardware and be unit-tested without a database or network.
"""

from __future__ import annotations

import re
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from backend.agents.tracking.spec import GlobalSettings, TrackingAgentSpec


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Severity(StrEnum):
    """Output / alert severity, ascending."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

    @property
    def rank(self) -> int:
        order = [Severity.INFO, Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]
        return order.index(self)


class Signal(BaseModel):
    """A single inbound telemetry/event tick destined for one or more agents."""

    source: str                                   # e.g. "RFID tags on materials/equipment"
    kind: str                                      # agent-defined sub-type, e.g. "scan"
    payload: dict[str, Any] = Field(default_factory=dict)
    project_id: str | None = None
    subcontractor_id: str | None = None
    timestamp: datetime = Field(default_factory=_now)
    target_agent_id: str | None = None             # force-route to one agent


class AgentOutput(BaseModel):
    """A structured result emitted by a tracking agent."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    agent_name: str
    output_type: str                               # maps to a configured output line
    severity: Severity = Severity.INFO
    summary: str
    data: dict[str, Any] = Field(default_factory=dict)
    requires_human_approval: bool = False
    alert: bool = False                            # should this fan out to alert channels?
    project_id: str | None = None
    subcontractor_id: str | None = None
    generated_at: datetime = Field(default_factory=_now)
    retain_until: datetime | None = None


class TrackingAgent(ABC):
    """
    Abstract base for the ten internal tracking agents.

    Concrete agents implement :meth:`_process`. The base handles input-source
    matching, retention stamping, alert/severity bookkeeping, and the
    high-cost human-approval gate.
    """

    # Output types a subclass considers "high cost" and therefore subject to
    # the fallback_mode human-approval gate (e.g. issuing a purchase order).
    HIGH_COST_OUTPUTS: frozenset[str] = frozenset()

    def __init__(self, spec: TrackingAgentSpec, settings: GlobalSettings) -> None:
        self.spec = spec
        self.settings = settings
        self.processed_count = 0
        self.emitted_count = 0

    # -- identity passthrough ------------------------------------------------

    @property
    def id(self) -> str:
        return self.spec.id

    @property
    def name(self) -> str:
        return self.spec.name

    # -- routing -------------------------------------------------------------

    def accepts(self, signal: Signal) -> bool:
        """True if this agent should handle the signal."""
        if signal.target_agent_id:
            return signal.target_agent_id == self.id
        return self._source_matches(signal.source)

    def _source_matches(self, source: str) -> bool:
        """Loose match of a signal source against configured input sources."""
        needle = source.lower().strip()
        for declared in self.spec.input_sources:
            d = declared.lower()
            if needle in d or d in needle:
                return True
            # token overlap fallback (e.g. "rfid scan" vs "RFID tags on materials")
            tokens = {t for t in re.split(r"[^a-z0-9]+", needle) if len(t) > 3}
            if tokens and tokens & set(re.split(r"[^a-z0-9]+", d)):
                return True
        return False

    # -- public entrypoint ---------------------------------------------------

    def process(self, signal: Signal) -> list[AgentOutput]:
        """Run the agent on a signal and finalize its outputs."""
        self.processed_count += 1
        outputs = self._process(signal)
        for out in outputs:
            self._finalize(out, signal)
        self.emitted_count += len(outputs)
        return outputs

    def _finalize(self, out: AgentOutput, signal: Signal) -> None:
        out.agent_id = self.id
        out.agent_name = self.name
        out.project_id = out.project_id or signal.project_id
        out.subcontractor_id = out.subcontractor_id or signal.subcontractor_id
        out.retain_until = out.generated_at + timedelta(days=self.spec.data_retention_days)
        if out.severity.rank >= Severity.HIGH.rank:
            out.alert = True
        if (
            out.output_type in self.HIGH_COST_OUTPUTS
            and self.settings.requires_human_for_high_cost
        ):
            out.requires_human_approval = True

    # -- retention -----------------------------------------------------------

    def is_expired(self, out: AgentOutput, *, now: datetime | None = None) -> bool:
        ref = now or _now()
        return out.retain_until is not None and out.retain_until < ref

    # -- helpers for subclasses ---------------------------------------------

    def _emit(
        self,
        output_type: str,
        summary: str,
        *,
        severity: Severity = Severity.INFO,
        data: dict[str, Any] | None = None,
    ) -> AgentOutput:
        return AgentOutput(
            agent_id=self.id,
            agent_name=self.name,
            output_type=output_type,
            severity=severity,
            summary=summary,
            data=data or {},
        )

    @abstractmethod
    def _process(self, signal: Signal) -> list[AgentOutput]:
        """Domain logic. Return any outputs (alerts, reports, drafts)."""
        ...
