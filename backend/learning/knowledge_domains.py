"""
Recursive Learning — Certification Alignment Engine.

The system never *claims* a credential. Instead it maps a topic onto the
knowledge domains it may legitimately reason about, and for each domain it names
the licensed professional who must review or certify anything that leaves the
draft stage. This mirrors the governance credential register (where ``can_claim``
is always False) and is the safe, defensible alternative to asserting
qualifications.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class KnowledgeDomain:
    """A field Stephanie may analyze — never a credential she holds."""

    name: str
    # Bodies of knowledge / frameworks the domain draws on (concepts, not claims).
    maps_to: tuple[str, ...]
    # The licensed professional who must review/certify before action.
    licensed_reviewer_required: str
    # Keywords that route a topic into this domain.
    keywords: tuple[str, ...]
    disclaimer: str = (
        "Knowledge-domain reasoning only. Stephanie holds no credential here; "
        "outputs are drafts requiring review by the named licensed professional."
    )

    def to_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "maps_to": list(self.maps_to),
            "licensed_reviewer_required": self.licensed_reviewer_required,
            "can_claim_credential": False,
            "disclaimer": self.disclaimer,
        }


CONSTRUCTION = KnowledgeDomain(
    name="Construction",
    maps_to=(
        "CSL knowledge",
        "HIC knowledge",
        "OSHA concepts",
        "project management",
    ),
    licensed_reviewer_required="CSL/HIC-licensed contractor",
    keywords=(
        "permit", "construction", "build", "contractor", "inspection",
        "schedule", "crew", "change order", "awo", "roofing", "coastal",
        "flood", "design-build", "closeout", "estimate", "cost",
    ),
)

REAL_ESTATE = KnowledgeDomain(
    name="Real Estate",
    maps_to=(
        "CCIM principles",
        "development analysis",
        "valuation models",
    ),
    licensed_reviewer_required="CCIM-designated professional / licensed appraiser",
    keywords=(
        "real estate", "adu", "zoning", "development", "valuation", "comps",
        "property", "land", "parcel", "nobleNest", "rwa", "lease",
    ),
)

FINANCE = KnowledgeDomain(
    name="Finance",
    maps_to=(
        "capital markets concepts",
        "treasury management",
        "compliance frameworks",
    ),
    licensed_reviewer_required="Licensed financial / securities advisor",
    keywords=(
        "finance", "treasury", "stablecoin", "payment", "payout", "stripe",
        "mercury", "capital", "liquidity", "tokenomics", "nbpt", "token",
        "usdc", "audit", "compliance", "revenue",
    ),
)

GOVERNANCE = KnowledgeDomain(
    name="Governance",
    maps_to=(
        "DAO governance",
        "risk controls",
        "audit systems",
    ),
    licensed_reviewer_required="Legal counsel / compliance officer",
    keywords=(
        "governance", "dao", "risk", "control", "audit", "regulatory",
        "legal", "policy", "authority", "kill switch", "escalation",
    ),
)


KNOWLEDGE_DOMAINS: dict[str, KnowledgeDomain] = {
    d.name: d for d in (CONSTRUCTION, REAL_ESTATE, FINANCE, GOVERNANCE)
}

# Domains whose outputs must be held for licensed human review before any action
# (they default a learning cycle to STAGED rather than SIMULATED).
REGULATED_DOMAINS: frozenset[str] = frozenset(
    {"Finance", "Real Estate", "Governance", "Construction"}
)


def map_knowledge_domains(text: str) -> list[KnowledgeDomain]:
    """
    Return the knowledge domains a free-text topic touches, by keyword match.

    Conservative by design: if nothing matches we return an empty list rather
    than guessing, so the caller can flag the topic as out of mapped scope.
    """
    haystack = text.lower()
    matched: list[KnowledgeDomain] = []
    for domain in KNOWLEDGE_DOMAINS.values():
        if any(keyword in haystack for keyword in domain.keywords):
            matched.append(domain)
    return matched
