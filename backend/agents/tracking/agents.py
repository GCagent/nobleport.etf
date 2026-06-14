"""
NoblePort OS — The Ten Internal Tracking Agents

Concrete implementations of each agent declared in ``config.json``. Every agent
turns one field ``Signal`` into structured ``AgentOutput`` records that match the
"outputs" list in its spec. Logic is deterministic and side-effect-free so the
agents run on edge hardware and are fully unit-testable.

Cross-agent agents (Subcontractor, Daily Field) consume the outputs of the
others rather than raw field signals; the registry feeds them.
"""

from __future__ import annotations

from typing import Any

from backend.agents.tracking.base import AgentOutput, Severity, Signal, TrackingAgent
from backend.agents.tracking.framing import estimate_wall_framing


def _num(payload: dict[str, Any], key: str, default: float = 0.0) -> float:
    try:
        return float(payload.get(key, default))
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# 1. Schedule Agent
# ---------------------------------------------------------------------------

class ScheduleAgent(TrackingAgent):
    """Auto-updates the schedule from RFID/IoT scans; forecasts and flags delay."""

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        task = p.get("task_id", "unknown-task")
        pct = max(0.0, min(100.0, _num(p, "percent_complete")))
        planned_pct = max(0.0, min(100.0, _num(p, "planned_percent_complete", pct)))
        slip_days = _num(p, "predicted_slip_days")

        outputs = [
            self._emit(
                "Real-time Gantt chart updates",
                f"Task {task} progress {pct:.0f}% (plan {planned_pct:.0f}%) "
                f"from {signal.source}",
                data={"task_id": task, "percent_complete": pct,
                      "planned_percent_complete": planned_pct, "zone": p.get("zone")},
            )
        ]

        behind = planned_pct - pct
        if slip_days > 0 or behind >= 10:
            sev = Severity.CRITICAL if slip_days >= 5 else Severity.HIGH if slip_days > 0 else Severity.MEDIUM
            outputs.append(self._emit(
                "Delay alerts with predicted impact",
                f"Task {task} is {behind:.0f}% behind plan; predicted slip "
                f"{slip_days:.1f} day(s)",
                severity=sev,
                data={"task_id": task, "behind_pct": behind, "predicted_slip_days": slip_days},
            ))
            outputs.append(self._emit(
                "Recovery recommendations",
                f"Recommend resequencing successors of {task} and adding a shift "
                f"to recover ~{max(slip_days, behind / 20):.1f} day(s)",
                data={"task_id": task,
                      "actions": ["add_shift", "resequence_successors", "expedite_long_lead"]},
            ))
        return outputs


# ---------------------------------------------------------------------------
# 2. Cost Agent
# ---------------------------------------------------------------------------

class CostAgent(TrackingAgent):
    """Real-time earned-value analysis, overrun forecast, change-order sim."""

    HIGH_COST_OUTPUTS = frozenset({"Change order impact simulation"})

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload

        # Framing-scope baseline helper (feeds the budget baseline input source).
        if signal.kind == "framing_estimate":
            est = estimate_wall_framing(_num(p, "square_feet"), p.get("zip_code"))
            return [self._emit(
                "Earned value (EV, AC, PV) dashboard",
                f"Wall framing baseline: ${est.total_low:,.0f}–${est.total_high:,.0f} "
                f"(${est.cost_per_sf_low:.2f}–${est.cost_per_sf_high:.2f}/SF) "
                f"for {est.square_feet:.0f} SF",
                data={"framing_estimate": est.to_dict()},
            )]

        pv = _num(p, "pv")   # planned value (BCWS)
        ev = _num(p, "ev")   # earned value (BCWP)
        ac = _num(p, "ac")   # actual cost (ACWP)
        bac = _num(p, "bac", pv)  # budget at completion

        cpi = ev / ac if ac else 1.0
        spi = ev / pv if pv else 1.0
        eac = bac / cpi if cpi else bac
        vac = bac - eac

        outputs = [self._emit(
            "Earned value (EV, AC, PV) dashboard",
            f"EV ${ev:,.0f} / AC ${ac:,.0f} / PV ${pv:,.0f} — "
            f"CPI {cpi:.2f}, SPI {spi:.2f}",
            data={"pv": pv, "ev": ev, "ac": ac, "bac": bac,
                  "cpi": round(cpi, 3), "spi": round(spi, 3),
                  "eac": round(eac, 2), "vac": round(vac, 2)},
        )]

        if cpi < 1.0 and vac < 0:
            sev = Severity.CRITICAL if cpi < 0.85 else Severity.HIGH if cpi < 0.95 else Severity.MEDIUM
            outputs.append(self._emit(
                "Cost overrun forecast with LLM explanation",
                f"Projected overrun ${abs(vac):,.0f} at completion (CPI {cpi:.2f}). "
                f"Drivers: spend outpacing earned value; review labor productivity "
                f"and material waste.",
                severity=sev,
                data={"forecast_overrun": round(abs(vac), 2), "eac": round(eac, 2),
                      "cpi": round(cpi, 3)},
            ))

        if "change_order_amount" in p:
            co = _num(p, "change_order_amount")
            new_bac = bac + co
            new_eac = new_bac / cpi if cpi else new_bac
            outputs.append(self._emit(
                "Change order impact simulation",
                f"Change order ${co:,.0f} shifts EAC to ${new_eac:,.0f} "
                f"(Δ ${new_eac - eac:,.0f})",
                severity=Severity.MEDIUM,
                data={"change_order_amount": co, "new_bac": new_bac,
                      "new_eac": round(new_eac, 2)},
            ))
        return outputs


