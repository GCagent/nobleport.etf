"""
NoblePort OS — Wall Framing Cost Estimator

A small, dependency-free estimator that reproduces the RSMeans-style
"Cost to Frame a Wall" line items and rolls them up to a low/high range and an
average cost per square foot. The Cost Agent uses this to attach a defensible
budget baseline to framing scope and to flag bids that fall outside the band.

Reference basis (national average, May 2026, 125 SF wall):

    Item                          Qty     Low     High
    Wall framing labor (basic)    4.4 h   $237    $503
    Wall framing job supplies     134 SF  $217    $247
    Wall framing equipment        1 job   $50     $75
    --------------------------------------------------
    Total (125 SF)                        $504    $825
    Average cost / SF                      $4.03   $6.60

Rates below are derived from that basis: labor and supplies scale per wall SF,
equipment is a fixed daily allowance. Supplies carry a ~7.2% waste factor
(134 SF billed for 125 SF of wall), matching the reference take-off.
"""

from __future__ import annotations

from dataclasses import dataclass

# Per wall-square-foot rates derived from the 125 SF reference take-off.
_LABOR_LOW_PER_SF = 237 / 125          # 1.896
_LABOR_HIGH_PER_SF = 503 / 125         # 4.024
_SUPPLIES_LOW_PER_SF = 217 / 125       # 1.736 (already includes waste)
_SUPPLIES_HIGH_PER_SF = 247 / 125      # 1.976
_SUPPLIES_WASTE_FACTOR = 134 / 125     # 1.072 take-off overage
_EQUIPMENT_LOW = 50.0                   # per job, daily rental allowance
_EQUIPMENT_HIGH = 75.0
_LABOR_HOURS_PER_SF = 4.4 / 125        # 0.0352 crew-hours / SF (basic conditions)


@dataclass(frozen=True)
class LineItem:
    description: str
    quantity: float
    unit: str
    low: float
    high: float


@dataclass(frozen=True)
class FramingEstimate:
    """Full estimate for a wall-framing scope."""

    square_feet: float
    zip_code: str | None
    line_items: list[LineItem]
    total_low: float
    total_high: float
    cost_per_sf_low: float
    cost_per_sf_high: float
    labor_hours: float

    def to_dict(self) -> dict[str, object]:
        return {
            "square_feet": round(self.square_feet, 2),
            "zip_code": self.zip_code,
            "labor_hours": round(self.labor_hours, 2),
            "line_items": [
                {
                    "description": li.description,
                    "quantity": round(li.quantity, 2),
                    "unit": li.unit,
                    "low": round(li.low, 2),
                    "high": round(li.high, 2),
                }
                for li in self.line_items
            ],
            "total_low": round(self.total_low, 2),
            "total_high": round(self.total_high, 2),
            "cost_per_sf_low": round(self.cost_per_sf_low, 2),
            "cost_per_sf_high": round(self.cost_per_sf_high, 2),
        }


def estimate_wall_framing(square_feet: float, zip_code: str | None = None) -> FramingEstimate:
    """Estimate the cost to frame a wood-stud wall of ``square_feet`` (16" OC)."""
    if square_feet <= 0:
        raise ValueError("square_feet must be positive")

    labor = LineItem(
        description=(
            "Wall framing labor (basic): layout, fabricate and install wood "
            "framed wall, studs 16\" OC, double top plate, treated bottom "
            "plate, blocking, 1 corner / 100 SF"
        ),
        quantity=round(square_feet * _LABOR_HOURS_PER_SF, 1),
        unit="h",
        low=square_feet * _LABOR_LOW_PER_SF,
        high=square_feet * _LABOR_HIGH_PER_SF,
    )
    supplies = LineItem(
        description=(
            "Wall framing job supplies: fasteners, connectors and dimensional "
            "lumber for openings (includes waste/overage)"
        ),
        quantity=round(square_feet * _SUPPLIES_WASTE_FACTOR),
        unit="SF",
        low=square_feet * _SUPPLIES_LOW_PER_SF,
        high=square_feet * _SUPPLIES_HIGH_PER_SF,
    )
    equipment = LineItem(
        description=(
            "Equipment allowance: pneumatic framing nailer, 12\" miter saw, "
            "3-1/4\" electric planer (daily rental, consumables extra)"
        ),
        quantity=1,
        unit="job",
        low=_EQUIPMENT_LOW,
        high=_EQUIPMENT_HIGH,
    )

    items = [labor, supplies, equipment]
    total_low = sum(i.low for i in items)
    total_high = sum(i.high for i in items)

    return FramingEstimate(
        square_feet=square_feet,
        zip_code=zip_code,
        line_items=items,
        total_low=total_low,
        total_high=total_high,
        cost_per_sf_low=total_low / square_feet,
        cost_per_sf_high=total_high / square_feet,
        labor_hours=labor.quantity,
    )
