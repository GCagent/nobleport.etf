"""
Secret Classification Tiers

Implements section 4 of the Secrets Management Policy v1.0. Secrets are
categorized so the platform can enforce approval gates, caching limits, and
rotation cadence consistently and produce audit-grade evidence.

Tiers (highest sensitivity first):
    Tier 0 - Root / cryptographic material (signing keys, encryption keys)
    Tier 1 - Financial / payment secrets (Stripe, PayPal, primary datastore)
    Tier 2 - External data / API provider keys (market data feeds)
    Tier 3 - Internal service tokens (service-to-service auth)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class SecretTier(str, Enum):
    TIER_0 = "tier_0"
    TIER_1 = "tier_1"
    TIER_2 = "tier_2"
    TIER_3 = "tier_3"


@dataclass(frozen=True)
class TierPolicy:
    """Caching, approval, and rotation rules for a classification tier."""

    tier: SecretTier
    description: str
    # Maximum lifetime of a decrypted value in the in-memory cache.
    cache_ttl_seconds: int
    # Default scheduled rotation interval. ``None`` means rotation is event
    # driven only (e.g. on breach or access change) rather than on a clock.
    rotation_interval_days: int | None
    # Human description of the rotation expectation, for evidence packages.
    rotation_cadence: str
    # Who must approve a rotation or new grant for this tier.
    approval_gate: str


# Section 4 + section 6 (cache TTLs): Tier 1 caches for at most 60s; Tier 2/3
# may cache up to 5 minutes based on risk. Tier 0 material is held as briefly
# as Tier 1 given its blast radius.
TIER_POLICIES: dict[SecretTier, TierPolicy] = {
    SecretTier.TIER_0: TierPolicy(
        tier=SecretTier.TIER_0,
        description="Root / cryptographic material (encryption keys, signing keys, private keys)",
        cache_ttl_seconds=60,
        rotation_interval_days=365,
        rotation_cadence="Yearly (or immediately post-incident)",
        approval_gate="Security + dual-approver",
    ),
    SecretTier.TIER_1: TierPolicy(
        tier=SecretTier.TIER_1,
        description="Financial / payment secrets",
        cache_ttl_seconds=60,
        rotation_interval_days=90,
        rotation_cadence="Quarterly manual; also on staff change / termination",
        approval_gate="Security + Finance owner",
    ),
    SecretTier.TIER_2: TierPolicy(
        tier=SecretTier.TIER_2,
        description="External data / API provider keys",
        cache_ttl_seconds=300,
        rotation_interval_days=90,
        rotation_cadence="Every 90 days",
        approval_gate="Service owner",
    ),
    SecretTier.TIER_3: TierPolicy(
        tier=SecretTier.TIER_3,
        description="Internal service tokens",
        cache_ttl_seconds=300,
        rotation_interval_days=90,
        rotation_cadence="30-90 days (risk-based)",
        approval_gate="Service owner",
    ),
}


def policy_for(tier: SecretTier) -> TierPolicy:
    """Return the caching/rotation/approval policy for a tier."""
    return TIER_POLICIES[tier]
