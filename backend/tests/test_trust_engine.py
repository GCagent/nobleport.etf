"""
Tests for the Cyborg.io Trust Engine.

These assert the evidence-first rules: every verification returns an
evidence object anchored to the Proof-of-Trust hash chain; document review
tops out at REPORTED (never VERIFIED); the policy engine returns
CONDITIONAL/STAGED at best without authoritative sources and REJECTED/
BLOCKED on any failed or missing requirement; the trust score always ships
with its evidence breakdown.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from backend.governance.truth_layer import TruthTag
from backend.services.trust_engine import (
    CredentialType,
    EvidenceVerdict,
    PolicyDecision,
    TrustEngine,
    VerificationMethod,
)

NEXT_YEAR = date.today() + timedelta(days=365)
LAST_YEAR = date.today() - timedelta(days=365)


@pytest.fixture
def engine() -> TrustEngine:
    return TrustEngine()


def _good_license(engine: TrustEngine, subject_id: str = "sub-001"):
    return engine.verify_license(
        subject_id=subject_id,
        subject_name="Rivera Framing LLC",
        license_number="CS-107345",
        license_type="ma_csl",
        holder_name="Rivera Framing LLC",
        expiration_date=NEXT_YEAR,
    )


def _good_insurance(engine: TrustEngine, subject_id: str = "sub-001"):
    return engine.verify_insurance(
        subject_id=subject_id,
        subject_name="Rivera Framing LLC",
        carrier="Acme Mutual",
        policy_number="GL-99182",
        each_occurrence=2_000_000.0,
        effective_date=date.today() - timedelta(days=30),
        expiration_date=NEXT_YEAR,
    )


# ---------------------------------------------------------------------------
# Evidence objects
# ---------------------------------------------------------------------------


def test_document_review_tops_out_at_reported(engine):
    ev = _good_license(engine)
    assert ev.verdict == EvidenceVerdict.REPORTED  # never VERIFIED from docs
    assert ev.method == VerificationMethod.DOCUMENT_REVIEW
    assert ev.truth_tag == TruthTag.STAGED
    assert all(c.passed for c in ev.checks)


def test_expired_license_fails_with_blocked_tag(engine):
    ev = engine.verify_license(
        subject_id="sub-002",
        subject_name="Old Timer Builds",
        license_number="CS-100001",
        expiration_date=LAST_YEAR,
    )
    assert ev.verdict == EvidenceVerdict.FAILED
    assert ev.truth_tag == TruthTag.BLOCKED
    assert any(c.name == "license_current" and not c.passed for c in ev.checks)


def test_malformed_license_number_fails(engine):
    ev = engine.verify_license(
        subject_id="sub-003",
        subject_name="No License Larry",
        license_number="TOTALLY-REAL-123",
        expiration_date=NEXT_YEAR,
    )
    assert ev.verdict == EvidenceVerdict.FAILED


def test_insurance_below_minimum_fails(engine):
    ev = engine.verify_insurance(
        subject_id="sub-004",
        subject_name="Thin Coverage Co",
        carrier="Acme Mutual",
        policy_number="GL-1",
        each_occurrence=500_000.0,
        expiration_date=NEXT_YEAR,
    )
    assert ev.verdict == EvidenceVerdict.FAILED
    assert any(c.name == "coverage_minimum" and not c.passed for c in ev.checks)


def test_every_evidence_object_is_chain_anchored(engine):
    ev1 = _good_license(engine)
    ev2 = _good_insurance(engine)
    assert ev1.chain_record_id and ev1.chain_record_hash
    assert ev2.chain_record_id and ev2.chain_record_hash
    assert engine.verify_chain() is True

    proof = engine.chain_proof(ev1.evidence_id)
    assert proof["chain"]["record_hash"] == ev1.chain_record_hash
    assert proof["chain"]["chain_verified"] is True
    assert proof["document"]["ref"] == ev1.evidence_id


# ---------------------------------------------------------------------------
# Policy engine
# ---------------------------------------------------------------------------


def test_policy_conditional_on_self_reported_evidence(engine):
    _good_license(engine)
    _good_insurance(engine)
    result = engine.evaluate_policy("subcontractor_onboarding", "sub-001")
    # Both credentials passed, but only from documents -> human review.
    assert result.decision == PolicyDecision.CONDITIONAL
    assert result.truth_tag == TruthTag.STAGED
    assert len(result.evidence_ids) == 2
    assert result.chain_record_id is not None


def test_policy_rejected_when_evidence_missing(engine):
    _good_license(engine)  # no insurance on file
    result = engine.evaluate_policy("subcontractor_onboarding", "sub-001")
    assert result.decision == PolicyDecision.REJECTED
    assert result.truth_tag == TruthTag.BLOCKED
    assert any("No evidence on file" in r for r in result.reasons)


def test_policy_rejected_on_failed_credential(engine):
    engine.verify_license(
        subject_id="sub-001",
        subject_name="Rivera Framing LLC",
        license_number="CS-107345",
        expiration_date=LAST_YEAR,  # expired
    )
    _good_insurance(engine)
    result = engine.evaluate_policy("subcontractor_onboarding", "sub-001")
    assert result.decision == PolicyDecision.REJECTED
    assert result.truth_tag == TruthTag.BLOCKED


def test_unknown_policy_raises(engine):
    with pytest.raises(ValueError, match="Unknown policy"):
        engine.evaluate_policy("no_such_policy", "sub-001")


# ---------------------------------------------------------------------------
# Trust score
# ---------------------------------------------------------------------------


def test_trust_score_ships_with_breakdown(engine):
    _good_license(engine)
    _good_insurance(engine)
    score = engine.trust_score("sub-001")
    assert score["score"] == 70  # two REPORTED credentials
    assert len(score["breakdown"]) == 2
    assert all(b["verdict"] == "reported" for b in score["breakdown"])


def test_trust_score_zero_without_evidence(engine):
    score = engine.trust_score("nobody")
    assert score["score"] == 0
    assert score["breakdown"] == []


def test_failed_credential_drags_score(engine):
    _good_license(engine)
    engine.verify_insurance(
        subject_id="sub-001",
        subject_name="Rivera Framing LLC",
        carrier="Acme Mutual",
        policy_number="GL-1",
        each_occurrence=100_000.0,  # below minimum -> FAILED
        expiration_date=NEXT_YEAR,
    )
    score = engine.trust_score("sub-001")
    assert score["score"] == 35  # (70 + 0) / 2


# ---------------------------------------------------------------------------
# Latest-evidence semantics
# ---------------------------------------------------------------------------


def test_policy_uses_latest_evidence_per_credential(engine):
    # First an expired license, then a corrected current one.
    engine.verify_license(
        subject_id="sub-001",
        subject_name="Rivera Framing LLC",
        license_number="CS-107345",
        expiration_date=LAST_YEAR,
    )
    _good_license(engine)
    _good_insurance(engine)
    result = engine.evaluate_policy("subcontractor_onboarding", "sub-001")
    assert result.decision == PolicyDecision.CONDITIONAL