# ---------------------------------------------------------------------------
# 3. Document Agent
# ---------------------------------------------------------------------------

class DocumentAgent(TrackingAgent):
    """Classifies inbound docs, routes for approval, tracks deadlines."""

    _CLASS_RULES = [
        ("RFI", ("rfi", "request for information", "clarification")),
        ("Submittal", ("submittal", "shop drawing", "product data", "sample")),
        ("Change Order", ("change order", "change-order", " co ", "co#", "co-")),
        ("Invoice", ("invoice", "pay app", "payment application")),
        ("Inspection", ("inspection", "punch", "ncr")),
    ]
    _ROUTING = {
        "RFI": "Project Engineer", "Submittal": "Architect / EOR",
        "Change Order": "Project Manager", "Invoice": "Accounting",
        "Inspection": "Superintendent", "Other": "Document Controller",
    }

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        text = " ".join(str(p.get(k, "")) for k in ("filename", "subject", "body")).lower()
        text = f" {text} "

        doc_type = "Other"
        for label, keywords in self._CLASS_RULES:
            if any(kw in text for kw in keywords):
                doc_type = label
                break

        role = self._ROUTING[doc_type]
        outputs = [
            self._emit(
                "Auto-tagged documents (RFI, submittal, CO, etc.)",
                f"Classified '{p.get('filename', 'document')}' as {doc_type}",
                data={"doc_type": doc_type, "filename": p.get("filename")},
            ),
            self._emit(
                "Routing suggestions to responsible person/role",
                f"Route {doc_type} to {role}",
                data={"doc_type": doc_type, "route_to": role},
            ),
        ]

        days_left = p.get("days_until_due")
        if days_left is not None:
            d = _num(p, "days_until_due")
            if d < 0:
                outputs.append(self._emit(
                    "Deadline reminders and overdue alerts",
                    f"{doc_type} OVERDUE by {abs(d):.0f} day(s) — escalate to {role}",
                    severity=Severity.HIGH,
                    data={"doc_type": doc_type, "days_overdue": abs(d)},
                ))
            elif d <= 2:
                outputs.append(self._emit(
                    "Deadline reminders and overdue alerts",
                    f"{doc_type} due in {d:.0f} day(s) — reminder sent to {role}",
                    severity=Severity.MEDIUM,
                    data={"doc_type": doc_type, "days_until_due": d},
                ))
        return outputs


# ---------------------------------------------------------------------------
# 4. Inventory Agent
# ---------------------------------------------------------------------------

class InventoryAgent(TrackingAgent):
    """Just-in-time reorder triggers from drone/scale counts."""

    HIGH_COST_OUTPUTS = frozenset({"Auto-generated purchase order (draft)"})

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        material = p.get("material", "material")
        on_hand = _num(p, "on_hand")
        reorder_point = _num(p, "reorder_point")
        daily_usage = _num(p, "daily_usage")
        target_days = _num(p, "target_cover_days", 14)

        if on_hand > reorder_point:
            days_cover = on_hand / daily_usage if daily_usage else float("inf")
            return [self._emit(
                "Low-stock alerts with reorder quantity",
                f"{material} OK: {on_hand:.0f} on hand "
                f"({days_cover:.1f} days cover)",
                data={"material": material, "on_hand": on_hand, "status": "ok"},
            )]

        reorder_qty = max(0.0, daily_usage * target_days + reorder_point - on_hand)
        outputs = [self._emit(
            "Low-stock alerts with reorder quantity",
            f"{material} LOW: {on_hand:.0f} ≤ reorder point {reorder_point:.0f}; "
            f"reorder {reorder_qty:.0f}",
            severity=Severity.HIGH,
            data={"material": material, "on_hand": on_hand,
                  "reorder_point": reorder_point, "reorder_quantity": reorder_qty},
        )]
        outputs.append(self._emit(
            "Auto-generated purchase order (draft)",
            f"DRAFT PO: {reorder_qty:.0f} {p.get('unit', 'units')} of {material} "
            f"to {p.get('supplier', 'preferred supplier')}",
            severity=Severity.MEDIUM,
            data={"material": material, "quantity": reorder_qty,
                  "supplier": p.get("supplier"), "status": "draft"},
        ))
        return outputs


