"""
Tests for the Reflection Engine (backend/learning/reflection.py).

The engine turns verified experience into proposed operational improvements. The
two guarantees that make that safe are pinned here:

  1. **Human-in-the-loop.** The engine proposes; it never applies. Every
     improvement is STAGED and PROPOSED; an unapproved improvement cannot be
     applied (apply_improvement fails closed).
  2. **Evidence-gated.** Only verified evidence drives a change; unverified
     artifacts become knowledge gaps, not standards updates.

The seven memory layers, the closed loop, and the regulated-reviewer mapping are
also covered.
"""

from __future__ import annotations

import pytest

from backend.learning.memory import RecursiveMemoryStore
from backend.learning.reflection import (
    MEMORY_LAYER_PURPOSE,
    REFLECTION_LOOP,
    EvidenceItem,
    EvidenceType,
    ImprovementStatus,
    ImprovementTarget,
    MemoryLayer,
    ReflectionEngine,
    ReflectionSignal,
    ReflectionStage,
    apply_improvement,
    approve_improvement,
    reject_improvement,
)


# ---------------------------------------------------------------------------
# Structure: seven layers, eight-stage loop
# ---------------------------------------------------------------------------

def test_seven_memory_layers_each_have_a_purpose():
    assert len(MemoryLayer) == 7
    assert set(MEMORY_LAYER_PURPOSE) == set(MemoryLayer)
    assert {l.value for l in MemoryLayer} == {
        "episodic", "semantic", "procedural", "financial",
        "governance", "reflection", "strategy",
    }


