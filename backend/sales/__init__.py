"""
NoblePort Sales Intelligence (v2.0)

A proprietary, NoblePort-specific sales model for an Essex County / NH Seacoast
design-build company. The four pieces fit together:

  hierarchy     — ranks the 13 service lines by strategic value (ADU > bathroom)
  gppi          — Weighted Gross Profit Performance Index; ranks reps on the
                  blend that actually grows the business, not close rate alone
  lead_routing  — the 80/20 *profitable*-lead rule: best leads to top performers
  simulation    — a seeded, deterministic, SIMULATED team + lead board
  dashboard     — the v1 metric catalog and aggregation surface

Everything is pure and framework-agnostic so it runs identically on simulated
inputs today and on real opportunity→deposit→completion data once captured.
"""

from __future__ import annotations

from backend.sales.close_rate import (
    BASELINE_HIGH,
    BASELINE_LOW,
    CLOSE_RATE_CEILING,
    GROWTH_LEVERS,
    CloseRateProjection,
    GrowthLever,
    project_close_rate,
)
from backend.sales.collaboration import COLLABORATION_MAP, Handoff, collaboration_map
from backend.sales.dashboard import (
    METRIC_CATALOG,
    MetricDef,
    aggregate,
    hierarchy_view,
    metric_groups,
)
from backend.sales.enrichment import TaxAdvisory, enrich_lead
from backend.sales.governance import (
    SALES_AUTHORITY,
    SALES_BUDGET_GATE_USD,
    Gate,
    SalesAction,
    SalesDisposition,
    classify_action,
    governance_matrix,
)
from backend.sales.gppi import (
    GPPI_WEIGHTS,
    GppiKpi,
    GppiScore,
    RepStats,
    score_cohort,
)
from backend.sales.hierarchy import (
    REVENUE_HIERARCHY,
    RevenueTier,
    ServiceLine,
    get_service_line,
    lines_in_tier,
    strategic_weight,
    tier_of,
)
from backend.sales.lead_routing import (
    PREMIUM_THRESHOLD,
    TOP_PERFORMER_FRACTION,
    Lead,
    LeadGrade,
    RoutedLead,
    RoutingPlan,
    grade_lead,
    profitability_score,
    route_leads,
)
from backend.sales.provenance import (
    CaptureState,
    DataProvenance,
)
from backend.sales.simulation import (
    MARKETS,
    DataReadiness,
    SalesSimulation,
    SimulationMode,
    run_simulation,
)

__all__ = [
    # hierarchy
    "REVENUE_HIERARCHY",
    "RevenueTier",
    "ServiceLine",
    "get_service_line",
    "lines_in_tier",
    "strategic_weight",
    "tier_of",
    # gppi
    "GPPI_WEIGHTS",
    "GppiKpi",
    "GppiScore",
    "RepStats",
    "score_cohort",
    # routing
    "Lead",
    "LeadGrade",
    "RoutedLead",
    "RoutingPlan",
    "PREMIUM_THRESHOLD",
    "TOP_PERFORMER_FRACTION",
    "grade_lead",
    "profitability_score",
    "route_leads",
    # simulation
    "MARKETS",
    "DataReadiness",
    "SalesSimulation",
    "SimulationMode",
    "run_simulation",
    # provenance (v2.1)
    "CaptureState",
    "DataProvenance",
    # close-rate growth loop (v2.1)
    "BASELINE_LOW",
    "BASELINE_HIGH",
    "CLOSE_RATE_CEILING",
    "GROWTH_LEVERS",
    "CloseRateProjection",
    "GrowthLever",
    "project_close_rate",
    # sales governance (v2.1)
    "SALES_AUTHORITY",
    "SALES_BUDGET_GATE_USD",
    "Gate",
    "SalesAction",
    "SalesDisposition",
    "classify_action",
    "governance_matrix",
    # collaboration layer (v2.1)
    "COLLABORATION_MAP",
    "Handoff",
    "collaboration_map",
    # tax-aware enrichment (v2.1, advisory only)
    "TaxAdvisory",
    "enrich_lead",
    # dashboard
    "METRIC_CATALOG",
    "MetricDef",
    "aggregate",
    "hierarchy_view",
    "metric_groups",
]
