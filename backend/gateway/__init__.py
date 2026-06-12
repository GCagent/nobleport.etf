"""
NoblePort MCP Gateway — the single source of control.

Every tool call flows through one fail-closed pipeline:

    Auth → Policy → Approval → Tool Call → Audit → Result

Auth verifies a signed token into a scoped Principal; Policy is deny-by-default
over an allowlist; Approval is a human gate with separation of duties for
high-risk lanes; Audit is a hash-chained tamper-evident ledger. This is the
spine the rest of the NoblePort stack hangs off — the executable answer to
"turn the gateway into the single source of control."

Honest gates (same as the uploaded scaffold): real OIDC/JWKS, mTLS, persisted
audit, and on-chain anchoring are production work. The pipeline *semantics* —
sign/verify/expire, deny-by-default, separation-of-duties approval, hash-chain
audit — are built and tested here.
"""

from __future__ import annotations

from backend.gateway.approval import ApprovalQueue, ApprovalTicket, TicketState
from backend.gateway.audit import AuditLog
from backend.gateway.auth import AuthError, Principal, authenticate, mint_token
from backend.gateway.policy import (
    TOOL_REGISTRY,
    PolicyDecision,
    RiskClass,
    ToolPolicy,
    evaluate_policy,
    registry_view,
)
from backend.gateway.spine import (
    TOOL_HANDLERS,
    MCPGateway,
    SpineOutcome,
    SpineResult,
)

__all__ = [
    "ApprovalQueue",
    "ApprovalTicket",
    "TicketState",
    "AuditLog",
    "AuthError",
    "Principal",
    "authenticate",
    "mint_token",
    "TOOL_REGISTRY",
    "PolicyDecision",
    "RiskClass",
    "ToolPolicy",
    "evaluate_policy",
    "registry_view",
    "TOOL_HANDLERS",
    "MCPGateway",
    "SpineOutcome",
    "SpineResult",
]