# ---------------------------------------------------------------------------
# 5. Equipment Agent
# ---------------------------------------------------------------------------

class EquipmentAgent(TrackingAgent):
    """Predictive maintenance from vibration/temperature/runtime sensors."""

    HIGH_COST_OUTPUTS = frozenset({"Maintenance work order generation"})

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        asset = p.get("asset_id", "asset")
        vibration = _num(p, "vibration_mm_s")     # ISO 10816 velocity
        temp = _num(p, "temp_c")
        hours = _num(p, "hours")
        service_interval = _num(p, "service_interval_hours", 250)

        # Health score: penalize high vibration / temperature, ascending hours.
        vib_pen = max(0.0, (vibration - 2.8) / 4.5)        # >2.8 mm/s degrades
        temp_pen = max(0.0, (temp - 85) / 30)              # >85C degrades
        wear = (hours % service_interval) / service_interval if service_interval else 0
        risk = min(1.0, vib_pen + temp_pen + wear * 0.5)
        rul_hours = max(0.0, service_interval - (hours % service_interval))

        outputs = [self._emit(
            "Remaining useful life (RUL) forecast",
            f"{asset}: ~{rul_hours:.0f}h to next service; risk index {risk:.2f}",
            data={"asset_id": asset, "rul_hours": round(rul_hours, 1),
                  "risk_index": round(risk, 3), "vibration_mm_s": vibration, "temp_c": temp},
        )]

        if risk >= 0.6 or rul_hours <= 20:
            sev = Severity.CRITICAL if risk >= 0.85 else Severity.HIGH
            outputs.append(self._emit(
                "Maintenance work order generation",
                f"WORK ORDER: service {asset} — vibration {vibration:.1f} mm/s, "
                f"temp {temp:.0f}°C, {rul_hours:.0f}h remaining",
                severity=sev,
                data={"asset_id": asset, "priority": "urgent" if risk >= 0.85 else "high"},
            ))
            outputs.append(self._emit(
                "Downtime risk alert",
                f"{asset} downtime risk {risk:.0%} — stage standby unit",
                severity=sev,
                data={"asset_id": asset, "downtime_risk": round(risk, 3)},
            ))
        return outputs


# ---------------------------------------------------------------------------
# 6. Labor Agent  (privacy-preserving)
# ---------------------------------------------------------------------------

class LaborAgent(TrackingAgent):
    """Attendance + productivity heatmaps from anonymized role IDs only."""

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        # Privacy: never propagate raw identifiers; keep only an anonymized role ID.
        role_id = p.get("anonymized_id") or p.get("role_id") or "role-unknown"
        zone = p.get("zone", "zone")
        active = _num(p, "active_minutes")
        idle = _num(p, "idle_minutes")
        headcount = int(_num(p, "headcount", 1))
        total = active + idle
        efficiency = active / total if total else 0.0

        outputs = [
            self._emit(
                "Real-time attendance dashboard",
                f"{headcount} present in {zone} (role {role_id})",
                data={"zone": zone, "headcount": headcount, "role_id": role_id},
            ),
            self._emit(
                "Productivity heatmap (zones with high/low efficiency)",
                f"{zone} efficiency {efficiency:.0%}",
                data={"zone": zone, "efficiency": round(efficiency, 3),
                      "band": "high" if efficiency >= 0.75 else "low" if efficiency < 0.5 else "mid"},
            ),
        ]
        if total and efficiency < 0.5:
            outputs.append(self._emit(
                "Anomaly alerts (e.g., idle time spike)",
                f"Idle-time spike in {zone}: {idle:.0f} idle min vs {active:.0f} active",
                severity=Severity.MEDIUM,
                data={"zone": zone, "idle_minutes": idle, "efficiency": round(efficiency, 3)},
            ))
        return outputs


# ---------------------------------------------------------------------------
# 7. Quality Agent
# ---------------------------------------------------------------------------

