"""
Weighted Gross Profit Performance Index (GPPI)

The v2.0 upgrade. v1 ranked salespeople on close rate alone, which rewards
volume of small jobs over the gross profit that actually grows a design-build
company. GPPI replaces that single metric with a weighted blend of six KPIs.

    KPI                       Weight
    Gross Profit Generated     40%
    Revenue Generated          25%
    Average Job Size           15%
    Close Rate                 10%
    Lead Response Time          5%   (lower is better — inverted)
    Customer Satisfaction       5%

Scoring is cohort-relative: each KPI is min-max normalized across the reps
being ranked, so the index answers "who is performing best right now?" rather
than asserting an absolute. The weighted blend is scaled to 0..100.

This module is pure and deterministic. It takes rep statistics in and returns
a ranked leaderboard out — no database, no I/O — so it is trivially testable
and can be fed either simulated stats or real production numbers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class GppiKpi(str, Enum):
    GROSS_PROFIT = "gross_profit"
    REVENUE = "revenue"
    AVG_JOB_SIZE = "avg_job_size"
    CLOSE_RATE = "close_rate"
    LEAD_RESPONSE_TIME = "lead_response_time"
    CUSTOMER_SATISFACTION = "customer_satisfaction"


# Canonical weights per the v2.0 spec. Must sum to 1.0.
GPPI_WEIGHTS: dict[GppiKpi, float] = {
    GppiKpi.GROSS_PROFIT: 0.40,
    GppiKpi.REVENUE: 0.25,
    GppiKpi.AVG_JOB_SIZE: 0.15,
    GppiKpi.CLOSE_RATE: 0.10,
    GppiKpi.LEAD_RESPONSE_TIME: 0.05,
    GppiKpi.CUSTOMER_SATISFACTION: 0.05,
}

# KPIs where a lower raw value is better and must be inverted before scoring.
_LOWER_IS_BETTER: frozenset[GppiKpi] = frozenset({GppiKpi.LEAD_RESPONSE_TIME})

# Tolerance for the weight-sum invariant.
_WEIGHT_EPSILON = 1e-9


def _assert_weights_valid() -> None:
    total = sum(GPPI_WEIGHTS.values())
    if abs(total - 1.0) > _WEIGHT_EPSILON:
        raise ValueError(f"GPPI weights must sum to 1.0, got {total}")
    missing = set(GppiKpi) - set(GPPI_WEIGHTS)
    if missing:
        raise ValueError(f"GPPI weights missing KPIs: {sorted(k.value for k in missing)}")


_assert_weights_valid()


@dataclass(frozen=True)
class RepStats:
    """
    Raw, un-normalized performance for a single salesperson over a period.

    These are the inputs the dashboard captures per the spec's Financial and
    Sales metric groups. Average job size is derived from revenue / jobs_won
    when not supplied explicitly.
    """

    rep_id: str
    name: str
    gross_profit: float          # total GP generated ($)
    revenue: float               # total revenue generated ($)
    jobs_won: int                # contracts signed
    opportunities: int           # total qualified opportunities worked
    lead_response_hours: float   # average first-response time (hours)
    customer_satisfaction: float # 0..5 CSAT
    avg_job_size: float | None = None  # override; else revenue / jobs_won

    @property
    def close_rate(self) -> float:
        """Contracts signed / opportunities worked, 0..1."""
        if self.opportunities <= 0:
            return 0.0
        return self.jobs_won / self.opportunities

    @property
    def average_job_size(self) -> float:
        if self.avg_job_size is not None:
            return self.avg_job_size
        if self.jobs_won <= 0:
            return 0.0
        return self.revenue / self.jobs_won

    def kpi_value(self, kpi: GppiKpi) -> float:
        """The raw value for a KPI, before normalization."""
        return {
            GppiKpi.GROSS_PROFIT: self.gross_profit,
            GppiKpi.REVENUE: self.revenue,
            GppiKpi.AVG_JOB_SIZE: self.average_job_size,
            GppiKpi.CLOSE_RATE: self.close_rate,
            GppiKpi.LEAD_RESPONSE_TIME: self.lead_response_hours,
            GppiKpi.CUSTOMER_SATISFACTION: self.customer_satisfaction,
        }[kpi]


@dataclass
class GppiScore:
    """A rep's computed GPPI result with the per-KPI contribution breakdown."""

    rep_id: str
    name: str
    score: float                       # 0..100
    rank: int = 0
    percentile: float = 0.0            # 0..1, 1.0 = best
    contributions: dict[str, float] = field(default_factory=dict)  # kpi -> weighted pts
    normalized: dict[str, float] = field(default_factory=dict)     # kpi -> 0..1
    raw: dict[str, float] = field(default_factory=dict)            # kpi -> raw value

    def to_dict(self) -> dict[str, object]:
        return {
            "rep_id": self.rep_id,
            "name": self.name,
            "gppi": round(self.score, 2),
            "rank": self.rank,
            "percentile": round(self.percentile, 4),
            "contributions": {k: round(v, 2) for k, v in self.contributions.items()},
            "normalized": {k: round(v, 4) for k, v in self.normalized.items()},
            "raw": {k: round(v, 2) for k, v in self.raw.items()},
        }


def _normalize(values: list[float], lower_is_better: bool) -> list[float]:
    """
    Min-max normalize a column to [0, 1].

    A degenerate column (all equal, including a single rep) maps to a neutral
    1.0 — nobody is penalized for being the only data point on that axis.
    """
    lo, hi = min(values), max(values)
    span = hi - lo
    if span <= 0:
        return [1.0 for _ in values]
    if lower_is_better:
        return [(hi - v) / span for v in values]
    return [(v - lo) / span for v in values]


def score_cohort(stats: list[RepStats]) -> list[GppiScore]:
    """
    Compute GPPI for a cohort of reps and return them ranked best-first.

    Scoring is relative to the cohort supplied: normalize each KPI column,
    apply the spec weights, scale to 0..100, then rank. Ties are broken by
    raw gross profit (the heaviest-weighted KPI) so the ordering is stable.
    """
    if not stats:
        return []

    kpis = list(GppiKpi)
    columns: dict[GppiKpi, list[float]] = {
        kpi: [s.kpi_value(kpi) for s in stats] for kpi in kpis
    }
    normalized: dict[GppiKpi, list[float]] = {
        kpi: _normalize(columns[kpi], kpi in _LOWER_IS_BETTER) for kpi in kpis
    }

    scores: list[GppiScore] = []
    for i, s in enumerate(stats):
        contributions: dict[str, float] = {}
        norm_map: dict[str, float] = {}
        raw_map: dict[str, float] = {}
        total = 0.0
        for kpi in kpis:
            n = normalized[kpi][i]
            pts = n * GPPI_WEIGHTS[kpi] * 100.0
            total += pts
            contributions[kpi.value] = pts
            norm_map[kpi.value] = n
            raw_map[kpi.value] = columns[kpi][i]
        scores.append(
            GppiScore(
                rep_id=s.rep_id,
                name=s.name,
                score=total,
                contributions=contributions,
                normalized=norm_map,
                raw=raw_map,
            )
        )

    scores.sort(key=lambda sc: (sc.score, sc.raw[GppiKpi.GROSS_PROFIT.value]), reverse=True)

    n = len(scores)
    for idx, sc in enumerate(scores):
        sc.rank = idx + 1
        # Percentile: best rep -> 1.0, worst -> 0.0 (1.0 when only one rep).
        sc.percentile = 1.0 if n == 1 else (n - 1 - idx) / (n - 1)

    return scores
