"""
Tests for the NoblePort Attestation Registry v1.0.

These assert the registry's fail-honest invariants: no record claims VERIFIED
without evidence on file, no blockchain anchor is recorded without a VERIFIED
status to back it, narrative expiry dates never masquerade as real ones, and
the published bottom line (0 verified, 0 anchored as of v1.0) matches the data.
"""

from __future__ import annotations

from backend.governance import (
    ATTESTATION_REGISTRY,
    AttestationCategory,
    AttestationStatus,
    registry_summary,
    validate_registry,
)
from backend.governance.attestation_registry import (
    AttestationRecord,
    RevocationStatus,
    by_category,
    by_status,
    get_attestation,
)


def test_registry_passes_all_invariants():
    assert validate_registry() == []


def test_ids_are_unique_and_well_formed():
    ids = [r.attestation_id for r in ATTESTATION_REGISTRY]
    assert len(ids) == len(set(ids))
    assert all(i.startswith("NP-ATT-") for i in ids)


def test_v1_bottom_line_zero_verified_zero_anchored():
    # The honest headline of v1.0: nothing is independently verified yet,
    # and nothing is anchored on any chain. If either changes, update the
    # registry doc and this test together.
    summary = registry_summary()
    assert summary["verified_count"] == 0
    assert summary["anchored_count"] == 0


def test_every_category_is_populated():
    for category in AttestationCategory:
        assert by_category(category), f"{category.value} has no records"


def test_permitstream_has_thirteen_classes():
    assert len(by_category(AttestationCategory.PERMITSTREAM)) == 13


def test_zk_proof_claims_are_all_simulated():
    # The recorded zk proof references (qualified purchaser, stake threshold,
    # validator set, etc.) are narrative artifacts. None may ever drift to a
    # stronger status without real proof artifacts and a verifier.
    for r in by_category(AttestationCategory.ZK_PROOF_CLAIM):
        assert r.status == AttestationStatus.SIMULATED
        assert r.blockchain_anchor is None
        assert r.expiration_date is None  # claimed_expiration only


def test_validator_invariants_catch_violations():
    bogus = (
        AttestationRecord(
            "NP-ATT-XXX-001", "Bogus Verified", AttestationCategory.IDENTITY,
            "Nobody", AttestationStatus.VERIFIED, "magic",
        ),
        AttestationRecord(
            "NP-ATT-XXX-002", "Bogus Anchor", AttestationCategory.IDENTITY,
            "Nobody", AttestationStatus.SIMULATED, "magic",
            blockchain_anchor="eth:0x0",
        ),
    )
    violations = validate_registry(bogus)
    assert any("VERIFIED without evidence_source" in v for v in violations)
    assert any("blockchain_anchor on non-VERIFIED" in v for v in violations)


def test_lookup_helpers():
    rec = get_attestation("NP-ATT-GOV-002")
    assert rec is not None
    assert rec.name.startswith("Human-in-the-Loop")
    assert get_attestation("NP-ATT-NOPE-999") is None
    assert all(
        r.status == AttestationStatus.SELF_ASSERTED
        for r in by_status(AttestationStatus.SELF_ASSERTED)
    )


def test_no_record_claims_revocation_infra_that_does_not_exist():
    # No revocation registry exists, so no record may claim NOT_REVOKED.
    for r in ATTESTATION_REGISTRY:
        assert r.revocation_status == RevocationStatus.NO_REGISTRY


def test_summary_totals_match_ledger():
    summary = registry_summary()
    assert summary["total_records"] == len(ATTESTATION_REGISTRY)
    assert sum(summary["by_status"].values()) == len(ATTESTATION_REGISTRY)
    assert sum(summary["by_category"].values()) == len(ATTESTATION_REGISTRY)
