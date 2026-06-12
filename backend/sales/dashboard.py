"""
NoblePort Sales Dashboard v1

Defines the metric catalog the sales model is built on — the lead, sales,
financial, and market signals captured for every opportunity — and aggregates a
simulation (or, later, real data) into dashboard-shaped output.

The metric definitions are the durable part: they are the schema NoblePort
collects against so that, once production data exists, the dashboard and the
GPPI/routing engines run on the exact same fields the simulation does.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.sales.collaboration import collaboration_map
from backend.sales.governance import governance_matrix
from backend.sales.hierarchy import RevenueTier, lines_in_tier
from backend.sales.lead_routing import LeadGrade
from backend.sales.simulation import MARKETS, SalesSimulation


@dataclass(frozen=True)
class MetricDef:
    key: str
    label: str
    group: str
    unit: str  # "currency" | "percent" | "count" | "hours" | "score" | "text"


# The metric catalog, mirrored from the v1 dashboard spec. Capturing all of
# these per opportunity is the precondition for a NoblePort-specific model.
METRIC_CATALOG: tuple[MetricDef, ...] = (
    # Lead metrics
    MetricDef("lead_source", "Lead Source", "lead", "text"),
    MetricDef("town", "Town", "lead", "text"),
    MetricDef("project_type", "Project Type", "lead", "text"),
    MetricDef("lead_value", "Lead Value", "lead", "currency"),
    MetricDef("response_time", "Response Time", "lead", "hours"),
    # Sales metrics
    MetricDef("appointment_set", "Appointment Set", "sales", "count"),
    MetricDef("estimate_delivered", "Estimate Delivered", "sales", "count"),
    MetricDef("follow_up_count", "Follow Up Count", "sales", "count"),
    MetricDef("contract_signed", "Contract Signed", "sales", "count"),
    MetricDef("deposit_received", "Deposit Received", "sales", "count"),
    # Financial metrics
    MetricDef("revenue", "Revenue", "financial", "currency"),
    MetricDef("gross_profit", "Gross Profit", "financial", "currency"),
    MetricDef("gross_margin_pct", "Gross Margin %", "financial", "percent"),
    MetricDef("average_job_size", "Average Job Size", "financial", "currency"),
    MetricDef("lifetime_client_value", "Lifetime Client Value", "financial", "currency"),
)


def metric_groups() -> dict[str, list[dict[str, str]]]:
    """The metric catalog grouped for UI rendering."""
    groups: dict[str, list[dict[str, str]]] = {}
    for m in METRIC_CATALOG:
        groups.setdefault(m.group, []).append(
            {"key": m.key, "label": m.label, "unit": m.unit}
        )
    return groups


def hierarchy_view() -> list[dict[str, object]]:
    """The revenue hierarchy grouped by tier, for the dashboard sidebar/cards."""
    view: list[dict[str, object]] = []
    for tier in RevenueTier:
        lines = lines_in_tier(tier)
        view.append({
            "tier": int(tier),
            "lines": [
                {
                    "key": l.key,
                    "name": l.name,
                    "rank": l.rank,
                    "lead_feeder": l.lead_feeder,
                    "typical_job_mid": l.typical_job_mid,
                }
                for l in lines
            ],
        })
    return view


def aggregate(sim: SalesSimulation) -> dict[str, object]:
    """
    Aggregate a simulation into the v1 sales dashboard payload.

    Rolls the GPPI leaderboard up into headline financials, summarizes the
    routing board, and breaks premium/standard volume down by market.
    """
    lb = sim.leaderboard
    total_gross_profit = sum(s.raw["gross_profit"] for s in lb)
    total_revenue = sum(s.raw["revenue"] for s in lb)
    avg_gross_margin = (
        total_gross_profit / total_revenue if total_revenue > 0 else 0.0
    )
    avg_job_size = (
        sum(s.raw["avg_job_size"] for s in lb) / len(lb) if lb else 0.0
    )
    avg_close_rate = (
        sum(s.raw["close_rate"] for s in lb) / len(lb) if lb else 0.0
    )

    # Market breakdown from the routed lead board.
    market_rows: dict[str, dict[str, int]] = {
        m: {"leads": 0, "premium": 0, "standard": 0} for m in MARKETS
    }
    for r in sim.routing.routed:
        row = market_rows.setdefault(r.town, {"leads": 0, "premium": 0, "standard": 0})
        row["leads"] += 1
        if r.grade == LeadGrade.PREMIUM:
            row["premium"] += 1
        else:
            row["standard"] += 1

    premium = sim.routing.premium_count
    standard = sim.routing.standard_count

    return {
        "version": "2.1",
        "truth_tag": sim.truth_tag.value,
        "provenance": sim.provenance.value,
        "label": f"{sim.provenance.value} MODEL OUTPUT",
        "headline": {
            "gross_profit": round(total_gross_profit, 2),
            "revenue": round(total_revenue, 2),
            "gross_margin_pct": round(avg_gross_margin, 4),
            "average_job_size": round(avg_job_size, 2),
            "avg_close_rate": round(avg_close_rate, 4),
            "reps": len(lb),
        },
        "routing": {
            "premium": premium,
            "standard": standard,
            "top_performers": len(sim.routing.top_performer_ids),
            "developing_staff": len(sim.routing.developing_ids),
        },
        "markets": [{"town": m, **market_rows[m]} for m in MARKETS],
        "metric_groups": metric_groups(),
        "hierarchy": hierarchy_view(),
        "readiness": sim.readiness.to_dict(),
        "capture": sim.capture.to_dict(),
        "close_rate": sim.close_rate.to_dict(),
        "governance": governance_matrix(),
        "collaboration": collaboration_map(),
    }
