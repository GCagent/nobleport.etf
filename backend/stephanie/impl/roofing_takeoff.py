"""
Roofing Takeoff Engine (register row 19) — real calculation, not a stub.

Computes a roofing material takeoff from plane dimensions and pitch:
pitch-adjusted area, squares, waste-adjusted squares, shingle bundles,
underlayment rolls, ice & water shield, ridge cap, and drip edge. The math is
the standard estimator's method: a pitch factor of sqrt(1 + (rise/12)^2)
applied to the footprint area of each plane.

Deterministic and pure — same inputs, same takeoff — so it is testable against
hand-computed values and safe for Stephanie to execute autonomously (it prices
nothing and commits nobody; scope/pricing stays with the estimate engine and
the human approval gate).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# Standard 3-bundle-per-square architectural shingles.
BUNDLES_PER_SQUARE = 3
# Synthetic underlayment: one 10-square roll, applied at 4 sq usable per roll
# after laps on typical residential pitches.
UNDERLAYMENT_SQ_PER_ROLL = 4.0
# Ice & water shield: 2 sq (~200 sf) per roll; code requires eaves coverage
# 3 ft up-slope in Massachusetts climate zones.
ICE_WATER_SF_PER_ROLL = 200.0
ICE_WATER_EAVE_DEPTH_FT = 3.0
# Drip edge sticks are 10 ft.
DRIP_EDGE_STICK_FT = 10.0
# Ridge cap: 1 bundle covers ~25 lf.
RIDGE_CAP_LF_PER_BUNDLE = 25.0


@dataclass(frozen=True)
class RoofPlane:
    """One rectangular roof plane measured on the footprint."""

    length_ft: float   # along the eave
    width_ft: float    # eave to ridge, measured flat (footprint)
    pitch_rise: float  # rise per 12 run, e.g. 7 for 7/12

    def __post_init__(self) -> None:
        if self.length_ft <= 0 or self.width_ft <= 0:
            raise ValueError("plane dimensions must be positive")
        if self.pitch_rise < 0:
            raise ValueError("pitch rise cannot be negative")

    @property
    def pitch_factor(self) -> float:
        return math.sqrt(1.0 + (self.pitch_rise / 12.0) ** 2)

    @property
    def adjusted_area_sf(self) -> float:
        return self.length_ft * self.width_ft * self.pitch_factor

    @property
    def eave_length_ft(self) -> float:
        return self.length_ft


def waste_pct(complexity: str) -> float:
    """Waste factor by roof complexity — gable 10%, hip 15%, cut-up 20%."""
    table = {"gable": 0.10, "hip": 0.15, "complex": 0.20}
    if complexity not in table:
        raise ValueError(f"unknown complexity {complexity!r}; use {sorted(table)}")
    return table[complexity]


def takeoff(payload: dict) -> dict:
    """
    Compute a full takeoff.

    Payload: {"planes": [{"length_ft", "width_ft", "pitch_rise"}, ...],
              "complexity": "gable" | "hip" | "complex",
              "ridge_lf": float (optional, defaults to summed plane lengths / 2)}
    """
    raw_planes = payload.get("planes") or []
    if not raw_planes:
        raise ValueError("at least one roof plane is required")
    complexity = payload.get("complexity", "gable")
    planes = [
        RoofPlane(
            length_ft=float(p["length_ft"]),
            width_ft=float(p["width_ft"]),
            pitch_rise=float(p.get("pitch_rise", 0)),
        )
        for p in raw_planes
    ]

    adjusted_sf = sum(p.adjusted_area_sf for p in planes)
    squares = adjusted_sf / 100.0
    waste = waste_pct(complexity)
    order_squares = squares * (1.0 + waste)
    eaves_lf = sum(p.eave_length_ft for p in planes)
    ridge_lf = float(payload.get("ridge_lf", eaves_lf / 2.0))

    ice_water_sf = eaves_lf * ICE_WATER_EAVE_DEPTH_FT
    return {
        "planes": len(planes),
        "adjusted_area_sf": round(adjusted_sf, 1),
        "squares": round(squares, 2),
        "waste_pct": waste,
        "order_squares": round(order_squares, 2),
        "shingle_bundles": math.ceil(order_squares * BUNDLES_PER_SQUARE),
        "underlayment_rolls": math.ceil(squares / UNDERLAYMENT_SQ_PER_ROLL),
        "ice_water_rolls": math.ceil(ice_water_sf / ICE_WATER_SF_PER_ROLL),
        "ridge_cap_bundles": math.ceil(ridge_lf / RIDGE_CAP_LF_PER_BUNDLE),
        "drip_edge_sticks": math.ceil((eaves_lf + ridge_lf) / DRIP_EDGE_STICK_FT),
        "eaves_lf": round(eaves_lf, 1),
        "ridge_lf": round(ridge_lf, 1),
        "note": "Material takeoff only — pricing flows through the estimate engine and human approval.",
    }