class QualityAgent(TrackingAgent):
    """AI-vision inspection: defect detection, NCR drafting, pass/fail."""

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        point = p.get("inspection_point", "point")
        defects = p.get("defects") or []
        if not isinstance(defects, list):
            defects = [defects]
        max_conf = max((_num(d if isinstance(d, dict) else {}, "confidence")
                        for d in defects if isinstance(d, dict)), default=0.0)
        threshold = _num(p, "confidence_threshold", 0.6)
        failing = [d for d in defects if isinstance(d, dict)
                   and _num(d, "confidence") >= threshold]

        passed = not failing
        outputs = [self._emit(
            "Pass/fail per inspection point",
            f"{point}: {'PASS' if passed else 'FAIL'} "
            f"({len(failing)} defect(s) ≥ {threshold:.0%})",
            severity=Severity.INFO if passed else Severity.HIGH,
            data={"inspection_point": point, "result": "pass" if passed else "fail",
                  "defect_count": len(failing)},
        )]
        if failing:
            kinds = ", ".join(sorted({str(d.get("type", "defect")) for d in failing}))
            outputs.append(self._emit(
                "Defect detection (cracks, spacing violations, porosity)",
                f"{point}: detected {kinds} (max confidence {max_conf:.0%})",
                severity=Severity.HIGH,
                data={"inspection_point": point, "defects": failing},
            ))
            outputs.append(self._emit(
                "Non-conformance report (NCR) draft",
                f"DRAFT NCR for {point}: {kinds} — corrective action required",
                severity=Severity.HIGH,
                data={"inspection_point": point, "status": "draft", "defects": failing},
            ))
        return outputs


# ---------------------------------------------------------------------------
# 8. Safety Agent
# ---------------------------------------------------------------------------

class SafetyAgent(TrackingAgent):
    """Real-time PPE violation alerts, near-miss mining, root-cause reports."""

    _PPE = {"hardhat": "hard hat", "vest": "hi-vis vest", "harness": "fall harness",
            "gloves": "gloves", "glasses": "safety glasses"}

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        zone = p.get("zone", "zone")
        missing = [self._PPE.get(m, m) for m in (p.get("missing_ppe") or [])]
        gas_ppm = _num(p, "gas_ppm")
        fall = bool(p.get("fall_detected"))
        near_misses = int(_num(p, "near_miss_count_7d"))

        outputs: list[AgentOutput] = []
        if missing:
            outputs.append(self._emit(
                "Live PPE violation alerts (hardhat, vest, harness)",
                f"PPE violation in {zone}: missing {', '.join(missing)}",
                severity=Severity.HIGH,
                data={"zone": zone, "missing_ppe": missing},
            ))
        if gas_ppm >= _num(p, "gas_threshold_ppm", 35) or fall:
            outputs.append(self._emit(
                "Live PPE violation alerts (hardhat, vest, harness)",
                f"CRITICAL in {zone}: "
                + ("fall detected " if fall else "")
                + (f"gas {gas_ppm:.0f}ppm" if gas_ppm else ""),
                severity=Severity.CRITICAL,
                data={"zone": zone, "gas_ppm": gas_ppm, "fall_detected": fall},
            ))
        if near_misses >= 3:
            outputs.append(self._emit(
                "Near-miss pattern detection",
                f"{near_misses} near-misses in {zone} over 7 days — rising pattern",
                severity=Severity.MEDIUM,
                data={"zone": zone, "near_miss_count_7d": near_misses},
            ))
        if p.get("incident"):
            outputs.append(self._emit(
                "Root-cause analysis report (LLM-generated)",
                f"Root-cause draft for incident in {zone}: "
                f"{p.get('incident')} — see contributing factors",
                severity=Severity.HIGH,
                data={"zone": zone, "incident": p.get("incident"),
                      "method": "5-why / fishbone"},
            ))
        if not outputs:
            outputs.append(self._emit(
                "Live PPE violation alerts (hardhat, vest, harness)",
                f"{zone}: all clear (PPE compliant, sensors nominal)",
                data={"zone": zone, "status": "clear"},
            ))
        return outputs


# ---------------------------------------------------------------------------
# 9. Subcontractor Agent  (cross-agent aggregation)
# ---------------------------------------------------------------------------

