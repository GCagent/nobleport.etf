"""
80/20 Profitable-Lead Routing

The v1 rule was "top 20 agents get the most leads." The v2.0 rule corrects the
incentive: top performers get the most *profitable* leads, not merely the most
leads. Premium opportunities — waterfront, historic, estate, ADU, investor
portfolios, design-build — route to the top 20% by GPPI. Standard, lower-ticket
work (bathrooms, painting, maintenance, small roofing) routes to developing
staff, who build their numbers on it.

The classifier scores a lead's profitability from two signals:
  1. The service line's strategic tier (see hierarchy.py).
  2. Property qualifiers that historically correlate with large NoblePort jobs
     (waterfront, historic, estate, investor portfolio, large lot).

Routing is deterministic given the cohort and the leads, so the same inputs
always produce the same assignment — auditable, not a black box.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum

from backend.sales.gppi import GppiScore
from backend.sales.hierarchy import RevenueTier, strategic_weight, tier_of


class LeadGrade(str, Enum):
    PREMIUM = "premium"
    STANDARD = "standard"


# Property qualifiers that mark an opportunity as premium regardless of the
# nominal service line. Each adds to the profitability score.
PREMIUM_QUALIFIERS: dict[str, float] = {
    "waterfront": 0.40,
    "historic": 0.30,
    "estate": 0.35,
    "investor_portfolio": 0.45,
    "large_lot": 0.20,
    "design_build": 0.30,
}

# A lead at or above this profitability score is graded premium.
PREMIUM_THRESHOLD = 0.60

# Fraction of the cohort that counts as "top performers" (the 20 in 80/20).
TOP_PERFORMER_FRACTION = 0.20


@dataclass(frozen=True)
class Lead:
    """A routable sales opportunity."""

    lead_id: str
    service_line: str          # hierarchy key, e.g. "adu", "bathroom"
    town: str
    estimated_value: float
    qualifiers: tuple[str, ...] = ()  # subset of PREMIUM_QUALIFIERS keys


@dataclass
class RoutedLead:
    lead_id: str
    grade: LeadGrade
    profitability: float       # 0..1
    service_line: str
    tier: int
    town: str
    assigned_to: str | None
    assigned_to_name: str | None
    reason: str

    def to_dict(self) -> dict[str, object]:
        return {
            "lead_id": self.lead_id,
            "grade": self.grade.value,
            "profitability": round(self.profitability, 4),
            "service_line": self.service_line,
            "tier": self.tier,
            "town": self.town,
            "assigned_to": self.assigned_to,
            "assigned_to_name": self.assigned_to_name,
            "reason": self.reason,
        }


def profitability_score(lead: Lead) -> float:
    """
    Score a lead's profitability in [0, 1].

    Base signal is the service line's strategic weight (Tier 1 -> 1.0 ...
    Tier 4 -> 0.3). Premium property qualifiers add on top, capped at 1.0.
    """
    score = strategic_weight(lead.service_line)
    for q in lead.qualifiers:
        score += PREMIUM_QUALIFIERS.get(q, 0.0)
    return min(score, 1.0)


def grade_lead(lead: Lead) -> LeadGrade:
    """Premium vs standard, by profitability threshold or Tier-1 membership."""
    if tier_of(lead.service_line) == RevenueTier.TIER_1:
        return LeadGrade.PREMIUM
    return (
        LeadGrade.PREMIUM
        if profitability_score(lead) >= PREMIUM_THRESHOLD
        else LeadGrade.STANDARD
    )


@dataclass
class RoutingPlan:
    routed: list[RoutedLead] = field(default_factory=list)
    top_performer_ids: list[str] = field(default_factory=list)
    developing_ids: list[str] = field(default_factory=list)

    @property
    def premium_count(self) -> int:
        return sum(1 for r in self.routed if r.grade == LeadGrade.PREMIUM)

    @property
    def standard_count(self) -> int:
        return sum(1 for r in self.routed if r.grade == LeadGrade.STANDARD)

    def to_dict(self) -> dict[str, object]:
        return {
            "summary": {
                "total_leads": len(self.routed),
                "premium": self.premium_count,
                "standard": self.standard_count,
                "top_performers": len(self.top_performer_ids),
                "developing_staff": len(self.developing_ids),
            },
            "top_performer_ids": self.top_performer_ids,
            "developing_ids": self.developing_ids,
            "routed": [r.to_dict() for r in self.routed],
        }


def _top_performer_cutoff(cohort_size: int) -> int:
    """How many reps make up the top 20%. Always at least 1 for a non-empty cohort."""
    if cohort_size <= 0:
        return 0
    return max(1, math.ceil(cohort_size * TOP_PERFORMER_FRACTION))


def route_leads(leads: list[Lead], leaderboard: list[GppiScore]) -> RoutingPlan:
    """
    Assign leads to reps under the 80/20 profitable-lead rule.

    ``leaderboard`` must be GPPI-ranked best-first (as returned by
    ``gppi.score_cohort``). Premium leads round-robin across the top 20% of the
    leaderboard; standard leads round-robin across the developing staff (the
    remainder). If a cohort has no developing staff (e.g. a single rep), the
    top performers absorb standard leads too, with the reason noting the
    fallback.
    """
    plan = RoutingPlan()
    if not leaderboard:
        # No reps to route to — still classify, but leave unassigned.
        for lead in leads:
            grade = grade_lead(lead)
            plan.routed.append(
                RoutedLead(
                    lead_id=lead.lead_id,
                    grade=grade,
                    profitability=profitability_score(lead),
                    service_line=lead.service_line,
                    tier=int(tier_of(lead.service_line)),
                    town=lead.town,
                    assigned_to=None,
                    assigned_to_name=None,
                    reason="no reps available for assignment",
                )
            )
        return plan

    cutoff = _top_performer_cutoff(len(leaderboard))
    top = leaderboard[:cutoff]
    developing = leaderboard[cutoff:]
    plan.top_performer_ids = [s.rep_id for s in top]
    plan.developing_ids = [s.rep_id for s in developing]

    top_rr = 0
    dev_rr = 0
    for lead in leads:
        grade = grade_lead(lead)
        prof = profitability_score(lead)
        tier = int(tier_of(lead.service_line))

        if grade == LeadGrade.PREMIUM:
            rep = top[top_rr % len(top)]
            top_rr += 1
            reason = f"premium (tier {tier}, profitability {prof:.2f}) -> top 20% performer"
        else:
            pool = developing if developing else top
            rep = pool[dev_rr % len(pool)]
            dev_rr += 1
            if developing:
                reason = f"standard (tier {tier}) -> developing staff"
            else:
                reason = f"standard (tier {tier}) -> top performer (no developing staff in cohort)"

        plan.routed.append(
            RoutedLead(
                lead_id=lead.lead_id,
                grade=grade,
                profitability=prof,
                service_line=lead.service_line,
                tier=tier,
                town=lead.town,
                assigned_to=rep.rep_id,
                assigned_to_name=rep.name,
                reason=reason,
            )
        )

    return plan
