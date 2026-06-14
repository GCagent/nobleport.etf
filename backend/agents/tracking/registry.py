"""
NoblePort OS — Internal Tracking Mesh

Builds the ten tracking agents from ``config.json`` and provides the runtime
surface: signal dispatch (by source or explicit target), cross-agent rollups
(Subcontractor scorecard, Daily Field report), retention sweeps, and a
config-derived summary for Mission Control.

This mesh is intentionally separate from the DB-backed ``AgentMesh`` in
``orchestrator.py``. These are edge/field telemetry processors whose distilled
outputs feed the heavier execution agents (e.g. GCagent).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from backend.agents.tracking.agents import AGENT_CLASSES
from backend.agents.tracking.base import AgentOutput, Signal, TrackingAgent
from backend.agents.tracking.spec import TrackingSystemConfig, load_config


class TrackingMesh:
    """Holds and routes the ten internal tracking agents."""

    def __init__(self, config: TrackingSystemConfig | None = None) -> None:
        self.config = config or load_config()
        self.agents: dict[str, TrackingAgent] = {}
        for spec in self.config.agents:
            cls = AGENT_CLASSES.get(spec.id)
            if cls is None:
                raise KeyError(f"No implementation registered for agent {spec.id!r}")
            self.agents[spec.id] = cls(spec, self.config.global_settings)

    # -- dispatch ------------------------------------------------------------

    def dispatch(self, signal: Signal) -> list[AgentOutput]:
        """Route a signal to every agent that accepts it, collect outputs."""
        outputs: list[AgentOutput] = []
        for agent in self.agents.values():
            if agent.accepts(signal):
                outputs.extend(agent.process(signal))
        return outputs

    def get(self, agent_id: str) -> TrackingAgent:
        return self.agents[agent_id]

    # -- cross-agent rollups -------------------------------------------------

    def score_subcontractors(
        self,
        telemetry_by_sub: dict[str, dict[str, Any]],
        *,
        project_id: str | None = None,
    ) -> list[AgentOutput]:
        """Run the Subcontractor Agent over per-sub aggregated telemetry."""
        agent = self.agents["agent_subcontractor"]
        outputs: list[AgentOutput] = []
        for sub_id, telemetry in telemetry_by_sub.items():
            signal = Signal(
                source="Schedule Agent (actual vs plan per sub)",
                kind="scorecard",
                payload=telemetry,
                subcontractor_id=sub_id,
                project_id=project_id,
            )
            outputs.extend(agent.process(signal))
        return outputs

    def daily_field_report(
        self,
        days_outputs: list[AgentOutput],
        *,
        weather: dict[str, Any] | None = None,
        photo_count: int = 0,
        project_id: str | None = None,
    ) -> list[AgentOutput]:
        """Roll the day's outputs into the Daily Field Agent's narrative report."""
        agent = self.agents["agent_daily_field"]
        signal = Signal(
            source="All other agent outputs (schedule, cost, quality, safety, etc.)",
            kind="rollup",
            payload={
                "agent_outputs": [o.model_dump(mode="json") for o in days_outputs],
                "weather": weather or {},
                "photo_count": photo_count,
            },
            project_id=project_id,
        )
        return agent.process(signal)

    # -- retention -----------------------------------------------------------

    def sweep_expired(
        self,
        outputs: list[AgentOutput],
        *,
        now: datetime | None = None,
    ) -> tuple[list[AgentOutput], list[AgentOutput]]:
        """Partition outputs into (retained, expired) per each agent's window."""
        ref = now or datetime.now(timezone.utc)
        retained: list[AgentOutput] = []
        expired: list[AgentOutput] = []
        for out in outputs:
            agent = self.agents.get(out.agent_id)
            if agent and agent.is_expired(out, now=ref):
                expired.append(out)
            else:
                retained.append(out)
        return retained, expired

    # -- introspection -------------------------------------------------------

    def summary(self) -> dict[str, Any]:
        """Config-derived overview for Mission Control."""
        triggers: dict[str, int] = defaultdict(int)
        for spec in self.config.agents:
            triggers[spec.parsed_trigger.kind.value] += 1
        return {
            "system": self.config.system,
            "version": self.config.version,
            "agent_count": len(self.agents),
            "triggers": dict(triggers),
            "retention_days": {s.id: s.data_retention_days for s in self.config.agents},
            "alert_channels": self.config.global_settings.alert_channels,
            "edge_processing": self.config.global_settings.edge_processing,
            "digital_twin_integration": self.config.global_settings.digital_twin_integration,
            "agents": [
                {
                    "id": s.id,
                    "name": s.name,
                    "function": s.function,
                    "trigger": s.parsed_trigger.kind.value,
                    "retention_days": s.data_retention_days,
                    "privacy_note": s.privacy_note,
                }
                for s in self.config.agents
            ],
        }


def create_tracking_mesh() -> TrackingMesh:
    """Factory for the tracking mesh singleton."""
    return TrackingMesh()
