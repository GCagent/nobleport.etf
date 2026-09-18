"""Action layer — gated outbound execution.

Agents do not call external systems directly. They emit `ProposedAction`
records, which the `ActionGateway` evaluates against the autonomy
policy and the approval gateway before invoking the matching tool
adapter.

Tool adapters live alongside their integration (`backend/integrations/`)
and register a callable here under a stable `kind` string.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import uuid4

from gcagent.core.agent_architecture.autonomy import (
    ApprovalCallback,
    AutonomyPolicy,
    BlastRadius,
    Decision,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Action records
# ---------------------------------------------------------------------------


@dataclass
class ProposedAction:
    """A side-effect proposed by an agent. Pending policy + approval."""

    kind: str                            # "schedule.update" | "notice.send" | ...
    payload: dict[str, Any]
    blast_radius: BlastRadius
    rationale: str
    proposed_by: str                     # agent id
    cost_usd: float = 0.0
    schedule_shift_days: int = 0
    id: str = field(default_factory=lambda: str(uuid4()))


@dataclass
class ActionOutcome:
    action_id: str
    decision: Decision
    executed: bool
    result: Any = None
    approver: str | None = None
    error: str | None = None
    at: datetime = field(default_factory=_now)


ToolAdapter = Callable[[dict[str, Any]], Any]
"""Adapter that performs the external side effect."""


# ---------------------------------------------------------------------------
# Gateway
# ---------------------------------------------------------------------------


@dataclass
class ActionGateway:
    policy: AutonomyPolicy
    adapters: dict[str, ToolAdapter] = field(default_factory=dict)
    approval: ApprovalCallback | None = None
    pending: list[ProposedAction] = field(default_factory=list)
    history: list[ActionOutcome] = field(default_factory=list)

    def register_tool(self, kind: str, adapter: ToolAdapter) -> None:
        if kind in self.adapters:
            raise ValueError(f"Tool already registered: {kind}")
        self.adapters[kind] = adapter

    def submit(self, action: ProposedAction, *, correlation_id: str = "") -> ActionOutcome:
        decision = self.policy.decide(
            action.blast_radius,
            cost_usd=action.cost_usd,
            schedule_shift_days=action.schedule_shift_days,
        )
        if decision is Decision.REFUSE:
            return self._record(action, decision, executed=False, error="policy_refused")
        if decision is Decision.DRAFT_ONLY:
            self.pending.append(action)
            return self._record(action, decision, executed=False)
        if decision is Decision.REQUIRE_APPROVAL:
            approver_id = self._seek_approval(action, correlation_id)
            if approver_id is None:
                self.pending.append(action)
                return self._record(action, decision, executed=False, error="awaiting_approval")
            return self._execute(action, decision, approver=approver_id)
        return self._execute(action, decision)

    def approve(self, action_id: str, approver: str) -> ActionOutcome:
        """Approve a queued action and execute it."""
        for queued in list(self.pending):
            if queued.id == action_id:
                self.pending.remove(queued)
                decision = self.policy.decide(
                    queued.blast_radius,
                    cost_usd=queued.cost_usd,
                    schedule_shift_days=queued.schedule_shift_days,
                )
                return self._execute(queued, decision, approver=approver)
        raise KeyError(f"No pending action with id {action_id}")

    def _seek_approval(self, action: ProposedAction, correlation_id: str) -> str | None:
        if self.approval is None:
            return None
        approved = self.approval(action.id, {
            "kind": action.kind,
            "rationale": action.rationale,
            "blast_radius": action.blast_radius.value,
            "cost_usd": action.cost_usd,
            "correlation_id": correlation_id,
        })
        return action.proposed_by if approved else None

    def _execute(
        self,
        action: ProposedAction,
        decision: Decision,
        *,
        approver: str | None = None,
    ) -> ActionOutcome:
        adapter = self.adapters.get(action.kind)
        if adapter is None:
            return self._record(
                action, decision, executed=False, error=f"no_adapter:{action.kind}",
                approver=approver,
            )
        try:
            result = adapter(action.payload)
        except Exception as exc:  # noqa: BLE001 — surface to outcome
            return self._record(
                action, decision, executed=False, error=repr(exc), approver=approver,
            )
        return self._record(action, decision, executed=True, result=result, approver=approver)

    def _record(
        self,
        action: ProposedAction,
        decision: Decision,
        *,
        executed: bool,
        result: Any = None,
        approver: str | None = None,
        error: str | None = None,
    ) -> ActionOutcome:
        outcome = ActionOutcome(
            action_id=action.id,
            decision=decision,
            executed=executed,
            result=result,
            approver=approver,
            error=error,
        )
        self.history.append(outcome)
        return outcome


SKILL_ID = "tool_integration"
LAYER_ID = "execution"

__all__ = [
    "ActionGateway",
    "ActionOutcome",
    "ProposedAction",
    "ToolAdapter",
    "SKILL_ID",
    "LAYER_ID",
]
