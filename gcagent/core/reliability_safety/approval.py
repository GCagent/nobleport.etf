"""Approval gateway adapters for reliability and safety.

Bridges the in-process action gateway to durable human-in-the-loop
checkpoints. Three adapters ship by default:

  - QueueApproval        : in-memory queue for tests and simulation
  - ChainApproval        : on-chain HumanApprovalGateway (contracts/)
  - DelegatedApproval    : route by blast radius / kind to a human role

External integrations register additional adapters via `set_adapter`.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ApprovalRequest:
    action_id: str
    payload: dict[str, Any]
    requested_at: datetime = field(default_factory=_now)
    decision: bool | None = None
    decided_by: str | None = None
    decided_at: datetime | None = None


@dataclass
class QueueApproval:
    """In-memory approval queue. Useful for tests and Stage 1 (Copilot)."""

    pending: deque[ApprovalRequest] = field(default_factory=deque)
    decisions: dict[str, ApprovalRequest] = field(default_factory=dict)
    auto_approve: bool = False

    def __call__(self, action_id: str, payload: dict[str, Any]) -> bool:
        if self.auto_approve:
            self._record(action_id, payload, True, "auto")
            return True
        request = ApprovalRequest(action_id=action_id, payload=dict(payload))
        self.pending.append(request)
        self.decisions[action_id] = request
        return False                     # caller queues; humans decide later

    def resolve(self, action_id: str, approved: bool, approver: str) -> ApprovalRequest:
        if action_id not in self.decisions:
            raise KeyError(f"Unknown approval: {action_id}")
        req = self.decisions[action_id]
        req.decision = approved
        req.decided_by = approver
        req.decided_at = _now()
        return req

    def _record(self, action_id: str, payload: dict[str, Any], approved: bool, by: str) -> None:
        req = ApprovalRequest(
            action_id=action_id,
            payload=dict(payload),
            decision=approved,
            decided_by=by,
            decided_at=_now(),
        )
        self.decisions[action_id] = req


@dataclass
class DelegatedApproval:
    """Route approval requests to role handlers based on action kind."""

    routes: dict[str, Callable[[str, dict[str, Any]], bool]] = field(default_factory=dict)
    fallback: Callable[[str, dict[str, Any]], bool] | None = None

    def route(self, kind: str, handler: Callable[[str, dict[str, Any]], bool]) -> None:
        self.routes[kind] = handler

    def __call__(self, action_id: str, payload: dict[str, Any]) -> bool:
        kind = payload.get("kind", "")
        handler = self.routes.get(kind, self.fallback)
        if handler is None:
            return False
        return handler(action_id, payload)


@dataclass
class ChainApproval:
    """Adapter for the on-chain HumanApprovalGateway contract.

    The actual chain client lives in `backend/integrations/`. This class
    only declares the surface — write a callable that submits an
    approval request and returns whether it has been signed yet.
    """

    submit: Callable[[str, dict[str, Any]], str]   # → tx hash / request id
    is_approved: Callable[[str], bool]
    pending: dict[str, str] = field(default_factory=dict)

    def __call__(self, action_id: str, payload: dict[str, Any]) -> bool:
        if action_id not in self.pending:
            self.pending[action_id] = self.submit(action_id, payload)
        return self.is_approved(self.pending[action_id])


SKILL_ID = "reliability_safety"
LAYER_ID = "architecture"

__all__ = [
    "ApprovalRequest",
    "ChainApproval",
    "DelegatedApproval",
    "QueueApproval",
    "SKILL_ID",
    "LAYER_ID",
]
