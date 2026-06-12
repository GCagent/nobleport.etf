"""
MCP Gateway — The Control Spine.

    Auth → Policy → Approval → Tool Call → Audit → Result

Every tool call flows through this one pipeline. It is fail-closed at every
stage: a bad token, an unallowlisted server/tool, a missing scope, or an
ungranted high-risk approval each stops the call cold, and every stage —
including every denial — is written to the hash-chained audit log. The result
carries a Truth-Layer tag so a caller can never mistake a staged/blocked
outcome for a live one.

A tool handler is a plain callable bound in TOOL_HANDLERS. An allowlisted tool
with no handler returns NOT_EXECUTABLE (honest scaffold), never a silent pass.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from backend.gateway.approval import ApprovalQueue, TicketState
from backend.gateway.audit import AuditLog
from backend.gateway.auth import AuthError, Principal, authenticate
from backend.gateway.policy import evaluate_policy, registry_view
from backend.governance.truth_layer import TruthTag

ToolHandler = Callable[[dict[str, Any]], dict[str, Any]]


class SpineOutcome(str, Enum):
    EXECUTED = "executed"
    DENIED = "denied"
    APPROVAL_REQUIRED = "approval_required"
    NOT_EXECUTABLE = "not_executable"
    AUTH_FAILED = "auth_failed"


@dataclass
class SpineResult:
    outcome: SpineOutcome
    stage: str               # the stage that decided the result
    truth_tag: str
    reason: str
    tool_key: str | None = None
    subject: str | None = None
    approval_ticket: str | None = None
    result: dict[str, Any] | None = None
    audit_hash: str | None = None
    extras: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "outcome": self.outcome.value,
            "stage": self.stage,
            "truth_tag": self.truth_tag,
            "reason": self.reason,
            "tool_key": self.tool_key,
            "subject": self.subject,
            "approval_ticket": self.approval_ticket,
            "result": self.result,
            "audit_hash": self.audit_hash,
            **self.extras,
        }


def _digest(args: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(args, sort_keys=True, default=str).encode()).hexdigest()[:16]


# Bound tool handlers — the only tools the spine can actually run. A read-only
# dashboard tool is wired as a working example; money/deploy lanes intentionally
# have no handler until built (they would also require approval first).
def _dashboard_read(_args: dict[str, Any]) -> dict[str, Any]:
    from backend.systems import build_registry

    reg = build_registry().to_dict()
    return {"verified": reg["summary"]["verified"], "total": reg["summary"]["total_systems"]}


TOOL_HANDLERS: dict[str, ToolHandler] = {
    "mcp-router.nobleport.internal:dashboard.read": _dashboard_read,
}


class MCPGateway:
    """The single source of control. Stateful: holds the approval queue and
    the audit log across calls."""

    def __init__(self) -> None:
        self.approvals = ApprovalQueue()
        self.audit = AuditLog()

    # -- the spine ------------------------------------------------------------

    def execute(
        self,
        token: str,
        server: str,
        tool: str,
        args: dict[str, Any] | None = None,
        *,
        approval_ticket: str | None = None,
        now: int | None = None,
    ) -> SpineResult:
        args = args or {}
        tool_key = f"{server}:{tool}"

        # 1 — AUTH
        try:
            principal = authenticate(token, now=now)
        except AuthError as exc:
            self.audit.record(subject="?", tool_key=tool_key, stage="auth",
                              outcome="auth_failed", reason=str(exc))
            return SpineResult(SpineOutcome.AUTH_FAILED, "auth", TruthTag.BLOCKED.value,
                               str(exc), tool_key=tool_key)

        # 2 — POLICY (deny-by-default)
        policy = evaluate_policy(server, tool, principal.scopes)
        if not policy.allowed:
            e = self.audit.record(subject=principal.subject, tool_key=tool_key, stage="policy",
                                  outcome="denied", reason=policy.reason)
            return SpineResult(SpineOutcome.DENIED, "policy", TruthTag.BLOCKED.value,
                               policy.reason, tool_key=tool_key, subject=principal.subject,
                               audit_hash=e.entry_hash)

        # 3 — APPROVAL (human gate for high-risk tools)
        if policy.requires_approval:
            verdict = self._check_approval(principal, tool_key, args, approval_ticket)
            if verdict is not None:
                return verdict  # pending or rejected — stop here

        # 4 — TOOL CALL
        handler = TOOL_HANDLERS.get(tool_key)
        if handler is None:
            e = self.audit.record(subject=principal.subject, tool_key=tool_key, stage="tool_call",
                                  outcome="not_executable", reason="no handler bound")
            return SpineResult(SpineOutcome.NOT_EXECUTABLE, "tool_call", TruthTag.STAGED.value,
                               "allowlisted but no handler bound — build it before routing work here",
                               tool_key=tool_key, subject=principal.subject, audit_hash=e.entry_hash)
        try:
            output = handler(args)
        except Exception as exc:  # handler failure is audited, never swallowed
            e = self.audit.record(subject=principal.subject, tool_key=tool_key, stage="tool_call",
                                  outcome="error", reason=type(exc).__name__)
            return SpineResult(SpineOutcome.DENIED, "tool_call", TruthTag.BLOCKED.value,
                               f"handler error: {type(exc).__name__}", tool_key=tool_key,
                               subject=principal.subject, audit_hash=e.entry_hash)

        # 5 — AUDIT  6 — RESULT
        e = self.audit.record(subject=principal.subject, tool_key=tool_key, stage="result",
                              outcome="executed", reason=f"risk={policy.policy.risk.value}")
        return SpineResult(SpineOutcome.EXECUTED, "result", TruthTag.LIVE.value,
                           "executed through the control spine", tool_key=tool_key,
                           subject=principal.subject, result=output, audit_hash=e.entry_hash)

    def _check_approval(
        self, principal: Principal, tool_key: str, args: dict[str, Any], approval_ticket: str | None,
    ) -> SpineResult | None:
        """Returns a stop result (pending/rejected), or None to proceed."""
        digest = _digest(args)
        if approval_ticket is None:
            ticket = self.approvals.open(principal.subject, tool_key, digest)
            e = self.audit.record(subject=principal.subject, tool_key=tool_key, stage="approval",
                                  outcome="approval_required", reason=f"ticket {ticket.ticket_id}")
            return SpineResult(SpineOutcome.APPROVAL_REQUIRED, "approval", TruthTag.STAGED.value,
                               "high-risk tool requires human approval", tool_key=tool_key,
                               subject=principal.subject, approval_ticket=ticket.ticket_id,
                               audit_hash=e.entry_hash)
        ticket = self.approvals.get(approval_ticket)
        if ticket is None or ticket.tool_key != tool_key or ticket.args_digest != digest:
            e = self.audit.record(subject=principal.subject, tool_key=tool_key, stage="approval",
                                  outcome="denied", reason="approval ticket invalid or args mismatch")
            return SpineResult(SpineOutcome.DENIED, "approval", TruthTag.BLOCKED.value,
                               "approval ticket invalid or arguments changed since approval",
                               tool_key=tool_key, subject=principal.subject, audit_hash=e.entry_hash)
        if ticket.state is not TicketState.APPROVED:
            e = self.audit.record(subject=principal.subject, tool_key=tool_key, stage="approval",
                                  outcome="denied", reason=f"ticket {ticket.state.value}")
            return SpineResult(SpineOutcome.DENIED, "approval", TruthTag.BLOCKED.value,
                               f"approval ticket is {ticket.state.value}", tool_key=tool_key,
                               subject=principal.subject, approval_ticket=ticket.ticket_id,
                               audit_hash=e.entry_hash)
        return None  # approved — proceed to tool call

    # -- views ----------------------------------------------------------------

    def status(self) -> dict[str, Any]:
        return {
            "spine": "Auth → Policy → Approval → Tool Call → Audit → Result",
            "allowlisted_tools": registry_view(),
            "bound_handlers": sorted(TOOL_HANDLERS),
            "pending_approvals": [t.to_dict() for t in self.approvals.pending()],
            "audit_entries": len(self.audit.entries()),
            "audit_chain_intact": self.audit.verify(),
            "truth_label": "Spine logic is real and tested; OIDC/JWKS, mTLS, persisted audit, and "
                           "on-chain anchoring remain production gates.",
        }
