"""
Tests for the internal construction tracking agents.

Covers config integrity, trigger parsing, each agent's output contract,
the high-cost human-approval gate, cross-agent rollups (subcontractor
scorecard + daily field report), retention sweeps, and the wall-framing
cost estimator against its RSMeans-style reference basis.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.agents.tracking import (
    Severity,
    Signal,
    TrackingMesh,
    create_tracking_mesh,
    estimate_wall_framing,
    load_config,
)
from backend.agents.tracking.agents import AGENT_CLASSES
from backend.agents.tracking.spec import TriggerKind


# --------------------------------------------------------------------------
# Config integrity
# --------------------------------------------------------------------------

def test_config_loads_ten_agents():
    cfg = load_config()
    assert cfg.system == "AI Construction Internal Tracking Agents"
    assert len(cfg.agents) == 10
    assert {s.id for s in cfg.agents} == set(AGENT_CLASSES)


def test_every_agent_has_an_implementation():
    mesh = create_tracking_mesh()
    assert len(mesh.agents) == 10
    for spec in mesh.config.agents:
        assert mesh.get(spec.id).name == spec.name


def test_trigger_parsing():
    cfg = load_config()
    triggers = {s.id: s.parsed_trigger for s in cfg.agents}
    assert triggers["agent_cost"].kind == TriggerKind.HOURLY
    assert triggers["agent_inventory"].kind == TriggerKind.DAILY
    assert "06:00" in triggers["agent_inventory"].times
    assert triggers["agent_inventory"].on_demand is True
    assert triggers["agent_schedule"].kind == TriggerKind.CONTINUOUS
    # Safety: "< 1 sec latency" -> 1000 ms
    assert triggers["agent_safety"].max_latency_ms == 1000


def test_global_settings_helpers():
    cfg = load_config()
    gs = cfg.global_settings
    assert "Slack" in gs.alert_channels
    assert gs.requires_human_for_high_cost is True


# --------------------------------------------------------------------------
# Individual agents
# --------------------------------------------------------------------------

def test_schedule_agent_flags_delay_and_recovery():
    mesh = create_tracking_mesh()
    sig = Signal(
        source="RFID tags on materials/equipment",
        kind="scan",
        payload={"task_id": "T-100", "percent_complete": 40,
                 "planned_percent_complete": 65, "predicted_slip_days": 6},
    )
    out = mesh.dispatch(sig)
    types = {o.output_type for o in out}
    assert "Delay alerts with predicted impact" in types
    assert "Recovery recommendations" in types
    delay = next(o for o in out if o.output_type == "Delay alerts with predicted impact")
    assert delay.severity == Severity.CRITICAL
    assert delay.alert is True


def test_cost_agent_earned_value_and_overrun():
    agent = create_tracking_mesh().get("agent_cost")
    out = agent.process(Signal(
        source="Budget baseline", kind="ev",
        payload={"pv": 100000, "ev": 80000, "ac": 100000, "bac": 200000},
    ))
    dash = next(o for o in out if o.output_type.startswith("Earned value"))
    assert dash.data["cpi"] == 0.8
    overrun = next(o for o in out if o.output_type.startswith("Cost overrun"))
    assert overrun.data["forecast_overrun"] == 50000.0  # EAC 250k - BAC 200k


def test_cost_agent_change_order_requires_human_approval():
    agent = create_tracking_mesh().get("agent_cost")
    out = agent.process(Signal(
        source="Budget baseline", kind="ev",
        payload={"pv": 100000, "ev": 100000, "ac": 100000, "bac": 100000,
                 "change_order_amount": 25000},
    ))
    co = next(o for o in out if o.output_type == "Change order impact simulation")
    assert co.requires_human_approval is True


def test_document_agent_classifies_and_routes():
    agent = create_tracking_mesh().get("agent_document")
    out = agent.process(Signal(
        source="Email inbox", kind="file",
        payload={"filename": "RFI-042.pdf", "subject": "Request for information",
                 "days_until_due": -1},
    ))
    tag = next(o for o in out if o.output_type.startswith("Auto-tagged"))
    assert tag.data["doc_type"] == "RFI"
    route = next(o for o in out if o.output_type.startswith("Routing"))
    assert route.data["route_to"] == "Project Engineer"
    overdue = next(o for o in out if o.output_type.startswith("Deadline"))
    assert overdue.severity == Severity.HIGH


def test_inventory_agent_drafts_po_with_approval_gate():
    agent = create_tracking_mesh().get("agent_inventory")
    out = agent.process(Signal(
        source="Smart scale readings at storage bins", kind="count",
        payload={"material": "2x4 studs", "on_hand": 50, "reorder_point": 100,
                 "daily_usage": 40, "target_cover_days": 10, "unit": "ea",
                 "supplier": "ABC Lumber"},
    ))
    po = next(o for o in out if o.output_type.startswith("Auto-generated purchase order"))
    assert po.data["quantity"] == 450.0  # 40*10 + 100 - 50
    assert po.requires_human_approval is True


def test_equipment_agent_generates_work_order_on_risk():
    agent = create_tracking_mesh().get("agent_equipment")
    out = agent.process(Signal(
        source="IoT sensor data (vibration, temp, hours)", kind="stream",
        payload={"asset_id": "EXC-7", "vibration_mm_s": 9.0, "temp_c": 110,
                 "hours": 245, "service_interval_hours": 250},
    ))
    wo = next(o for o in out if o.output_type.startswith("Maintenance work order"))
    assert wo.severity in (Severity.HIGH, Severity.CRITICAL)
    assert wo.requires_human_approval is True


def test_labor_agent_is_privacy_preserving():
    agent = create_tracking_mesh().get("agent_labor")
    out = agent.process(Signal(
        source="Wearable motion sensors", kind="motion",
        payload={"name": "John Doe", "anonymized_id": "role-7", "zone": "Level 3",
                 "active_minutes": 20, "idle_minutes": 60, "headcount": 4},
    ))
    blob = " ".join(str(o.model_dump()) for o in out)
    assert "John Doe" not in blob          # no PII propagated
    assert "role-7" in blob
    anomaly = next(o for o in out if o.output_type.startswith("Anomaly"))
    assert anomaly.severity == Severity.MEDIUM


def test_quality_agent_drafts_ncr_on_fail():
    agent = create_tracking_mesh().get("agent_quality")
    out = agent.process(Signal(
        source="Fixed cameras", kind="image",
        payload={"inspection_point": "Pour-12",
                 "defects": [{"type": "crack", "confidence": 0.91}],
                 "confidence_threshold": 0.6},
    ))
    pf = next(o for o in out if o.output_type.startswith("Pass/fail"))
    assert pf.data["result"] == "fail"
    assert any(o.output_type.startswith("Non-conformance") for o in out)


def test_safety_agent_critical_on_fall():
    agent = create_tracking_mesh().get("agent_safety")
    out = agent.process(Signal(
        source="Wearable gas/fall sensors", kind="sensor",
        payload={"zone": "Roof", "fall_detected": True, "missing_ppe": ["harness"]},
    ))
    assert any(o.severity == Severity.CRITICAL for o in out)


# --------------------------------------------------------------------------
# Cross-agent rollups
# --------------------------------------------------------------------------

def test_subcontractor_scorecard_and_flag():
    mesh = create_tracking_mesh()
    out = mesh.score_subcontractors({
        "SUB-A": {"schedule_adherence": 0.95, "quality_pass_rate": 0.98,
                  "safety_violations": 0, "previous_score": 90},
        "SUB-B": {"schedule_adherence": 0.6, "quality_pass_rate": 0.7,
                  "safety_violations": 4, "previous_score": 80},
    })
    flags = [o for o in out if o.output_type.startswith("Automated flag")]
    assert len(flags) == 1
    assert flags[0].subcontractor_id == "SUB-B"
    trends = {o.subcontractor_id: o.data["trend"]
              for o in out if o.output_type.startswith("Trend")}
    assert trends["SUB-B"] == "declining"


def test_daily_field_report_rolls_up_alerts():
    mesh = create_tracking_mesh()
    days = mesh.dispatch(Signal(
        source="Edge AI cameras", kind="sensor",
        payload={"zone": "Roof", "fall_detected": True},
    ))
    report = mesh.daily_field_report(
        days, weather={"summary": "Rain", "precip_in": 0.5}, photo_count=12,
    )
    narrative = next(o for o in report if o.output_type.startswith("Narrative"))
    assert narrative.data["alert_count"] >= 1
    wx = next(o for o in report if o.output_type.startswith("Weather"))
    assert wx.data["impact"] == "weather delay likely"


# --------------------------------------------------------------------------
# Retention
# --------------------------------------------------------------------------

def test_retention_sweep_respects_per_agent_window():
    mesh = create_tracking_mesh()
    # Labor retains 60 days; stamp an output 61 days old.
    out = mesh.get("agent_labor").process(Signal(
        source="Wearable motion sensors", kind="motion",
        payload={"zone": "Z", "active_minutes": 50, "idle_minutes": 10},
    ))[0]
    now = datetime.now(timezone.utc)
    out.retain_until = now - timedelta(days=1)
    retained, expired = mesh.sweep_expired([out], now=now)
    assert out in expired and out not in retained


def test_summary_reports_config():
    summary = create_tracking_mesh().summary()
    assert summary["agent_count"] == 10
    assert summary["retention_days"]["agent_document"] == 730
    assert summary["triggers"]["continuous"] >= 4


# --------------------------------------------------------------------------
# Wall framing estimator
# --------------------------------------------------------------------------

def test_framing_estimate_matches_reference_basis():
    est = estimate_wall_framing(125, zip_code="47474")
    assert round(est.total_low) == 504
    assert round(est.total_high) == 825
    assert round(est.cost_per_sf_low, 2) == 4.03
    assert round(est.cost_per_sf_high, 2) == 6.60
    assert est.labor_hours == 4.4
    # supplies billed with waste overage (134 SF for a 125 SF wall)
    supplies = next(li for li in est.line_items if li.unit == "SF")
    assert supplies.quantity == 134


def test_framing_estimate_scales_linearly():
    est = estimate_wall_framing(250)
    # labor + supplies scale; equipment is a fixed allowance so per-SF dips slightly
    assert est.cost_per_sf_low < 4.03
    assert est.total_low > 504


def test_cost_agent_consumes_framing_estimate():
    agent = create_tracking_mesh().get("agent_cost")
    out = agent.process(Signal(
        source="Budget baseline", kind="framing_estimate",
        payload={"square_feet": 125, "zip_code": "47474"},
    ))
    assert out[0].data["framing_estimate"]["total_high"] == 825.0
