"""
Tests for the Journey Agent (Story Engine).

These assert the doctrine and its governance posture: one artifact fans out into
many assets (Build Once, Publish Everywhere), the engine never fabricates facts
(missing fields become content gaps), every asset is a draft that only a human
can approve, consent-gated channels are blocked until consent is recorded, the
asset ledger is tamper-evident, and the Story Engine metrics match the assets
actually produced.
"""

from __future__ import annotations

import pytest

from backend.journey import (
    CONTENT_CHANNELS,
    CONTENT_PLAYBOOKS,
    Artifact,
    ArtifactType,
    AssetLedger,
    AssetStatus,
    JourneyEngine,
    compute_story_engine,
    flywheel_to_dict,
)
from backend.journey.engine import LEVERAGE_TARGET_MIN


def make_engine() -> JourneyEngine:
    return JourneyEngine(ledger=AssetLedger())


def completed_job(consent: bool = True) -> Artifact:
    return Artifact(
        artifact_type=ArtifactType.COMPLETED_JOB,
        project_name="236 High Road Roof Replacement",
        service_line="Roofing",
        location="Newbury, MA",
        summary="Full tear-off and architectural shingle install.",
        highlights=["Zero weather delays", "Passed final inspection first try"],
        metrics={"sq_ft": "2,400", "duration_days": "4"},
        client_name="The Smith Family",
        client_consent=consent,
        photo_count=18,
        source_id="job-001",
    )


def test_completed_job_fans_out_to_many_assets():
    engine = make_engine()
    run = engine.process_artifact(completed_job())
    # The completed-job playbook is the richest and must hit the doctrine target.
    assert run.asset_count == len(CONTENT_PLAYBOOKS[ArtifactType.COMPLETED_JOB].channels)
    assert run.asset_count >= LEVERAGE_TARGET_MIN
    assert run.meets_leverage_target is True


def test_every_playbook_channel_is_known():
    # validate_playbooks runs at import; assert the relationship explicitly too.
    for playbook in CONTENT_PLAYBOOKS.values():
        for key in playbook.channels:
            assert key in CONTENT_CHANNELS


def test_assets_are_drafts_never_published():
    engine = make_engine()
    run = engine.process_artifact(completed_job())
    statuses = {a["status"] for a in run.assets}
    assert "PUBLISHED" not in statuses
    assert statuses <= {"DRAFT", "BLOCKED"}


def test_consent_gated_channels_block_without_consent():
    engine = make_engine()
    run = engine.process_artifact(completed_job(consent=False))
    # At least one completed-job channel requires consent (portfolio, before/after…).
    assert run.blocked_on_consent > 0
    blocked = [a for a in run.assets if a["status"] == "BLOCKED"]
    assert all(a["requires_consent"] for a in blocked)


def test_consent_present_unblocks_those_channels():
    engine = make_engine()
    run = engine.process_artifact(completed_job(consent=True))
    assert run.blocked_on_consent == 0


def test_missing_fields_become_content_gaps_not_invented():
    engine = make_engine()
    sparse = Artifact(
        artifact_type=ArtifactType.COMPLETED_JOB,
        project_name="Sparse Project",
        client_consent=True,
    )
    run = engine.process_artifact(sparse)
    assert run.content_gaps, "missing fields should surface as content gaps"
    # The gap markers must appear in the rendered body, not fabricated values.
    bodies = " ".join(a["body"] for a in run.assets)
    assert "[[provide:" in bodies


def test_approval_is_the_only_path_out_of_draft():
    engine = make_engine()
    run = engine.process_artifact(completed_job(consent=True))
    draft = next(a for a in run.assets if a["status"] == "DRAFT")
    asset = engine.ledger.approve(draft["asset_id"], approver="M. O'Rourke")
    assert asset.status == AssetStatus.APPROVED
    assert asset.approved_by == "M. O'Rourke"
    assert asset.approved_at


def test_blocked_asset_requires_consent_to_approve():
    engine = make_engine()
    run = engine.process_artifact(completed_job(consent=False))
    blocked = next(a for a in run.assets if a["status"] == "BLOCKED")
    with pytest.raises(ValueError):
        engine.ledger.approve(blocked["asset_id"], approver="M. O'Rourke")
    # Recording consent unblocks approval.
    asset = engine.ledger.approve(
        blocked["asset_id"], approver="M. O'Rourke", consent_recorded=True
    )
    assert asset.status == AssetStatus.APPROVED


def test_approval_does_not_break_the_chain():
    engine = make_engine()
    run = engine.process_artifact(completed_job(consent=True))
    assert engine.ledger.verify_chain() is True
    draft = next(a for a in run.assets if a["status"] == "DRAFT")
    engine.ledger.approve(draft["asset_id"], approver="M. O'Rourke")
    # Approval is metadata, not content — the chain stays intact.
    assert engine.ledger.verify_chain() is True


def test_ledger_is_tamper_evident():
    engine = make_engine()
    engine.process_artifact(completed_job(consent=True))
    ledger = engine.ledger
    assert ledger.verify_chain() is True
    ledger.all()[0].headline = "TAMPERED"
    assert ledger.verify_chain() is False


def test_story_engine_matches_stored_assets():
    engine = make_engine()
    engine.process_artifact(completed_job(consent=True))
    engine.process_artifact(
        Artifact(
            artifact_type=ArtifactType.PERMIT_FINDING,
            project_name="Essex County permit trend",
            summary="Permit approvals up 12% QoQ in target municipalities.",
            source_id="permit-001",
        )
    )
    metrics = compute_story_engine(engine.ledger)
    assert metrics.artifacts_processed == 2
    assert metrics.assets_generated == len(engine.ledger)
    assert metrics.leverage_target_min == LEVERAGE_TARGET_MIN
    assert metrics.chain_intact is True


def test_permit_finding_market_post_needs_no_consent():
    engine = make_engine()
    run = engine.process_artifact(
        Artifact(
            artifact_type=ArtifactType.PERMIT_FINDING,
            project_name="Essex County permit trend",
            summary="Approvals up 12% QoQ.",
            source_id="permit-001",
        )
    )
    # Market intelligence is about market data, not a client — never blocked.
    assert run.blocked_on_consent == 0


def test_unmapped_artifact_produces_no_assets():
    engine = make_engine()
    # INVOICE maps to a single internal channel; assert the small-fan-out case.
    run = engine.process_artifact(
        Artifact(
            artifact_type=ArtifactType.INVOICE,
            project_name="Invoice 1042",
            summary="Progress billing #2.",
            source_id="inv-1042",
        )
    )
    assert run.asset_count == 1
    assert run.meets_leverage_target is False


def test_flywheel_is_a_cycle():
    wheel = flywheel_to_dict()
    assert wheel["is_cycle"] is True
    assert wheel["loop"][0] == "Project"
    assert wheel["loop"][-1] == "Projects"


def test_artifact_requires_project_name():
    with pytest.raises(ValueError):
        Artifact(artifact_type=ArtifactType.ESTIMATE, project_name="   ")
