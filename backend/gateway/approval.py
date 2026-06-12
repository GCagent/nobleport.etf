"""
MCP Gateway — Human Approval stage.

The gap the uploaded zip flagged ("Human approval gate: Not implemented").
High-risk tool calls (write / money / deploy that the policy marks
human_approval=True) cannot execute on the caller's authority alone — the
gateway opens an approval ticket and refuses execution until a DIFFERENT
authorized human grants it. Separation of duties is enforced: the requester
may not approve their own ticket.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

# Roles permitted to grant approvals.
APPROVER_ROLES: frozenset[str] = frozenset({
    "executive_approver", "financial_approver", "admin",
})


class TicketState(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class ApprovalTicket:
    ticket_id: str
    requester: str
    tool_key: str
    args_digest: str
    state: TicketState = TicketState.PENDING
    decided_by: str | None = None
    decided_at: str | None = None
    reason: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, object]:
        return {
            "ticket_id": self.ticket_id,
            "requester": self.requester,
            "tool_key": self.tool_key,
            "args_digest": self.args_digest,
            "state": self.state.value,
            "decided_by": self.decided_by,
            "decided_at": self.decided_at,
            "reason": self.reason,
            "created_at": self.created_at,
        }


class ApprovalError(Exception):
    pass


class ApprovalQueue:
    """In-memory ticket store. Persistence is a production gate; the
    separation-of-duties rule is what must never change."""

    def __init__(self) -> None:
        self._tickets: dict[str, ApprovalTicket] = {}

    def open(self, requester: str, tool_key: str, args_digest: str) -> ApprovalTicket:
        ticket = ApprovalTicket(
            ticket_id=f"appr_{secrets.token_hex(6)}",
            requester=requester,
            tool_key=tool_key,
            args_digest=args_digest,
        )
        self._tickets[ticket.ticket_id] = ticket
        return ticket

    def get(self, ticket_id: str) -> ApprovalTicket | None:
        return self._tickets.get(ticket_id)

    def decide(
        self,
        ticket_id: str,
        *,
        approver: str,
        approver_roles: frozenset[str],
        approve: bool,
        reason: str | None = None,
    ) -> ApprovalTicket:
        ticket = self._tickets.get(ticket_id)
        if ticket is None:
            raise ApprovalError(f"unknown ticket {ticket_id!r}")
        if ticket.state is not TicketState.PENDING:
            raise ApprovalError(f"ticket already {ticket.state.value}")
        if not (approver_roles & APPROVER_ROLES):
            raise ApprovalError(f"{approver!r} lacks an approver role")
        if approver == ticket.requester:
            raise ApprovalError("separation of duties: requester cannot approve own ticket")
        ticket.state = TicketState.APPROVED if approve else TicketState.REJECTED
        ticket.decided_by = approver
        ticket.decided_at = datetime.now(timezone.utc).isoformat()
        ticket.reason = reason
        return ticket

    def pending(self) -> list[ApprovalTicket]:
        return [t for t in self._tickets.values() if t.state is TicketState.PENDING]

    def all(self) -> list[ApprovalTicket]:
        return list(self._tickets.values())
