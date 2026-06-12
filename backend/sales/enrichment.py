"""
Tax-Aware Real Estate Enrichment — Advisory Only (CPA Review Required)

A *future* enrichment layer: when a lead is an investor redevelopment, property
acquisition, or estate opportunity, the sales OS can surface tax-aware talking
points that make NoblePort a more valuable partner. This is deliberately
advisory-only and CPA-gated — the system never computes a tax position, files
anything, or lets a rep present these as advice. Every output is flagged
``advisory_only`` and ``cpa_review_required`` and routed through the human gate.

The point of shipping it now as an explicit stub is to lock the *guardrails* in
code before the capability exists, so it can never quietly become unreviewed
tax advice.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.sales.governance import SalesAction, classify_action
from backend.sales.hierarchy import RevenueTier, tier_of

# Service lines for which tax-aware enrichment is even considered.
_ELIGIBLE_LINES = frozenset(
    {"investor_redevelopment", "property_acquisition", "design_build", "addition"}
)

# Talking-point templates. These are conversation starters for a CPA, never
# conclusions. Each is phrased as a question to take to a tax professional.
_ADVISORY_TOPICS: dict[str, str] = {
    "1031_exchange": "Could a 1031 like-kind exchange defer gain on the disposed property? (CPA to confirm eligibility/timing.)",
    "cost_segregation": "Would a cost-segregation study accelerate depreciation on the improvements? (CPA/engineer study required.)",
    "capital_improvement_basis": "Which scope items add to cost basis vs. deductible repairs? (CPA to classify.)",
    "passive_activity": "How do passive-activity loss rules affect this investor's position? (CPA to assess.)",
    "opportunity_zone": "Is the parcel in a Qualified Opportunity Zone with deferral potential? (CPA to verify designation.)",
}


@dataclass
class TaxAdvisory:
    eligible: bool
    advisory_only: bool = True
    cpa_review_required: bool = True
    topics: list[dict[str, str]] = field(default_factory=list)
    disclaimer: str = (
        "Advisory only. Not tax advice. NoblePort does not provide tax, legal, or "
        "accounting advice. Every item requires review by a licensed CPA before use."
    )
    governance: dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> dict[str, object]:
        return {
            "eligible": self.eligible,
            "advisory_only": self.advisory_only,
            "cpa_review_required": self.cpa_review_required,
            "topics": self.topics,
            "disclaimer": self.disclaimer,
            "governance": self.governance,
        }


def enrich_lead(service_line: str, estimated_value: float = 0.0) -> TaxAdvisory:
    """
    Produce CPA-gated tax-aware talking points for an eligible high-value lead.

    Always advisory-only. The governance disposition is attached so the caller
    can see — and must honor — that this is a HUMAN-gated, CPA-required action.
    """
    disposition = classify_action(SalesAction.TAX_ADVISORY, amount_usd=estimated_value)

    eligible = (
        service_line in _ELIGIBLE_LINES
        and tier_of(service_line) in {RevenueTier.TIER_1, RevenueTier.TIER_2}
    )
    topics: list[dict[str, str]] = []
    if eligible:
        # Investor/acquisition deals get the full set; build-side deals get the
        # basis-classification question only.
        if service_line in {"investor_redevelopment", "property_acquisition"}:
            keys = list(_ADVISORY_TOPICS)
        else:
            keys = ["capital_improvement_basis"]
        topics = [{"topic": k, "question": _ADVISORY_TOPICS[k]} for k in keys]

    return TaxAdvisory(
        eligible=eligible,
        topics=topics,
        governance=disposition.to_dict(),
    )