class SubcontractorAgent(TrackingAgent):
    """
    Daily scorecard (0–100) per sub from schedule/quality/safety telemetry.

    Expects an aggregated payload (the registry assembles it from the other
    agents' outputs):
        schedule_adherence: 0..1   (actual vs plan)
        quality_pass_rate:  0..1
        safety_violations:  int    (count in window)
    Optionally ``previous_score`` for trend.
    """

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        sub = signal.subcontractor_id or p.get("subcontractor_id", "sub")
        adherence = max(0.0, min(1.0, _num(p, "schedule_adherence", 1.0)))
        quality = max(0.0, min(1.0, _num(p, "quality_pass_rate", 1.0)))
        violations = int(_num(p, "safety_violations"))

        # Weighted: schedule 40, quality 35, safety 25 (penalized per violation).
        safety_score = max(0.0, 1.0 - 0.1 * violations)
        score = 100 * (0.40 * adherence + 0.35 * quality + 0.25 * safety_score)
        score = round(score, 1)

        outputs = [self._emit(
            "Daily subcontractor performance score (0–100)",
            f"{sub} score {score}/100 "
            f"(sched {adherence:.0%}, qual {quality:.0%}, {violations} viol.)",
            data={"subcontractor_id": sub, "score": score,
                  "schedule_adherence": adherence, "quality_pass_rate": quality,
                  "safety_violations": violations},
        )]
        outputs[0].subcontractor_id = sub

        prev = p.get("previous_score")
        if prev is not None:
            delta = score - _num(p, "previous_score")
            trend = "improving" if delta > 1 else "declining" if delta < -1 else "stable"
            out = self._emit(
                "Trend analysis (improving/declining)",
                f"{sub} trend {trend} ({delta:+.1f} vs prior)",
                data={"subcontractor_id": sub, "delta": round(delta, 1), "trend": trend},
            )
            out.subcontractor_id = sub
            outputs.append(out)

        if score < 70 or violations >= 3:
            out = self._emit(
                "Automated flag for contract review",
                f"FLAG {sub}: score {score}/100"
                + (f", {violations} safety violations" if violations >= 3 else ""),
                severity=Severity.HIGH,
                data={"subcontractor_id": sub, "score": score, "reason": "below_threshold"},
            )
            out.subcontractor_id = sub
            outputs.append(out)
        return outputs


# ---------------------------------------------------------------------------
# 10. Daily Field Agent  (cross-agent rollup)
# ---------------------------------------------------------------------------

class DailyFieldAgent(TrackingAgent):
    """
    End-of-shift narrative report rolling up every other agent's outputs.

    Expects payload:
        agent_outputs: list[dict]  (serialized AgentOutput records for the day)
        weather: dict              ({"summary","temp_f","precip_in"})
        photo_count: int
    """

    def _process(self, signal: Signal) -> list[AgentOutput]:
        p = signal.payload
        items = p.get("agent_outputs") or []
        alerts = [o for o in items if isinstance(o, dict) and o.get("alert")]
        by_agent: dict[str, int] = {}
        for o in items:
            if isinstance(o, dict):
                by_agent[o.get("agent_name", "?")] = by_agent.get(o.get("agent_name", "?"), 0) + 1

        weather = p.get("weather") or {}
        wx = weather.get("summary", "no data")
        precip = _num(weather, "precip_in")

        narrative = (
            f"Daily field report — {len(items)} agent events across "
            f"{len(by_agent)} systems; {len(alerts)} alert(s). "
            f"Weather: {wx}."
        )
        outputs = [self._emit(
            "Narrative daily report (LLM-generated)",
            narrative,
            severity=Severity.HIGH if alerts else Severity.INFO,
            data={"event_count": len(items), "alert_count": len(alerts),
                  "by_agent": by_agent},
        )]

        photos = int(_num(p, "photo_count"))
        if photos:
            outputs.append(self._emit(
                "Photo summary with captions",
                f"{photos} progress photo(s) captioned for timelapse",
                data={"photo_count": photos},
            ))

        impact = "weather delay likely" if precip >= 0.25 else "no weather impact"
        outputs.append(self._emit(
            "Weather integration and impact note",
            f"{wx} — {impact}",
            severity=Severity.MEDIUM if precip >= 0.25 else Severity.INFO,
            data={"weather": weather, "impact": impact},
        ))
        return outputs


# Registry-friendly map of config id -> implementation class.
AGENT_CLASSES: dict[str, type[TrackingAgent]] = {
    "agent_schedule": ScheduleAgent,
    "agent_cost": CostAgent,
    "agent_document": DocumentAgent,
    "agent_inventory": InventoryAgent,
    "agent_equipment": EquipmentAgent,
    "agent_labor": LaborAgent,
    "agent_quality": QualityAgent,
    "agent_safety": SafetyAgent,
    "agent_subcontractor": SubcontractorAgent,
    "agent_daily_field": DailyFieldAgent,
}
