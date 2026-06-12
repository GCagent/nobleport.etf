"""
Tests for the systems truth registry.

The hard guarantees: VERIFIED is impossible without a named verifier
(fail-closed), repo code-completeness earns STAGED and never VERIFIED,
external claims are classified by their own evidence (EpochX = CLAIMED,
avatar fleet = DEMO), regulated layers sit on LEGAL_HOLD with mandatory
human approval, and the rollups reconcile.
"""

from __future__ import annotations

import pytest

from backend.systems import (
    BUCKET_DEFINITIONS,
    PROMOTION_GATES,
    SystemNode,
    TruthBucket,
    build_registry,
    nodes_from_program,
)


def test_every_bucket_has_definition_and_gate():
    for bucket in TruthBucket:
        assert bucket in BUCKET_DEFINITIONS
        assert bucket in PROMOTION_GATES


def test_verified_requires_named_verifier():
    with pytest.raises(ValueError, match="fail-closed"):
        SystemNode(
            key="fake", name="Fake", category="Test",
            bucket=TruthBucket.VERIFIED, summary="", evidence=(),
            next_gate="", source="declared:test",
        )


def test_verifier_forbidden_on_unverified_nodes():
    with pytest.raises(ValueError, match="only valid on VERIFIED"):
        SystemNode(
            key="fake", name="Fake", category="Test",
            bucket=TruthBucket.STAGED, summary="", evidence=(),
            next_gate="", source="declared:test", verified_by="someone",
        )


def test_repo_code_complete_is_staged_never_verified():
    nodes = nodes_from_program()
    assert nodes, "program bridge produced no nodes"
    for n in nodes:
        assert n.bucket in {TruthBucket.STAGED, TruthBucket.PLANNED}
        assert n.bucket is not TruthBucket.VERIFIED
        assert n.source == "measured:repo"


def test_verified_only_via_named_verifier():
    """
    Every VERIFIED node carries a named verifier — operator attestation or a
    verification event with third-party telemetry. None are self-declared.
    """
    registry = build_registry()
    verified = [n for n in registry.nodes if n.bucket is TruthBucket.VERIFIED]
    # 7 register-attested LIVE rows + telegram bot addendum + mission control
    # promoted by Vercel telemetry.
    assert len(verified) == registry.verified_count == 9
    for n in verified:
        assert n.verified_by, f"{n.key} verified without a named verifier"


# ---------------------------------------------------------------------------
# Verification pipeline — the only path to a higher verified count
# ---------------------------------------------------------------------------

def test_mission_control_promoted_by_current_telemetry():
    nodes = {n.key: n for n in build_registry().nodes}
    mc = nodes["repo:mission_control"]
    assert mc.bucket is TruthBucket.VERIFIED
    assert "Vercel" in (mc.verified_by or "")
    assert any("0bfae1d" in e for e in mc.evidence)


def test_expired_verification_does_not_promote():
    from datetime import datetime, timezone
    from backend.systems.verification import VERIFICATION_LOG

    event = VERIFICATION_LOG[0]
    after_expiry = datetime(2099, 1, 1, tzinfo=timezone.utc)
    assert event.is_current() is True
    assert event.is_current(after_expiry) is False


def test_verification_of_unknown_system_raises():
    import pytest
    from backend.systems.registry import TruthRegistry
    from backend.systems.verification import VerificationEvent, apply_verifications

    bogus = VerificationEvent(
        system_key="does_not_exist", verifier="x", method="operator_attestation",
        evidence=(), verified_at="2026-06-11", expires_at="2026-12-31",
    )
    import backend.systems.verification as v
    original = v.VERIFICATION_LOG
    v.VERIFICATION_LOG = (bogus,)
    try:
        with pytest.raises(ValueError, match="unknown system"):
            apply_verifications(TruthRegistry())
    finally:
        v.VERIFICATION_LOG = original


def test_verification_queue_ranks_closest_candidates_first():
    from backend.systems.verification import verification_queue

    queue = verification_queue()
    assert queue, "queue should not be empty"
    pcts = [c["declared_completion_pct"] or 0 for c in queue]
    assert pcts == sorted(pcts, reverse=True)
    # Highest declared-completion staged module leads the queue.
    assert queue[0]["key"] == "reg:unified_wallet"
    keys = {n.key for n in build_registry().nodes}
    for c in queue:
        assert c["key"] in keys
        assert c["evidence_needed"]


def test_telegram_bot_addendum_is_attested():
    nodes = {n.key: n for n in build_registry().nodes}
    bot = nodes["reg:telegram_price_bot"]
    assert bot.bucket is TruthBucket.VERIFIED
    assert bot.verified_by and "Operator control register" in bot.verified_by