def test_reflection_loop_is_the_full_ordered_cycle():
    assert REFLECTION_LOOP == (
        ReflectionStage.OBSERVE, ReflectionStage.REMEMBER, ReflectionStage.REASON,
        ReflectionStage.REFLECT, ReflectionStage.IMPROVE, ReflectionStage.TEST,
        ReflectionStage.VALIDATE, ReflectionStage.TEACH,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _engine() -> ReflectionEngine:
    return ReflectionEngine(store=RecursiveMemoryStore())


def _verified_payment_signal() -> ReflectionSignal:
    return ReflectionSignal(
        target=ImprovementTarget.PRICING,
        observation="Coastal jobs ran 6% over on material; raise coastal markup.",
        supporting_evidence=(EvidenceType.INVOICE, EvidenceType.PAYMENT),
        changed=True,
    )


# ---------------------------------------------------------------------------
# Evidence-gated: only verified evidence drives change
# ---------------------------------------------------------------------------

def test_verified_evidence_yields_a_staged_proposal():
    engine = _engine()
    result = engine.reflect(
        "JOB-1",
        evidence=[
            EvidenceItem(EvidenceType.INVOICE, "Final invoice paid", verified=True),
            EvidenceItem(EvidenceType.PAYMENT, "Final payment cleared", verified=True),
        ],
        signals=[_verified_payment_signal()],
    )
    assert len(result.proposed_improvements) == 1
    imp = result.proposed_improvements[0]
    assert imp.tag == "STAGED"
    assert imp.status is ImprovementStatus.PROPOSED
    assert imp.requires_human_approval is True
    assert set(imp.supporting_evidence) == {EvidenceType.INVOICE, EvidenceType.PAYMENT}


def test_unverified_evidence_does_not_drive_change():
    engine = _engine()
    result = engine.reflect(
        "JOB-2",
        evidence=[EvidenceItem(EvidenceType.INVOICE, "invoice", verified=False),
                  EvidenceItem(EvidenceType.PAYMENT, "payment", verified=False)],
        signals=[_verified_payment_signal()],
    )
    assert result.proposed_improvements == ()
    # The signal is preserved as a gap, not silently dropped.
    assert any("lacks verified evidence" in g for g in result.knowledge_gaps)
    # And the unverified artifacts are named.
    assert any("Unverified" in g for g in result.knowledge_gaps)


def test_no_evidence_flags_a_gap_and_proposes_nothing():
    engine = _engine()
    result = engine.reflect("JOB-3", evidence=[], signals=[])
    assert result.proposed_improvements == ()
    assert any("No project evidence" in g for g in result.knowledge_gaps)


def test_confirmation_signal_is_learned_but_not_proposed():
    engine = _engine()
    confirm = ReflectionSignal(
        target=ImprovementTarget.SOP,
        observation="Standard mobilization checklist held up; no change needed.",
        supporting_evidence=(EvidenceType.INSPECTION,),
        changed=False,
    )
    result = engine.reflect(
        "JOB-4",
        evidence=[EvidenceItem(EvidenceType.INSPECTION, "final passed", verified=True)],
        signals=[confirm],
    )
    assert result.proposed_improvements == ()
    # It still shows up as a confirmation in the reflection layer.
    reflections = result.classified[MemoryLayer.REFLECTION.value]
    assert any("confirmation on sop" in r for r in reflections)


# ---------------------------------------------------------------------------
# Human-in-the-loop gate: proposes, never applies
# ---------------------------------------------------------------------------

def test_reflection_never_applies_anything():
    engine = _engine()
    result = engine.reflect(
        "JOB-5",
        evidence=[EvidenceItem(EvidenceType.INVOICE, "inv", verified=True),
                  EvidenceItem(EvidenceType.PAYMENT, "pay", verified=True)],
        signals=[_verified_payment_signal()],
    )
    assert result.applied_anything is False
    assert all(i.status is ImprovementStatus.PROPOSED for i in result.proposed_improvements)


def test_unapproved_improvement_cannot_be_applied():
    engine = _engine()
    imp = engine.reflect(
        "JOB-6",
        evidence=[EvidenceItem(EvidenceType.INVOICE, "inv", verified=True),
                  EvidenceItem(EvidenceType.PAYMENT, "pay", verified=True)],
        signals=[_verified_payment_signal()],
    ).proposed_improvements[0]
    with pytest.raises(PermissionError):
        apply_improvement(imp)


def test_approve_then_apply_is_the_only_path_to_applied():
    engine = _engine()
    imp = engine.reflect(
        "JOB-7",
        evidence=[EvidenceItem(EvidenceType.INVOICE, "inv", verified=True),
                  EvidenceItem(EvidenceType.PAYMENT, "pay", verified=True)],
        signals=[_verified_payment_signal()],
    ).proposed_improvements[0]

    approved = approve_improvement(imp, approver="Michael F. O'Rourke")
    assert approved.status is ImprovementStatus.APPROVED
    assert approved.approved_by == "Michael F. O'Rourke"

    applied = apply_improvement(approved)
    assert applied.status is ImprovementStatus.APPLIED


def test_approval_requires_a_named_human():
    engine = _engine()
    imp = engine.reflect(
        "JOB-8",
        evidence=[EvidenceItem(EvidenceType.INVOICE, "inv", verified=True),
                  EvidenceItem(EvidenceType.PAYMENT, "pay", verified=True)],
        signals=[_verified_payment_signal()],
    ).proposed_improvements[0]
    with pytest.raises(ValueError):
        approve_improvement(imp, approver="")


def test_rejected_improvement_cannot_be_approved_or_applied():
    engine = _engine()
    imp = engine.reflect(
        "JOB-9",
        evidence=[EvidenceItem(EvidenceType.INVOICE, "inv", verified=True),
                  EvidenceItem(EvidenceType.PAYMENT, "pay", verified=True)],
        signals=[_verified_payment_signal()],
    ).proposed_improvements[0]
    rejected = reject_improvement(imp, approver="PM")
    assert rejected.status is ImprovementStatus.REJECTED
    with pytest.raises(ValueError):
        approve_improvement(rejected, approver="Michael")
    with pytest.raises(PermissionError):
        apply_improvement(rejected)


# ---------------------------------------------------------------------------
# Regulated change requires a named licensed reviewer
# ---------------------------------------------------------------------------

def test_pricing_change_requires_financial_reviewer():
    engine = _engine()
    imp = engine.reflect(
        "JOB-10",
        evidence=[EvidenceItem(EvidenceType.INVOICE, "inv", verified=True),
                  EvidenceItem(EvidenceType.PAYMENT, "pay", verified=True)],
        signals=[_verified_payment_signal()],
    ).proposed_improvements[0]
    assert imp.regulated is True
    assert imp.licensed_reviewer_required is not None
    assert "financial" in imp.licensed_reviewer_required.lower()


def test_risk_model_change_requires_governance_reviewer():
    engine = _engine()
    sig = ReflectionSignal(
        target=ImprovementTarget.RISK_MODEL,
        observation="Add hurricane-season schedule buffer to coastal risk scoring.",
        supporting_evidence=(EvidenceType.INSPECTION,),
        changed=True,
    )
    imp = engine.reflect(
        "JOB-11",
        evidence=[EvidenceItem(EvidenceType.INSPECTION, "delay logged", verified=True)],
        signals=[sig],
    ).proposed_improvements[0]
    assert imp.layer is MemoryLayer.GOVERNANCE
    assert imp.licensed_reviewer_required is not None


# ---------------------------------------------------------------------------
# Recursive reflection: a later cycle supersedes prior knowledge
# ---------------------------------------------------------------------------

def test_second_cycle_supersedes_prior_knowledge_for_same_target():
    engine = _engine()  # shared store across both reflections
    evidence = [EvidenceItem(EvidenceType.INVOICE, "inv", verified=True),
                EvidenceItem(EvidenceType.PAYMENT, "pay", verified=True)]

    first = engine.reflect("JOB-A", evidence=evidence, signals=[_verified_payment_signal()])
    assert first.proposed_improvements[0].supersedes is None

    second = engine.reflect("JOB-B", evidence=evidence, signals=[_verified_payment_signal()])
    # The second pricing improvement points back at the first cycle's memory.
    assert second.proposed_improvements[0].supersedes is not None


# ---------------------------------------------------------------------------
# Episodic memory is auditable (hash-chained) and tamper-evident
# ---------------------------------------------------------------------------

def test_every_reflection_writes_a_tamper_evident_memory():
    store = RecursiveMemoryStore()
    engine = ReflectionEngine(store=store)
    engine.reflect(
        "JOB-12",
        evidence=[EvidenceItem(EvidenceType.PERMIT, "issued", verified=True)],
        signals=[],
    )
    assert len(store) == 1
    assert store.verify_chain() is True
    # Stored reflection memory is STAGED, never LIVE.
    assert store.all()[0].tag == "STAGED"


def test_reflect_rejects_empty_project_id():
    with pytest.raises(ValueError):
        _engine().reflect("   ", evidence=[], signals=[])
