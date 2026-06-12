"""
NoblePort Sales Simulation v2.0

Builds a synthetic-but-coherent sales team, scores it with GPPI, and routes a
synthetic lead board under the 80/20 profitable-lead rule. Every output carries
the SIMULATED Truth-Layer tag: this is a planning and training instrument, not
a hiring or termination engine and not a claim about real people.

The whole simulation is seeded and deterministic — same seed in, same team and
leaderboard out — so it is reproducible, testable, and auditable. When NoblePort
has 6–12 months of real opportunity→deposit→completion data, the same GPPI and
routing engines run unchanged on production numbers; the ``DataReadiness`` gate
below tracks that transition explicitly so nobody mistakes the simulation for
the territory.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum

from backend.governance.truth_layer import TruthTag
from backend.sales.close_rate import CloseRateProjection, project_close_rate
from backend.sales.gppi import GppiScore, RepStats, score_cohort
from backend.sales.hierarchy import REVENUE_HIERARCHY, RevenueTier
from backend.sales.lead_routing import Lead, RoutingPlan, route_leads
from backend.sales.provenance import CaptureState, DataProvenance

# Decision authority is human, always. This simulation never decides.
DECISION_AUTHORITY = "Human Review Required"
PURPOSE = "Training, forecasting, and resource allocation — not hiring or termination decisions."

# Towns NoblePort actively works (Essex County MA + NH Seacoast), per the spec.
MARKETS: tuple[str, ...] = (
    "Newburyport",
    "Ipswich",
    "Manchester-by-the-Sea",
    "Essex",
    "Marblehead",
    "Portsmouth",
    "Rye",
    "New Castle",
)

# A small bench of plausible rep names for deterministic generation.
_REP_NAMES: tuple[str, ...] = (
    "Dana Whitfield", "Marcus Ellery", "Priya Anand", "Tom Castellano",
    "Bianca Rossi", "Jordan Pell", "Sofia Marchetti", "Liam O'Donnell",
    "Grace Yun", "Andre Beaumont", "Nadia Haddad", "Wes Coleman",
)

_PREMIUM_QUALIFIERS: tuple[str, ...] = (
    "waterfront", "historic", "estate", "investor_portfolio", "large_lot",
)


class SimulationMode(str, Enum):
    SIMULATION_PRIMARY = "simulation_primary"  # < 6 months real data
    BLENDED = "blended"                         # 6–12 months
    DATA_PRIMARY = "data_primary"               # 12+ months real data


@dataclass(frozen=True)
class DataReadiness:
    """
    Tracks the migration from generic simulation to a NoblePort-specific model.

    The 12-month goal: once NoblePort captures opportunities → appointments →
    estimates → contracts → deposits → completed projects, real performance
    becomes primary and the AI can forecast win probability, project size,
    margin, referral, and change-order probability on its own market.
    """

    months_of_real_data: float

    @property
    def mode(self) -> SimulationMode:
        if self.months_of_real_data >= 12:
            return SimulationMode.DATA_PRIMARY
        if self.months_of_real_data >= 6:
            return SimulationMode.BLENDED
        return SimulationMode.SIMULATION_PRIMARY

    @property
    def real_data_weight(self) -> float:
        """How much real data should drive decisions, 0..1, capped at 12 months."""
        return min(self.months_of_real_data / 12.0, 1.0)

    @property
    def next_milestone(self) -> str:
        mode = self.mode
        if mode is SimulationMode.SIMULATION_PRIMARY:
            return "Capture the full opportunity→deposit→completion funnel; reach 6 months of data to blend."
        if mode is SimulationMode.BLENDED:
            return "Reach 12 months of production data to make real performance primary."
        return "Model is NoblePort-specific. Retrain quarterly on rolling production data."

    def to_dict(self) -> dict[str, object]:
        return {
            "months_of_real_data": self.months_of_real_data,
            "mode": self.mode.value,
            "real_data_weight": round(self.real_data_weight, 3),
            "next_milestone": self.next_milestone,
        }


@dataclass
class SalesSimulation:
    """A complete, truth-tagged sales simulation snapshot."""

    truth_tag: TruthTag
    decision_authority: str
    purpose: str
    leaderboard: list[GppiScore]
    routing: RoutingPlan
    readiness: DataReadiness
    capture: CaptureState
    close_rate: CloseRateProjection
    seed: int

    @property
    def provenance(self) -> DataProvenance:
        """v2.1 data-provenance label: SIMULATED | BLENDED | ACTUAL."""
        return self.capture.provenance

    def to_dict(self) -> dict[str, object]:
        return {
            "version": "2.1",
            "truth_tag": self.truth_tag.value,
            "provenance": self.provenance.value,
            "label": f"{self.provenance.value} MODEL OUTPUT",
            "needed_next": "ACTUAL NOBLEPORT SALES DATASET",
            "decision_authority": self.decision_authority,
            "purpose": self.purpose,
            "seed": self.seed,
            "readiness": self.readiness.to_dict(),
            "capture": self.capture.to_dict(),
            "close_rate": self.close_rate.to_dict(),
            "leaderboard": [s.to_dict() for s in self.leaderboard],
            "routing": self.routing.to_dict(),
        }


def _generate_team(rng: random.Random, size: int) -> list[RepStats]:
    """Generate ``size`` reps with correlated, plausible KPI distributions."""
    names = list(_REP_NAMES)
    rng.shuffle(names)
    reps: list[RepStats] = []
    for i in range(size):
        # A latent "skill" factor correlates the KPIs so the leaderboard is
        # meaningful rather than noise.
        skill = rng.uniform(0.35, 1.0)
        jobs_won = max(1, int(rng.gauss(8 * skill + 2, 2)))
        opportunities = jobs_won + max(1, int(rng.gauss(12 * (1.2 - skill) + 4, 3)))
        avg_job = rng.uniform(40_000, 120_000) * (0.6 + 0.8 * skill)
        revenue = jobs_won * avg_job
        gross_margin = rng.uniform(0.22, 0.34) * (0.85 + 0.3 * skill)
        gross_profit = revenue * gross_margin
        response_hours = max(0.25, rng.gauss(6 * (1.3 - skill), 1.5))
        csat = min(5.0, max(3.0, rng.gauss(3.6 + 1.2 * skill, 0.3)))
        reps.append(
            RepStats(
                rep_id=f"rep-{i + 1:02d}",
                name=names[i % len(names)],
                gross_profit=round(gross_profit, 2),
                revenue=round(revenue, 2),
                jobs_won=jobs_won,
                opportunities=opportunities,
                lead_response_hours=round(response_hours, 2),
                customer_satisfaction=round(csat, 2),
            )
        )
    return reps


def _generate_leads(rng: random.Random, count: int) -> list[Lead]:
    """Generate a mixed lead board weighted toward feeder lines (realistic intake)."""
    # Intake skews toward lower tiers; premium leads are rarer but higher value.
    tier_pool: list[str] = []
    weight_by_tier = {
        RevenueTier.TIER_1: 1, RevenueTier.TIER_2: 2,
        RevenueTier.TIER_3: 3, RevenueTier.TIER_4: 4,
    }
    for line in REVENUE_HIERARCHY:
        tier_pool.extend([line.key] * weight_by_tier[line.tier])

    leads: list[Lead] = []
    for i in range(count):
        key = rng.choice(tier_pool)
        line = next(l for l in REVENUE_HIERARCHY if l.key == key)
        value = round(rng.uniform(line.typical_job_low, line.typical_job_high), 2)
        quals: tuple[str, ...] = ()
        # ~30% of leads carry a premium qualifier.
        if rng.random() < 0.30:
            quals = (rng.choice(_PREMIUM_QUALIFIERS),)
        leads.append(
            Lead(
                lead_id=f"lead-{i + 1:03d}",
                service_line=key,
                town=rng.choice(MARKETS),
                estimated_value=value,
                qualifiers=quals,
            )
        )
    return leads


def run_simulation(
    *,
    team_size: int = 8,
    lead_count: int = 40,
    months_of_real_data: float = 0.0,
    captured_opportunities: int = 0,
    captured_completions: int = 0,
    seed: int = 42,
) -> SalesSimulation:
    """
    Run a full v2.1 sales simulation.

    Deterministic in ``seed``: generates a team, computes the GPPI leaderboard,
    routes a lead board under the 80/20 profitable-lead rule, and attaches the
    data-provenance gate (SIMULATED | BLENDED | ACTUAL) and the close-rate
    growth projection. Provenance is data-capture-first: it is driven by the
    captured opportunity/completion counts, not the calendar. The Truth-Layer
    action tag stays SIMULATED — outputs inform human resource-allocation
    decisions, they do not make them.
    """
    if team_size < 1:
        raise ValueError("team_size must be >= 1")
    if lead_count < 0:
        raise ValueError("lead_count must be >= 0")

    rng = random.Random(seed)
    team = _generate_team(rng, team_size)
    leaderboard = score_cohort(team)
    leads = _generate_leads(rng, lead_count)
    routing = route_leads(leads, leaderboard)

    capture = CaptureState(
        months_of_real_data=months_of_real_data,
        captured_opportunities=captured_opportunities,
        captured_completions=captured_completions,
    )

    # The growth loop projects from NoblePort's real measured baseline
    # (~6.25%–12.5%), not the synthetic cohort's inflated close rates — the
    # baseline is the honest starting point per the v2.1 spec.
    close_rate = project_close_rate(current=None)

    return SalesSimulation(
        truth_tag=TruthTag.SIMULATED,
        decision_authority=DECISION_AUTHORITY,
        purpose=PURPOSE,
        leaderboard=leaderboard,
        routing=routing,
        readiness=DataReadiness(months_of_real_data=months_of_real_data),
        capture=capture,
        close_rate=close_rate,
        seed=seed,
    )
