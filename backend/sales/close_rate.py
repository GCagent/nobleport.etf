"""
Close-Rate Growth Loop

NoblePort's real measured baseline is roughly 6.25%–12.5% (1 in 16 to 1 in 8
qualified opportunities closed). v2.1 models the *progressive* improvement of
that rate as concrete operating levers compound — it does not assert a target,
it shows what each discipline is worth and where the realistic ceiling sits.

Each lever applies a multiplicative lift to the live close rate. Lifts compound
but are capped at a realistic design-build ceiling, because no amount of process
turns a 10% rate into 90% — the honest ceiling matters as much as the levers.
"""

from __future__ import annotations

from dataclasses import dataclass

# NoblePort's measured starting band.
BASELINE_LOW = 0.0625
BASELINE_HIGH = 0.125

# Realistic ceiling for a premium design-build close rate. Levers compound
# toward this, never past it.
CLOSE_RATE_CEILING = 0.45


@dataclass(frozen=True)
class GrowthLever:
    """One operating discipline and the relative close-rate lift it drives."""

    key: str
    name: str
    lift: float  # relative lift applied multiplicatively, e.g. 0.15 = +15%
    owner: str   # which discipline / system drives it

    @property
    def factor(self) -> float:
        return 1.0 + self.lift


# The growth loop. Ordered by where NoblePort gets the cheapest wins first.
GROWTH_LEVERS: tuple[GrowthLever, ...] = (
    GrowthLever("response_time", "Sub-hour lead response", 0.18, "Stephanie.ai"),
    GrowthLever("lead_routing", "80/20 profitable-lead routing", 0.15, "Sales OS"),
    GrowthLever("follow_up", "Disciplined multi-touch follow-up", 0.12, "Sales OS"),
    GrowthLever("estimate_speed", "48-hour estimate turnaround", 0.10, "GCagent.ai"),
    GrowthLever("gppi_coaching", "GPPI-driven rep coaching", 0.08, "Sales OS"),
    GrowthLever("proof_trust", "Permit/compliance proof at proposal", 0.06, "PermitStream.ai"),
)


@dataclass
class CloseRateProjection:
    baseline_low: float
    baseline_high: float
    current: float
    projected: float
    ceiling: float
    applied: list[dict[str, object]]

    def to_dict(self) -> dict[str, object]:
        return {
            "baseline_low": round(self.baseline_low, 4),
            "baseline_high": round(self.baseline_high, 4),
            "current": round(self.current, 4),
            "projected": round(self.projected, 4),
            "ceiling": round(self.ceiling, 4),
            "absolute_lift": round(self.projected - self.current, 4),
            "levers": self.applied,
        }


def project_close_rate(
    current: float | None = None,
    levers: tuple[GrowthLever, ...] = GROWTH_LEVERS,
) -> CloseRateProjection:
    """
    Project the close rate after compounding the supplied levers.

    ``current`` defaults to the midpoint of the measured baseline band. Each
    lever multiplies the running rate; the result is capped at the ceiling. The
    per-lever breakdown reports the marginal absolute gain each lever adds *in
    sequence*, so the contributions sum to the total lift honestly.
    """
    start = (BASELINE_LOW + BASELINE_HIGH) / 2 if current is None else current
    rate = min(start, CLOSE_RATE_CEILING)
    applied: list[dict[str, object]] = []

    for lever in levers:
        before = rate
        rate = min(rate * lever.factor, CLOSE_RATE_CEILING)
        applied.append({
            "key": lever.key,
            "name": lever.name,
            "owner": lever.owner,
            "lift": lever.lift,
            "marginal_gain": round(rate - before, 4),
            "running_rate": round(rate, 4),
        })

    return CloseRateProjection(
        baseline_low=BASELINE_LOW,
        baseline_high=BASELINE_HIGH,
        current=start,
        projected=rate,
        ceiling=CLOSE_RATE_CEILING,
        applied=applied,
    )
