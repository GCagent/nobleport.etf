"""
Tests for the Stephanie.ai governance layer.

These assert the spec's hard guarantees: the Authority Matrix is honored, the
gate fails closed on unknown actions, escalation triggers demote LIVE actions,
execution-restricted lanes are blocked, the audit chain is tamper-evident, and
the computed metrics match the decisions actually produced.
"""

from __future__ import annotations

from backend.governance import (
    AUTHORITY_MATRIX,
    CREDENTIAL_REGISTER,
    ActionRequest,
    Lane,
    StephanieGate,
    TruthTag,
    compute_metrics,
    run_baseline,
)
from backend.governance.authority_matrix import (
    BUDGET_ESCALATION_THRESHOLD,
    Disposition,
)
from backend.governance.truth_layer import assert_tagged


def test_authority_matrix_rows_classify_as_documented():
    gate = StephanieGate()
    for rule in AUTHORITY_MATRIX:
        d = gate.classify(ActionRequest(rule.action_type, Lane.SYSTEMS))
        assert d.tag == rule.tag, f"{rule.action_type} expected {rule.tag}, got {d.tag}"
        assert d.disposition == rule.disposition


def test_unknown_action_fails_closed():
    gate = StephanieGate()
    d = gate.classify(ActionRequest("totally_unlisted_action", Lane.SYSTEMS))
    assert d.tag == TruthTag.BLOCKED
    assert d.disposition == Disposition.ESCALATE
    assert d.fail_closed is True
    assert d.in_authority_matrix is False
    assert d.escalated is True


def test_budget_trigger_demotes_live_to_staged():
    gate = StephanieGate()
    # crm_routing is LIVE, but a >$5,000 amount must hold it for human approval.
    d = gate.classify(
        ActionRequest("crm_routing", Lane.REALTY, amount_usd=BUDGET_ESCALATION_THRESHOLD + 1)
    )
    assert d.tag == TruthTag.STAGED
    assert d.escalated is True
    assert any("budget" in r for r in d.escalation_reasons)


def test_under_threshold_live_stays_live():
    gate = StephanieGate()
    d = gate.classify(ActionRequest("crm_routing", Lane.REALTY, amount_usd=100))
    assert d.tag == TruthTag.LIVE
    assert d.escalated is False


def test_execution_restricted_lane_blocks_live_action():
    gate = StephanieGate()
    d = gate.classify(ActionRequest("crm_routing", Lane.KUZO_TRADING))
    assert d.tag == TruthTag.BLOCKED
    assert d.fail_closed is True


def test_regulated_actions_are_blocked():
    gate = StephanieGate()
    for action in ("legal_opinion", "securities_trading", "engineering_certification", "payment_approval"):
        d = gate.classify(ActionRequest(action, Lane.SYSTEMS))
        assert d.tag == TruthTag.BLOCKED
        assert d.requires_human_approval is True


def test_simulated_run_never_goes_live():
    gate = StephanieGate()
    d = gate.classify(ActionRequest("construction_scope_draft", Lane.CONSTRUCTION, simulated=True))
    assert d.tag == TruthTag.SIMULATED


def test_audit_chain_is_tamper_evident():
    gate = StephanieGate()
    gate.process(ActionRequest("crm_routing", Lane.REALTY))
    gate.process(ActionRequest("payment_approval", Lane.CONSTRUCTION))
    assert gate.verify_chain() is True
    # Mutate a record; chain must now fail verification.
    gate.ledger  # snapshot copy
    gate._ledger[0].tag = TruthTag.LIVE  # tamper
    gate._ledger[0].note = "tampered"
    assert gate.verify_chain() is False


def test_metrics_match_decisions():
    gate, metrics = run_baseline()
    assert metrics.total_actions == len(gate.ledger)
    # Tag breakdown must sum to the total.
    assert sum(metrics.by_tag.values()) == metrics.total_actions
    # Every decision is logged with an audit hash → 100% coverage.
    assert metrics.audit_coverage == 1.0
    assert metrics.chain_intact is True
    # Fail-closed and human-in-the-loop guarantees are non-trivial.
    assert metrics.fail_closed_count >= 2
    assert metrics.human_approval_required > 0
    # Autonomous execution must be the minority — humans hold regulated authority.
    assert metrics.autonomous_execution_rate < 0.5


def test_credential_register_claims_nothing():
    # Spec invariant: Stephanie may never claim any professional credential.
    assert len(CREDENTIAL_REGISTER) == 7
    assert all(c.can_claim is False for c in CREDENTIAL_REGISTER)


def test_assert_tagged_fails_closed_on_missing_tag():
    assert assert_tagged("live") == TruthTag.LIVE
    for bad in (None, "", "definitely-live", "yolo"):
        try:
            assert_tagged(bad)
        except ValueError:
            continue
        raise AssertionError(f"assert_tagged should reject {bad!r}")
