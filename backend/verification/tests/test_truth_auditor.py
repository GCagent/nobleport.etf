"""
TruthAuditor Verification
=========================

Locks in the honesty invariants of the Truth & Audit Module:

  * The verdict is a mechanical function of the evidence index — no runtime
    evidence never lands anything above STAGED, an actively failed gating
    artifact is BLOCKED, and only full evidence reaches LIVE.
  * Design maturity NEVER upgrades a verdict.
  * The integrity digest is a real SHA-256 that detects tampering, chains to a
    prior digest, and Ed25519 stays honestly unsigned with no key.
  * The pre-output filter is fail-closed on untagged output, withholds+escalates
    on BLOCKED, and attaches the real Credential-Register caveat when an output
    reads as a claim over a licensed credential.

These run offline against synthetic evidence indices, so they are deterministic
and require no live deployment.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.governance.pre_output_filter import filter_output
from backend.governance.truth_layer import TruthTag
from backend.verification import truth_auditor as core


def _write_index(tmp_path: Path, artifacts: dict[str, dict[str, str]]) -> Path:
    (tmp_path / "evidence_index.json").write_text(
        json.dumps({"generated_by": "test", "artifacts": artifacts})
    )
    return tmp_path


# The six offline gating artifacts, all COLLECTED.
_ALL_GATING_COLLECTED = {
    "build_typecheck": {"status": "COLLECTED", "detail": "ok"},
    "migration_roundtrip": {"status": "COLLECTED", "detail": "ok"},
    "route_contract": {"status": "COLLECTED", "detail": "ok"},
    "health_endpoint": {"status": "COLLECTED", "detail": "ok"},
    "payment_verification": {"status": "COLLECTED", "detail": "ok"},
    "webhook_security": {"status": "COLLECTED", "detail": "ok"},
    "load_report": {"status": "COLLECTED", "detail": "ok"},
    "stripe_sandbox": {"status": "COLLECTED", "detail": "ok"},
}


# ---------------------------------------------------------------------------
# Tag derivation
# ---------------------------------------------------------------------------

def test_no_evidence_is_staged_never_live(tmp_path):
    """An empty evidence index -> STAGED. Design maturity must not upgrade it."""
    report = core.audit("Empty Target", evidence_dir=tmp_path)
    assert report.truth_tag == TruthTag.STAGED.value
    assert report.evidence_pct == 0
    assert report.released is True
    assert report.requires_human_approval is True
    # Design maturity is high but does NOT lift the verdict.
    assert report.design_maturity_avg >= 80


def test_partial_evidence_is_staged(tmp_path):
    partial = dict(_ALL_GATING_COLLECTED)
    partial["load_report"] = {"status": "PENDING", "detail": "live only"}
    partial["stripe_sandbox"] = {"status": "PENDING", "detail": "live only"}
    _write_index(tmp_path, partial)
    report = core.audit("Partial Target", evidence_dir=tmp_path)
    assert report.truth_tag == TruthTag.STAGED.value
    assert report.evidence_pct == 75
    assert report.gating_collected == 6 and report.gating_total == 8


def test_full_evidence_is_live(tmp_path):
    _write_index(tmp_path, _ALL_GATING_COLLECTED)
    report = core.audit("Full Target", evidence_dir=tmp_path)
    assert report.truth_tag == TruthTag.LIVE.value
    assert report.evidence_pct == 100
    assert report.requires_human_approval is False
    assert report.disclaimer == ""


def test_failed_gating_artifact_is_blocked(tmp_path):
    broken = dict(_ALL_GATING_COLLECTED)
    broken["webhook_security"] = {"status": "FAILED", "detail": "signature bypass"}
    _write_index(tmp_path, broken)
    report = core.audit("Broken Target", evidence_dir=tmp_path)
    assert report.truth_tag == TruthTag.BLOCKED.value
    assert report.released is False
    assert "webhook_security" in report.gating_failed


def test_simulated_demotes_live_to_simulated(tmp_path):
    _write_index(tmp_path, _ALL_GATING_COLLECTED)
    report = core.audit("Demo", evidence_dir=tmp_path, simulated=True)
    assert report.truth_tag == TruthTag.SIMULATED.value


# ---------------------------------------------------------------------------
# Integrity digest
# ---------------------------------------------------------------------------

def test_integrity_digest_is_real_and_verifies(tmp_path):
    report = core.audit("T", evidence_dir=tmp_path)
    assert len(report.integrity_sha256) == 64
    assert core.verify_digest(report) is True


def test_integrity_digest_detects_tampering(tmp_path):
    report = core.audit("T", evidence_dir=tmp_path)
    report.evidence_pct = 100  # forge a better score
    assert core.verify_digest(report) is False


def test_digest_chains_to_prev(tmp_path):
    first = core.audit("A", evidence_dir=tmp_path)
    second = core.audit("B", evidence_dir=tmp_path, prev_digest=first.integrity_sha256)
    assert second.prev_digest == first.integrity_sha256
    # Different prev digest -> different chained digest.
    assert second.integrity_sha256 != first.integrity_sha256


def test_ed25519_unsigned_without_key(tmp_path):
    report = core.audit("T", evidence_dir=tmp_path)
    signed = core.sign_ed25519(report, private_key_pem=None)
    assert signed.ed25519_signature is None  # honest: no key, no signature


def test_ed25519_signs_with_real_key(tmp_path):
    ed25519 = pytest.importorskip(
        "cryptography.hazmat.primitives.asymmetric.ed25519"
    )
    from cryptography.hazmat.primitives import serialization

    key = ed25519.Ed25519PrivateKey.generate()
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    report = core.audit("T", evidence_dir=tmp_path)
    signed = core.sign_ed25519(report, private_key_pem=pem)
    assert signed.ed25519_signature is not None
    # Verify the signature against the integrity digest with the public key.
    key.public_key().verify(
        bytes.fromhex(signed.ed25519_signature), signed.integrity_sha256.encode()
    )


# ---------------------------------------------------------------------------
# Pre-output filter
# ---------------------------------------------------------------------------

def test_filter_rejects_untagged_output():
    with pytest.raises(ValueError):
        filter_output("anything", None)


def test_filter_blocked_withholds_and_escalates():
    result = filter_output("You should invest in this security.", TruthTag.BLOCKED)
    assert result.released is False
    assert result.disposition == "WITHHOLD_ESCALATE"
    assert result.text == ""  # nothing released
    assert result.escalate_to  # escalated to a human


def test_filter_live_releases_clean():
    result = filter_output("Lead routed to fast-track.", TruthTag.LIVE)
    assert result.released is True
    assert result.disposition == "RELEASE"
    assert result.disclaimer == ""


def test_filter_staged_attaches_oversight_notice():
    result = filter_output("Heah's the read on the dashboard.", TruthTag.STAGED)
    assert result.released is True
    assert result.disposition == "RELEASE_WITH_CAVEAT"
    assert "licensed human oversight" in result.disclaimer.lower()
    assert result.disclaimer in result.text


def test_filter_attaches_credential_caveat_on_engineering_claim():
    result = filter_output(
        "The beam is structurally sound and code-compliant per my review.",
        TruthTag.LIVE,
    )
    # A LIVE tag still gets a caveat because the text reads as a PE claim.
    assert result.credential_caveats
    assert any("PE" in c for c in result.credential_caveats)
    assert result.disposition == "RELEASE_WITH_CAVEAT"


def test_filter_string_tag_accepted():
    result = filter_output("ok", "staged")  # case-insensitive string tag
    assert result.tag == "STAGED"
