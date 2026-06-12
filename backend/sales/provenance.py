"""
Sales Data Provenance — SIMULATED | BLENDED | ACTUAL

The v2.1 truth layer. Distinct from the governance Truth-Layer tag
(LIVE/STAGED/SIMULATED/BLOCKED, which classifies an *action's* authority), this
classifies the *provenance of the data* behind a sales output:

    SIMULATED  No real NoblePort data. Synthetic team and lead board.
    BLENDED    Some real captured data, below the ACTUAL bar. Real + synthetic.
    ACTUAL     Enough real captured data that the model is NoblePort-specific.

The governing principle is **data-capture-first**: time alone never promotes the
model. You can run for twelve months and still be SIMULATED if you never
captured the opportunity→deposit→completion funnel. Promotion to BLENDED and
ACTUAL is gated on the *count* of real opportunities and completed projects
actually recorded — not the calendar.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class DataProvenance(str, Enum):
    SIMULATED = "SIMULATED"
    BLENDED = "BLENDED"
    ACTUAL = "ACTUAL"


# Data-capture-first thresholds. These are deliberately count-based, not
# time-based: the model earns its provenance by capturing real funnel data.
#
# BLENDED: a real signal exists — enough opportunities to influence scoring and
# at least one completed project to anchor margin.
MIN_OPPORTUNITIES_BLENDED = 40
MIN_COMPLETIONS_BLENDED = 1

# ACTUAL: a full year *and* a statistically meaningful captured funnel. Both the
# calendar and the capture bar must clear — twelve months of empty CRM is still
# SIMULATED.
MIN_MONTHS_ACTUAL = 12
MIN_OPPORTUNITIES_ACTUAL = 200
MIN_COMPLETIONS_ACTUAL = 30


@dataclass(frozen=True)
class CaptureState:
    """
    What NoblePort has actually recorded through the full revenue funnel.

    ``captured_opportunities`` counts real opportunities that reached at least
    the estimate stage; ``captured_completions`` counts real completed projects
    with realized gross profit. These are the numbers that gate provenance.
    """

    months_of_real_data: float = 0.0
    captured_opportunities: int = 0
    captured_completions: int = 0

    @property
    def provenance(self) -> DataProvenance:
        if (
            self.months_of_real_data >= MIN_MONTHS_ACTUAL
            and self.captured_opportunities >= MIN_OPPORTUNITIES_ACTUAL
            and self.captured_completions >= MIN_COMPLETIONS_ACTUAL
        ):
            return DataProvenance.ACTUAL
        if (
            self.captured_opportunities >= MIN_OPPORTUNITIES_BLENDED
            and self.captured_completions >= MIN_COMPLETIONS_BLENDED
        ):
            return DataProvenance.BLENDED
        return DataProvenance.SIMULATED

    @property
    def real_data_weight(self) -> float:
        """
        How much real data should drive decisions, 0..1.

        Ramps with captured opportunities toward the ACTUAL bar, so a BLENDED
        model leans more on real data the more it captures. Pure SIMULATED is 0;
        ACTUAL is 1.0.
        """
        if self.provenance is DataProvenance.SIMULATED:
            return 0.0
        if self.provenance is DataProvenance.ACTUAL:
            return 1.0
        # BLENDED: interpolate on captured opportunities between the two bars.
        span = max(MIN_OPPORTUNITIES_ACTUAL - MIN_OPPORTUNITIES_BLENDED, 1)
        progress = (self.captured_opportunities - MIN_OPPORTUNITIES_BLENDED) / span
        return round(min(max(progress, 0.0), 1.0), 3)

    @property
    def blocking_gaps(self) -> list[str]:
        """Concrete, actionable reasons the model has not reached ACTUAL yet."""
        gaps: list[str] = []
        if self.months_of_real_data < MIN_MONTHS_ACTUAL:
            gaps.append(
                f"{self.months_of_real_data:.0f}/{MIN_MONTHS_ACTUAL} months of production data"
            )
        if self.captured_opportunities < MIN_OPPORTUNITIES_ACTUAL:
            gaps.append(
                f"{self.captured_opportunities}/{MIN_OPPORTUNITIES_ACTUAL} captured opportunities"
            )
        if self.captured_completions < MIN_COMPLETIONS_ACTUAL:
            gaps.append(
                f"{self.captured_completions}/{MIN_COMPLETIONS_ACTUAL} completed projects with realized GP"
            )
        return gaps

    @property
    def next_action(self) -> str:
        prov = self.provenance
        if prov is DataProvenance.ACTUAL:
            return "Model is NoblePort-specific. Retrain quarterly on rolling production data."
        if prov is DataProvenance.BLENDED:
            return "Keep capturing the full funnel — close the gaps below to reach ACTUAL."
        return (
            "Data-capture-first: record opportunities → appointments → estimates → "
            "contracts → deposits → completions before trusting model output."
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "provenance": self.provenance.value,
            "months_of_real_data": self.months_of_real_data,
            "captured_opportunities": self.captured_opportunities,
            "captured_completions": self.captured_completions,
            "real_data_weight": self.real_data_weight,
            "blocking_gaps": self.blocking_gaps,
            "next_action": self.next_action,
            "thresholds": {
                "blended": {
                    "opportunities": MIN_OPPORTUNITIES_BLENDED,
                    "completions": MIN_COMPLETIONS_BLENDED,
                },
                "actual": {
                    "months": MIN_MONTHS_ACTUAL,
                    "opportunities": MIN_OPPORTUNITIES_ACTUAL,
                    "completions": MIN_COMPLETIONS_ACTUAL,
                },
            },
        }
