"""
NoblePort Revenue Hierarchy

Ranks the design-build service lines by strategic value. This is the spine
of the v2.0 sales model: a salesperson closing one ADU at $325,000 is not
out-performed by someone closing two bathrooms at $15,000, and the scoring
engine has to know that. Lower-ticket lines are not "bad" — they are lead
feeders that pull homeowners into the larger Tier-1 projects.

The hierarchy is deliberately static configuration (a frozen tuple), not a
database table: it encodes NoblePort strategy, changes rarely, and every
other module in this package reads against it.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum


class RevenueTier(IntEnum):
    """Strategic value bands. Lower number = higher strategic priority."""

    TIER_1 = 1  # Highest strategic value — scale aggressively
    TIER_2 = 2  # Strong margin / volume
    TIER_3 = 3  # Mid-ticket
    TIER_4 = 4  # Lead feeders — valuable because they feed larger projects


# Human-readable posture per tier, mirrored from the executive recommendation.
TIER_POSTURE: dict[RevenueTier, str] = {
    RevenueTier.TIER_1: "Scale aggressively — highest gross-profit-per-deal.",
    RevenueTier.TIER_2: "Grow — durable margin and repeat volume.",
    RevenueTier.TIER_3: "Maintain — mid-ticket, steady contribution.",
    RevenueTier.TIER_4: "Use as lead feeders — low ticket, high pull-through.",
}


@dataclass(frozen=True)
class ServiceLine:
    """A single NoblePort revenue line and its place in the hierarchy."""

    key: str
    name: str
    tier: RevenueTier
    rank: int  # 1..N strategic ordering across all lines
    typical_job_low: float
    typical_job_high: float
    lead_feeder: bool

    @property
    def typical_job_mid(self) -> float:
        return (self.typical_job_low + self.typical_job_high) / 2


# The canonical NoblePort service catalog, ordered by strategic value.
# Job-size bands are Essex County / NH Seacoast design-build planning figures.
REVENUE_HIERARCHY: tuple[ServiceLine, ...] = (
    # ---- Tier 1: highest strategic value ----------------------------------
    ServiceLine("adu", "ADUs", RevenueTier.TIER_1, 1, 180_000, 425_000, False),
    ServiceLine("addition", "Additions", RevenueTier.TIER_1, 2, 120_000, 380_000, False),
    ServiceLine("design_build", "Design-Build", RevenueTier.TIER_1, 3, 150_000, 600_000, False),
    ServiceLine(
        "investor_redevelopment", "Investor Redevelopment",
        RevenueTier.TIER_1, 4, 200_000, 900_000, False,
    ),
    ServiceLine(
        "property_acquisition", "Property Acquisition Services",
        RevenueTier.TIER_1, 5, 50_000, 300_000, False,
    ),
    # ---- Tier 2 ------------------------------------------------------------
    ServiceLine("roofing", "Roofing", RevenueTier.TIER_2, 6, 18_000, 85_000, True),
    ServiceLine(
        "exterior_restoration", "Exterior Restoration",
        RevenueTier.TIER_2, 7, 25_000, 140_000, False,
    ),
    ServiceLine(
        "whole_house_renovation", "Whole House Renovations",
        RevenueTier.TIER_2, 8, 90_000, 450_000, False,
    ),
    # ---- Tier 3 ------------------------------------------------------------
    ServiceLine("kitchen", "Kitchens", RevenueTier.TIER_3, 9, 35_000, 120_000, True),
    ServiceLine("bathroom", "Bathrooms", RevenueTier.TIER_3, 10, 12_000, 45_000, True),
    # ---- Tier 4: lead feeders ---------------------------------------------
    ServiceLine(
        "maintenance_membership", "Maintenance Memberships",
        RevenueTier.TIER_4, 11, 1_200, 6_000, True,
    ),
    ServiceLine("painting", "Painting", RevenueTier.TIER_4, 12, 4_000, 25_000, True),
    ServiceLine("property_services", "Property Services", RevenueTier.TIER_4, 13, 800, 12_000, True),
)


_BY_KEY: dict[str, ServiceLine] = {line.key: line for line in REVENUE_HIERARCHY}


def get_service_line(key: str) -> ServiceLine:
    """Look up a service line by key. Raises ValueError if unknown."""
    try:
        return _BY_KEY[key]
    except KeyError as exc:
        raise ValueError(
            f"Unknown service line {key!r}; valid: {sorted(_BY_KEY)}"
        ) from exc


def lines_in_tier(tier: RevenueTier) -> list[ServiceLine]:
    """All service lines in a tier, in strategic rank order."""
    return [line for line in REVENUE_HIERARCHY if line.tier == tier]


def tier_of(key: str) -> RevenueTier:
    """Convenience: the tier of a service line key."""
    return get_service_line(key).tier


def strategic_weight(key: str) -> float:
    """
    A 0..1 strategic multiplier derived from tier.

    Tier 1 -> 1.0, Tier 2 -> 0.75, Tier 3 -> 0.5, Tier 4 -> 0.3. Used by the
    lead-router to bias the most profitable opportunities toward top performers
    without discarding the pull-through value of feeder lines.
    """
    return {
        RevenueTier.TIER_1: 1.0,
        RevenueTier.TIER_2: 0.75,
        RevenueTier.TIER_3: 0.5,
        RevenueTier.TIER_4: 0.3,
    }[tier_of(key)]
