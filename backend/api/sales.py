"""
NoblePort Sales API

Read-only endpoints over the v2.0 sales-intelligence engine: the revenue
hierarchy, the GPPI leaderboard, the 80/20 profitable-lead routing, and the
SIMULATED team simulation. Every simulation response carries its Truth-Layer
tag — these inform human resource-allocation decisions, they do not make them.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from backend.sales import (
    GPPI_WEIGHTS,
    REVENUE_HIERARCHY,
    SalesAction,
    aggregate,
    classify_action,
    collaboration_map,
    enrich_lead,
    governance_matrix,
    hierarchy_view,
    metric_groups,
    project_close_rate,
    run_simulation,
)

router = APIRouter()


@router.get("/hierarchy")
async def get_hierarchy():
    """The NoblePort revenue hierarchy: 13 service lines across 4 strategic tiers."""
    return {
        "tiers": hierarchy_view(),
        "lines": [
            {
                "key": l.key,
                "name": l.name,
                "tier": int(l.tier),
                "rank": l.rank,
                "lead_feeder": l.lead_feeder,
                "typical_job_low": l.typical_job_low,
                "typical_job_high": l.typical_job_high,
            }
            for l in REVENUE_HIERARCHY
        ],
    }


@router.get("/metrics")
async def get_metric_catalog():
    """The v1 sales dashboard metric catalog, grouped by lead/sales/financial."""
    return {"metric_groups": metric_groups()}


@router.get("/leaderboard")
async def get_leaderboard(
    team_size: int = Query(8, ge=1, le=12),
    seed: int = Query(42, ge=0),
):
    """The GPPI leaderboard for a SIMULATED team of the given size."""
    sim = run_simulation(team_size=team_size, lead_count=0, seed=seed)
    return {
        "truth_tag": sim.truth_tag.value,
        "label": "SIMULATED MODEL OUTPUT",
        "weights": {k.value: v for k, v in GPPI_WEIGHTS.items()},
        "leaderboard": [s.to_dict() for s in sim.leaderboard],
    }


@router.get("/routing")
async def get_routing(
    team_size: int = Query(8, ge=1, le=12),
    lead_count: int = Query(40, ge=0, le=500),
    seed: int = Query(42, ge=0),
):
    """The 80/20 profitable-lead routing plan for a SIMULATED team and lead board."""
    sim = run_simulation(team_size=team_size, lead_count=lead_count, seed=seed)
    return {
        "truth_tag": sim.truth_tag.value,
        "label": "SIMULATED MODEL OUTPUT",
        "routing": sim.routing.to_dict(),
    }


@router.get("/simulation")
async def get_simulation(
    team_size: int = Query(8, ge=1, le=12),
    lead_count: int = Query(40, ge=0, le=500),
    months_of_real_data: float = Query(0.0, ge=0.0),
    captured_opportunities: int = Query(0, ge=0),
    captured_completions: int = Query(0, ge=0),
    seed: int = Query(42, ge=0),
):
    """A full sales snapshot: leaderboard + routing + provenance + close-rate loop."""
    sim = run_simulation(
        team_size=team_size,
        lead_count=lead_count,
        months_of_real_data=months_of_real_data,
        captured_opportunities=captured_opportunities,
        captured_completions=captured_completions,
        seed=seed,
    )
    return sim.to_dict()


@router.get("/dashboard")
async def get_dashboard(
    team_size: int = Query(8, ge=1, le=12),
    lead_count: int = Query(40, ge=0, le=500),
    months_of_real_data: float = Query(0.0, ge=0.0),
    captured_opportunities: int = Query(0, ge=0),
    captured_completions: int = Query(0, ge=0),
    seed: int = Query(42, ge=0),
):
    """The aggregated Revenue War Board payload over a sales snapshot."""
    sim = run_simulation(
        team_size=team_size,
        lead_count=lead_count,
        months_of_real_data=months_of_real_data,
        captured_opportunities=captured_opportunities,
        captured_completions=captured_completions,
        seed=seed,
    )
    return aggregate(sim)


# =========================================================================
# v2.1 — Progressive Revenue Execution Layer
# =========================================================================


@router.get("/close-rate")
async def get_close_rate(current: float | None = Query(None, ge=0.0, le=1.0)):
    """The close-rate growth loop from NoblePort's ~6.25%–12.5% baseline."""
    return project_close_rate(current=current).to_dict()


@router.get("/governance")
async def get_governance():
    """The human-gated sales authority matrix (AUTO vs HUMAN per action)."""
    return {"matrix": governance_matrix()}


@router.get("/governance/classify")
async def classify_sales_action(
    action: str = Query(..., description="A SalesAction key, e.g. apply_discount"),
    amount_usd: float = Query(0.0, ge=0.0),
):
    """Classify a single sales action into AUTO/HUMAN with its Truth-Layer tag."""
    return classify_action(action, amount_usd=amount_usd).to_dict()


@router.get("/collaboration")
async def get_collaboration():
    """The Stephanie / PermitStream / GCagent / Cyborg handoff map."""
    return {"handoffs": collaboration_map()}


@router.get("/enrichment")
async def get_enrichment(
    service_line: str = Query(..., description="A hierarchy key, e.g. investor_redevelopment"),
    estimated_value: float = Query(0.0, ge=0.0),
):
    """Tax-aware real-estate talking points — advisory only, CPA review required."""
    return enrich_lead(service_line, estimated_value=estimated_value).to_dict()
