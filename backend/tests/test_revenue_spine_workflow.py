"""
Tests for the Revenue Spine workflow state machine.

Asserts the directive's hard workflow controls (FieldOps Upgrade §4, §5, §8):

  - transitions are forward-only (no skips, no regression),
  - guard conditions gate Production Ready / billing / closeout,
  - restricted transitions are refused without an authorized human Approval,
  - Stephanie can *recommend* (propose) a restricted transition but not execute,
  - every committed transition appends a tamper-evident, hash-linked record.
"""

from __future__ import annotations

import pytest

from backend.operations.revenue_spine_workflow import (
    GENESIS_HASH,
    REVENUE_STAGE_ORDER,
    Approval,
    RevenueSpineWorkflow,
    RevenueStage,
    TransitionError,
    evaluate_transition,
)


def _approval() -> Approval:
    return Approval(approver="michael", role="owner", reason="reviewed")


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------

def test_forward_only_single_step_allowed():
    d = evaluate_transition(RevenueStage.LEAD, RevenueStage.QUALIFICATION)
    assert d.allowed is True
    assert d.requires_approval is False


def test_skipping_a_stage_is_blocked():
    d = evaluate_transition(RevenueStage.LEAD, RevenueStage.ESTIMATE)
    assert d.allowed is False
    assert any("Out-of-order" in b for b in d.blockers)


def test_regression_is_blocked():
    d = evaluate_transition(RevenueStage.ESTIMATE, RevenueStage.LEAD)
    assert d.allowed is False


# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------

def test_production_ready_requires_verified_deposit():
    # deposit_received -> production_ready is restricted AND guarded.
    blocked = evaluate_transition(
        RevenueStage.DEPOSIT_RECEIVED, RevenueStage.PRODUCTION_READY, {}
    )
    assert blocked.allowed is False
    assert any("Deposit" in b for b in blocked.blockers)

    ok = evaluate_transition(
        RevenueStage.DEPOSIT_RECEIVED,
        RevenueStage.PRODUCTION_READY,
        {"deposit_verified": True},
    )
    assert ok.allowed is True
    assert ok.requires_approval is True  # still restricted


def test_closeout_requires_inspection_and_punchlist():
    d = evaluate_transition(
        RevenueStage.SUBSTANTIAL_COMPLETION,
        RevenueStage.FINAL_INSPECTION_PUNCH,
    )
    assert d.allowed is True  # this hop has no guard

    blocked = evaluate_transition(
        RevenueStage.FINAL_INSPECTION_PUNCH,
        RevenueStage.CLOSEOUT_WARRANTY,
        {"final_inspection_passed": True},  # missing punch_list_complete
    )
    assert blocked.allowed is False
    assert any("punch list" in b.lower() for b in blocked.blockers)


# ---------------------------------------------------------------------------
# Restricted transitions + approval
# ---------------------------------------------------------------------------

def test_restricted_transition_refused_without_approval():
    wf = RevenueSpineWorkflow("proj-1", stage=RevenueStage.CONTRACT_REVIEW)
    with pytest.raises(TransitionError) as exc:
        wf.commit(RevenueStage.CONTRACT_SIGNED, actor="stephanie")
    assert exc.value.decision.requires_approval is True
    assert wf.stage == RevenueStage.CONTRACT_REVIEW  # unchanged


def test_restricted_transition_succeeds_with_approval():
    wf = RevenueSpineWorkflow("proj-1", stage=RevenueStage.CONTRACT_REVIEW)
    rec = wf.commit(
        RevenueStage.CONTRACT_SIGNED,
        actor="stephanie",
        approval=_approval(),
        reason="counter-signed",
    )
    assert wf.stage == RevenueStage.CONTRACT_SIGNED
    assert rec.approval is not None and rec.approval.approver == "michael"


def test_stephanie_can_propose_but_not_execute_restricted():
    wf = RevenueSpineWorkflow("proj-1", stage=RevenueStage.CONTRACT_REVIEW)
    decision = wf.propose(RevenueStage.CONTRACT_SIGNED)
    assert decision.requires_approval is True
    assert decision.allowed is True  # permitted *if* a human approves
    # ...but executing without approval is refused, and proposing changed nothing.
    assert wf.stage == RevenueStage.CONTRACT_REVIEW
    assert wf.ledger == ()


def test_unrestricted_transition_needs_no_approval():
    wf = RevenueSpineWorkflow("proj-1", stage=RevenueStage.LEAD)
    rec = wf.commit(RevenueStage.QUALIFICATION, actor="stephanie")
    assert wf.stage == RevenueStage.QUALIFICATION
    assert rec.approval is None


# ---------------------------------------------------------------------------
# Activity ledger / hash chain
# ---------------------------------------------------------------------------

def test_ledger_is_hash_linked_and_verifiable():
    wf = RevenueSpineWorkflow("proj-1", stage=RevenueStage.LEAD)
    wf.commit(RevenueStage.QUALIFICATION, actor="stephanie")
    wf.commit(RevenueStage.INSPECTION_SCHEDULED, actor="stephanie")

    assert len(wf.ledger) == 2
    assert wf.ledger[0].prev_hash == GENESIS_HASH
    assert wf.ledger[1].prev_hash == wf.ledger[0].event_hash
    assert wf.head_hash == wf.ledger[-1].event_hash
    assert wf.verify_ledger() is True


def test_tampering_breaks_chain_verification():
    wf = RevenueSpineWorkflow("proj-1", stage=RevenueStage.LEAD)
    wf.commit(RevenueStage.QUALIFICATION, actor="stephanie")
    # Mutate a recorded field; the recomputed hash will no longer match.
    object.__setattr__(wf.ledger[0], "actor", "intruder")
    assert wf.verify_ledger() is False


def test_full_happy_path_to_closeout():
    wf = RevenueSpineWorkflow("proj-1", stage=RevenueStage.LEAD)
    ctx = {
        "deposit_verified": True,
        "contract_signed": True,
        "final_inspection_passed": True,
        "punch_list_complete": True,
    }
    approval = _approval()
    # Walk the whole spine in order, approving restricted hops.
    for nxt in REVENUE_STAGE_ORDER[1:]:
        decision = wf.propose(nxt, ctx)
        assert decision.allowed, f"{nxt} blocked: {decision.blockers}"
        wf.commit(
            nxt,
            actor="stephanie",
            context=ctx,
            approval=approval if decision.requires_approval else None,
        )
    assert wf.stage == RevenueStage.CLOSEOUT_WARRANTY
    assert wf.verify_ledger() is True
    assert len(wf.ledger) == len(REVENUE_STAGE_ORDER) - 1
