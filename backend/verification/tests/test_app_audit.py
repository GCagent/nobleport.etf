"""
App Audit Honesty Tests
=======================

The per-app truth scorecard (``backend/verification/app_audit.py``) carries the
same load-bearing rule as the rest of this package: build-maturity scores can
never promote an app's evidence level. These tests are the tripwire that proves
it — they fail the moment any app overstates what is actually verified, or the
moment an evidence claim drifts away from the independent ``operational_truth``
source of truth.
"""

from __future__ import annotations

import pytest

from backend.config.operational_truth import OPERATIONAL_TRUTH, DeploymentStatus
from backend.verification import app_audit
from backend.verification.app_audit import (
    DIMENSIONS,
    AppAudit,
    EvidenceLevel,
    check_consistency,
    evaluate,
    _registry,
)


def test_registry_is_internally_honest():
    """Shipped registry must pass every consistency rule with zero violations."""
    violations = check_consistency()
    assert violations == [], "Registry overstates evidence:\n" + "\n".join(violations)
    assert evaluate()["honest"] is True


def test_every_verified_live_app_has_real_live_backing():
    """Rule 1: a 🟢 Verified Live label must be earned by a LIVE capability that
    operational_truth independently classifies — not by any dimension score."""
    for app in _registry():
        if app.evidence_level == EvidenceLevel.VERIFIED_LIVE:
            live = [
                f
                for f in app.backing_live_features
                if OPERATIONAL_TRUTH.get(f, {}).get("status") == DeploymentStatus.LIVE
            ]
            assert live, (
                f"{app.name} claims Verified Live with no LIVE-classified backing "
                f"capability"
            )


def test_high_scores_cannot_buy_verified_live():
    """A perfect 100% across every dimension must NOT make an unbacked app
    Verified Live. This is the exact 'design maturity can't move STATUS' rule,
    applied per app."""
    impostor = AppAudit(
        name="Impostor Dashboard",
        surface="Frontend",
        evidence_level=EvidenceLevel.VERIFIED_LIVE,  # the lie
        truth_features=[],
        backing_live_features=[],  # nothing actually LIVE
        scores={d: 100 for d in DIMENSIONS},  # flawless build maturity
    )
    violations = check_consistency([impostor])
    assert any("VERIFIED_LIVE" in v for v in violations), (
        "A 100%-built but unbacked app was allowed to claim Verified Live"
    )
    assert evaluate([impostor])["honest"] is False


def test_backing_feature_must_actually_be_live():
    """Rule 2: naming a STAGED/MODELED feature as LIVE backing is a violation."""
    # treasury_workflows is STAGED in operational_truth, not LIVE.
    assert OPERATIONAL_TRUTH["treasury_workflows"]["status"] == DeploymentStatus.STAGED
    liar = AppAudit(
        name="Liar Node",
        surface="Backend",
        evidence_level=EvidenceLevel.VERIFIED_LIVE,
        truth_features=["treasury_workflows"],
        backing_live_features=["treasury_workflows"],
        scores={d: 70 for d in DIMENSIONS},
    )
    violations = check_consistency([liar])
    assert any("not LIVE" in v for v in violations)


def test_unknown_backing_feature_flagged():
    ghost = AppAudit(
        name="Ghost App",
        surface="Backend",
        evidence_level=EvidenceLevel.STAGING,
        truth_features=[],
        backing_live_features=["nonexistent_feature_xyz"],
        scores={d: 50 for d in DIMENSIONS},
    )
    violations = check_consistency([ghost])
    assert any("not in operational_truth" in v for v in violations)


def test_production_readiness_capped_for_non_live_apps():
    """Rule 4: 'built' is not 'production-proven' — a non-Verified-Live app may
    not report production_readiness above 60."""
    overconfident = AppAudit(
        name="Overconfident Staging App",
        surface="Backend",
        evidence_level=EvidenceLevel.STAGING,
        truth_features=[],
        backing_live_features=[],
        scores={**{d: 50 for d in DIMENSIONS}, "production_readiness": 95},
    )
    violations = check_consistency([overconfident])
    assert any("production_readiness" in v for v in violations)


def test_scores_must_be_in_range():
    bad = AppAudit(
        name="Out Of Range",
        surface="Frontend",
        evidence_level=EvidenceLevel.PROTOTYPE,
        truth_features=[],
        backing_live_features=[],
        scores={**{d: 50 for d in DIMENSIONS}, "security": 140},
    )
    violations = check_consistency([bad])
    assert any("out of range" in v for v in violations)


def test_web3_dashboard_matches_audit_example():
    """The audit gave the Web3 dashboard a specific scoring (UI ~95, backend ~25,
    live blockchain 0% verified, prototype). Keep that anchor exact so the
    framework demonstrably reproduces the example it was specified against."""
    apps = {a.name: a for a in _registry()}
    web3 = apps["Web3 / Tokenization Dashboard"]
    assert web3.evidence_level == EvidenceLevel.PROTOTYPE
    assert web3.scores["frontend_ui"] == 95
    assert web3.scores["backend_api"] == 25
    assert web3.scores["production_readiness"] == 40
    # No LIVE backing -> it can never be flagged Verified Live.
    assert web3.backing_live_features == []
    assert "blockchain verification: 0%" in web3.note.lower()


def test_all_four_evidence_levels_represented():
    """The scorecard should exercise the full taxonomy, not collapse to one tier."""
    levels = {a.evidence_level for a in _registry()}
    assert levels == set(EvidenceLevel)


def test_design_score_is_mean_of_dimensions():
    app = AppAudit(
        name="X",
        surface="Y",
        evidence_level=EvidenceLevel.PROTOTYPE,
        truth_features=[],
        backing_live_features=[],
        scores={d: 60 for d in DIMENSIONS},
    )
    assert app.design_score() == 60


def test_cli_exits_nonzero_on_dishonest_registry(monkeypatch):
    """The CLI must gate CI: a dishonest registry => non-zero exit."""
    impostor = AppAudit(
        name="Impostor",
        surface="Frontend",
        evidence_level=EvidenceLevel.VERIFIED_LIVE,
        truth_features=[],
        backing_live_features=[],
        scores={d: 100 for d in DIMENSIONS},
    )
    monkeypatch.setattr(app_audit, "_registry", lambda: [impostor])
    assert app_audit.main([]) == 1
    assert app_audit.main(["--json"]) == 1


def test_cli_clean_registry_exits_zero():
    assert app_audit.main([]) == 0
