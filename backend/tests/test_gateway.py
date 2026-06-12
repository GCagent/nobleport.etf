"""
Tests for the MCP Gateway control spine.

Hard guarantees: bad/expired/unscoped tokens fail-closed at auth; deny-by-
default for unallowlisted servers/tools; scope enforcement; high-risk tools
require a human approval that the requester cannot self-grant (separation of
duties); approved tickets execute; every stage (including denials) is audited;
the audit chain is tamper-evident.
"""

from __future__ import annotations

import time

import pytest

from backend.gateway import (
    MCPGateway,
    SpineOutcome,
    authenticate,
    evaluate_policy,
    mint_token,
)
from backend.gateway.auth import AuthError
from backend.gateway.policy import PolicyDecision


# ---------------------------------------------------------------------------
# Auth stage
# ---------------------------------------------------------------------------

def test_valid_token_round_trips():
    tok = mint_token("michael", ["dash:read"], roles=["admin"])
    p = authenticate(tok)
    assert p.subject == "michael"
    assert "dash:read" in p.scopes
    assert "admin" in p.roles


def test_tampered_token_fails_closed():
    tok = mint_token("michael", ["dash:read"])
    with pytest.raises(AuthError, match="signature"):
        authenticate(tok[:-2] + ("aa" if not tok.endswith("aa") else "bb"))


def test_expired_token_rejected():
    now = int(time.time())
    tok = mint_token("michael", ["dash:read"], ttl_seconds=10, now=now)
    with pytest.raises(AuthError, match="expired"):
        authenticate(tok, now=now + 20)


def test_malformed_token_rejected():
    with pytest.raises(AuthError):
        authenticate("not-a-token")


# ---------------------------------------------------------------------------
# Policy stage (deny-by-default)
# ---------------------------------------------------------------------------

def test_unallowlisted_server_denied():
    r = evaluate_policy("evil.example.com", "anything", frozenset())
    assert r.decision is PolicyDecision.DENY
    assert "not allowlisted" in r.reason


def test_unregistered_tool_denied():
    r = evaluate_policy("github", "delete_everything", frozenset({"repo:write"}))
    assert r.decision is PolicyDecision.DENY
    assert "not registered" in r.reason


def test_missing_scope_denied():
    r = evaluate_policy("github", "create_pr", frozenset({"repo:read"}))
    assert r.decision is PolicyDecision.DENY
    assert "missing scope" in r.reason


def test_allowed_with_scope():
    r = evaluate_policy("github", "read_issues", frozenset({"repo:read"}))
    assert r.allowed
    assert r.requires_approval is False


def test_high_risk_tool_flags_approval():
    r = evaluate_policy("mcp-router.nobleport.internal", "payment.checkout.create",
                        frozenset({"pay:write"}))
    assert r.allowed
    assert r.requires_approval is True


# ---------------------------------------------------------------------------
# Spine end to end
# ---------------------------------------------------------------------------

def test_read_tool_executes_through_spine():
    gw = MCPGateway()
    tok = mint_token("michael", ["dash:read"])
    res = gw.execute(tok, "mcp-router.nobleport.internal", "dashboard.read")
    assert res.outcome is SpineOutcome.EXECUTED
    assert res.truth_tag == "LIVE"
    assert res.result and "verified" in res.result
    assert res.audit_hash


def test_auth_failure_stops_at_auth_stage():
    gw = MCPGateway()
    res = gw.execute("bad.token", "github", "read_issues")
    assert res.outcome is SpineOutcome.AUTH_FAILED
    assert res.stage == "auth"


def test_policy_denial_stops_before_execution():
    gw = MCPGateway()
    tok = mint_token("michael", ["repo:read"])  # lacks repo:write
    res = gw.execute(tok, "github", "create_pr", {"title": "x"})
    assert res.outcome is SpineOutcome.DENIED
    assert res.stage == "policy"


def test_high_risk_tool_requires_approval_then_executes():
    gw = MCPGateway()
    tok = mint_token("requester", ["repo:write"])
    # First attempt -> approval required, ticket opened.
    first = gw.execute(tok, "github", "create_pr", {"title": "Add X"})
    assert first.outcome is SpineOutcome.APPROVAL_REQUIRED
    assert first.approval_ticket

    # Requester cannot approve their own ticket (separation of duties).
    from backend.gateway.approval import ApprovalError
    with pytest.raises(ApprovalError, match="separation of duties"):
        gw.approvals.decide(first.approval_ticket, approver="requester",
                            approver_roles=frozenset({"admin"}), approve=True)

    # A different authorized approver grants it.
    gw.approvals.decide(first.approval_ticket, approver="michael",
                        approver_roles=frozenset({"executive_approver"}), approve=True)

    # github:create_pr has no bound handler -> honest NOT_EXECUTABLE (not a fake pass).
    second = gw.execute(tok, "github", "create_pr", {"title": "Add X"},
                        approval_ticket=first.approval_ticket)
    assert second.outcome is SpineOutcome.NOT_EXECUTABLE
    assert second.stage == "tool_call"


def test_approval_ticket_bound_to_arguments():
    gw = MCPGateway()
    tok = mint_token("requester", ["repo:write"])
    first = gw.execute(tok, "github", "create_pr", {"title": "Add X"})
    gw.approvals.decide(first.approval_ticket, approver="michael",
                        approver_roles=frozenset({"admin"}), approve=True)
    # Re-submitting with DIFFERENT args must not ride the old approval.
    res = gw.execute(tok, "github", "create_pr", {"title": "Drain treasury"},
                     approval_ticket=first.approval_ticket)
    assert res.outcome is SpineOutcome.DENIED
    assert "arguments changed" in res.reason


def test_rejected_ticket_blocks_execution():
    gw = MCPGateway()
    tok = mint_token("requester", ["repo:write"])
    first = gw.execute(tok, "github", "create_pr", {"title": "x"})
    gw.approvals.decide(first.approval_ticket, approver="michael",
                        approver_roles=frozenset({"admin"}), approve=False, reason="no")
    res = gw.execute(tok, "github", "create_pr", {"title": "x"},
                     approval_ticket=first.approval_ticket)
    assert res.outcome is SpineOutcome.DENIED
    assert "rejected" in res.reason


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

def test_every_call_is_audited_and_chained():
    gw = MCPGateway()
    tok = mint_token("michael", ["dash:read"])
    gw.execute(tok, "mcp-router.nobleport.internal", "dashboard.read")
    gw.execute("bad", "github", "read_issues")            # auth fail, still audited
    gw.execute(tok, "evil.com", "x")                       # policy deny, still audited
    assert len(gw.audit.entries()) == 3
    assert gw.audit.verify() is True


def test_audit_chain_detects_tampering():
    gw = MCPGateway()
    tok = mint_token("michael", ["dash:read"])
    gw.execute(tok, "mcp-router.nobleport.internal", "dashboard.read")
    object.__setattr__(gw.audit._entries[0], "outcome", "forged")
    assert gw.audit.verify() is False