def test_external_claims_classified_by_their_own_evidence():
    nodes = {n.key: n for n in build_registry().nodes}
    assert nodes["epochx_mesh"].bucket is TruthBucket.CLAIMED
    assert nodes["avatar_fleet"].bucket is TruthBucket.DEMO
    assert nodes["truth_inventory_workbook"].bucket is TruthBucket.REFERENCE


def test_regulated_layers_are_held_and_human_gated():
    nodes = {n.key: n for n in build_registry().nodes}
    token = nodes["nbpt_token_issuance"]
    assert token.bucket is TruthBucket.LEGAL_HOLD
    assert token.human_approval_required is True
    trading = nodes["trading_live_execution"]
    assert trading.bucket is TruthBucket.BLOCKED
    assert trading.human_approval_required is True


def test_no_duplicate_keys_and_rollup_reconciles():
    registry = build_registry()
    keys = [n.key for n in registry.nodes]
    assert len(keys) == len(set(keys))
    assert sum(registry.by_bucket().values()) == len(registry.nodes)


def test_execution_path_references_real_nodes():
    registry = build_registry()
    keys = {n.key for n in registry.nodes}
    payload = registry.to_dict()
    for step in payload["execution_path"]:
        assert step["node"] in keys, f"execution path references unknown node {step['node']}"


# ---------------------------------------------------------------------------
# 50-module control register (2026-06-11)
# ---------------------------------------------------------------------------

def test_control_register_has_50_unique_rows():
    from backend.systems.control_register import CONTROL_REGISTER
    assert len(CONTROL_REGISTER) == 50
    nums = [r.num for r in CONTROL_REGISTER]
    assert nums == list(range(1, 51))
    keys = [r.key for r in CONTROL_REGISTER]
    assert len(keys) == len(set(keys))


def test_composite_statuses_never_map_to_verified():
    """Conservative mapping: any hedged/composite status takes the lower bucket."""
    from backend.systems.control_register import CONTROL_REGISTER
    for row in CONTROL_REGISTER:
        if "/" in row.declared_status:
            assert row.bucket is not TruthBucket.VERIFIED, (
                f"row {row.num} ({row.key}): composite status "
                f"{row.declared_status!r} must not be VERIFIED"
            )


def test_register_live_rows_match_attested_set():
    from backend.systems.control_register import CONTROL_REGISTER
    live_keys = {r.key for r in CONTROL_REGISTER if r.bucket is TruthBucket.VERIFIED}
    assert live_keys == {
        "construction_intake", "construction_orchestration",
        "scope_estimate_engine", "proposal_generator",
        "manual_permit_fallback", "kuzo_safe_swap", "kuzo_dashboard",
    }


def test_register_holds_and_blocks():
    from backend.systems.control_register import CONTROL_REGISTER
    rows = {r.key: r for r in CONTROL_REGISTER}
    assert rows["real_estate_nft"].bucket is TruthBucket.LEGAL_HOLD
    assert rows["fiat_router"].bucket is TruthBucket.LEGAL_HOLD
    assert rows["swap_execution"].bucket is TruthBucket.BLOCKED
    assert rows["treasury_bot_v3"].bucket is TruthBucket.BLOCKED
    assert rows["permitstream_monitor"].bucket is TruthBucket.BLOCKED
    # All holds/blocks on money or regulated lanes are human-gated.
    for key in ("real_estate_nft", "fiat_router", "swap_execution", "treasury_bot_v3"):
        assert rows[key].human_gated is True


def test_register_claims_and_demos():
    from backend.systems.control_register import CONTROL_REGISTER
    rows = {r.key: r for r in CONTROL_REGISTER}
    assert rows["avatar_gpu_layer"].bucket is TruthBucket.CLAIMED
    assert rows["zk_kyt_compliance"].bucket is TruthBucket.CLAIMED
    assert rows["sales_sim_layer"].bucket is TruthBucket.DEMO


def test_bankable_core_references_registered_nodes():
    from backend.systems.control_register import BANKABLE_CORE
    keys = {n.key for n in build_registry().nodes}
    assert len(BANKABLE_CORE) == 12
    for k in BANKABLE_CORE:
        assert k in keys, f"bankable core references unknown node {k}"


def test_payload_carries_truth_floor_and_claimed_metrics():
    payload = build_registry().to_dict()
    assert "0 external live nodes" in payload["control_truth_floor"]
    claims = {m["claim"] for m in payload["claimed_metrics"]}
    assert any("3,012" in c for c in claims)
    assert any("112 AI agents" in c for c in claims)
