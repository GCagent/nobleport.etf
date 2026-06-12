"""
Tests for the Stephanie.ai 50-module execution framework.

The hard guarantees: the catalog mirrors the register exactly; "bound" is
measured against the filesystem; blocked/held/claimed modules refuse to run;
human-gated modules stage drafts instead of executing; scaffolds answer
honestly; the working implementations compute correctly (takeoff math,
tamper-evident change-order chain); and the decision log is hash-chained.
"""

from __future__ import annotations

import pytest

from backend.stephanie import Outcome, StephanieOrchestrator, build_catalog
from backend.stephanie.framework import REPO_ROOT, BuildState
from backend.stephanie.impl.change_order_ledger import ChangeOrderLedger
from backend.stephanie.impl.roofing_takeoff import RoofPlane, takeoff
from backend.systems.control_register import CONTROL_REGISTER


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

def test_catalog_mirrors_register_exactly():
    catalog = build_catalog()
    assert len(catalog) == 50
    assert [m.register_num for m in catalog] == [r.num for r in CONTROL_REGISTER]
    assert {m.key for m in catalog} == {r.key for r in CONTROL_REGISTER}


def test_bound_is_measured_against_filesystem():
    for m in build_catalog():
        for path in m.existing_bindings:
            assert (REPO_ROOT / path).exists()
        if not m.bindings:
            assert m.bound is False


def test_catalog_has_executable_bound_and_scaffold_states():
    orch = StephanieOrchestrator()
    d = orch.catalog_dict()
    assert d["total_modules"] == 50
    assert d["executable"] >= 4   # takeoff, CO ledger, sales sim, permitstream
    assert d["bound"] > 0
    assert d["scaffold"] > 0
    assert d["executable"] + d["bound"] + d["scaffold"] == 50


# ---------------------------------------------------------------------------
# Register truth enforced at runtime
# ---------------------------------------------------------------------------

def test_blocked_module_refuses_execution():
    orch = StephanieOrchestrator()
    d = orch.execute("swap_execution", "swap", {"amount": 1})
    assert d.outcome is Outcome.REFUSED
    assert "blocked" in d.reason


def test_legal_hold_module_refuses_execution():
    orch = StephanieOrchestrator()
    d = orch.execute("real_estate_nft", "mint")
    assert d.outcome is Outcome.REFUSED
    assert "legal_hold" in d.reason


def test_claimed_module_refuses_execution():
    orch = StephanieOrchestrator()
    d = orch.execute("avatar_gpu_layer", "render")
    assert d.outcome is Outcome.REFUSED
    assert "CLAIMED" in d.reason


def test_unknown_module_fails_closed():
    orch = StephanieOrchestrator()
    d = orch.execute("totally_unknown", "anything")
    assert d.outcome is Outcome.REFUSED
    assert d.truth_tag == "BLOCKED"


def test_scaffold_module_reports_not_executable():
    orch = StephanieOrchestrator()
    d = orch.execute("bidhunter_pro", "match_bids")
    assert d.outcome is Outcome.NOT_EXECUTABLE
    assert "scaffold" in d.reason


def test_demo_module_output_tagged_simulated():
    orch = StephanieOrchestrator()
    d = orch.execute("sales_sim_layer", "run_simulation", {"seed": 7, "team_size": 4, "lead_count": 5})
    assert d.outcome is Outcome.EXECUTED
    assert d.truth_tag == "SIMULATED"
    assert d.result and d.result["truth_tag"] == "SIMULATED"


# ---------------------------------------------------------------------------
# Working implementations
# ---------------------------------------------------------------------------

def test_roofing_takeoff_math():
    # 40x25 plane at 7/12: factor = sqrt(1+(7/12)^2) ≈ 1.158, area ≈ 1158 sf.
    plane = RoofPlane(length_ft=40, width_ft=25, pitch_rise=7)
    assert plane.pitch_factor == pytest.approx(1.1577, abs=1e-3)
    result = takeoff({
        "planes": [{"length_ft": 40, "width_ft": 25, "pitch_rise": 7}],
        "complexity": "gable",
    })
    assert result["adjusted_area_sf"] == pytest.approx(1157.7, abs=0.5)
    assert result["squares"] == pytest.approx(11.58, abs=0.01)
    # 10% gable waste -> ~12.73 order squares -> 39 bundles (ceil 38.2).
    assert result["order_squares"] == pytest.approx(12.73, abs=0.01)
    assert result["shingle_bundles"] == 39
    assert result["ice_water_rolls"] == 1  # 40 lf eaves * 3 ft = 120 sf


def test_roofing_takeoff_rejects_bad_input():
    with pytest.raises(ValueError):
        takeoff({"planes": [], "complexity": "gable"})
    with pytest.raises(ValueError):
        takeoff({"planes": [{"length_ft": 40, "width_ft": 25}], "complexity": "weird"})


def test_change_order_chain_is_tamper_evident():
    ledger = ChangeOrderLedger()
    ledger.append(job_id="J1", co_number="CO-1", event="created",
                  description="Add skylight", amount_delta=2400, actor="estimator")
    ledger.append(job_id="J1", co_number="CO-1", event="approved",
                  description="Client approved", amount_delta=0, actor="Mike O'Rourke")
    assert ledger.verify() is True
    assert ledger.net_delta("J1") == 2400
    # Tamper with history -> chain breaks.
    object.__setattr__(ledger._events[0], "amount_delta", 9999.0)
    assert ledger.verify() is False


def test_change_order_approval_requires_named_actor():
    ledger = ChangeOrderLedger()
    with pytest.raises(ValueError, match="named human"):
        ledger.append(job_id="J1", co_number="CO-1", event="approved",
                      description="", amount_delta=0, actor="")


# ---------------------------------------------------------------------------
# Decision log
# ---------------------------------------------------------------------------

def test_every_decision_is_logged_and_chained():
    orch = StephanieOrchestrator()
    orch.execute("roofing_takeoff", "takeoff", {
        "planes": [{"length_ft": 30, "width_ft": 20, "pitch_rise": 6}],
    })
    orch.execute("swap_execution", "swap")        # refusal — still logged
    orch.execute("unknown_module", "x")           # fail-closed — still logged
    log = orch.decision_log()
    assert len(log) == 3
    assert orch.verify_log() is True
    assert log[1]["prev_hash"] == log[0]["decision_hash"]
