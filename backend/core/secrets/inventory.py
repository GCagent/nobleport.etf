"""
Secrets Inventory

Implements section 10 of the Secrets Management Policy v1.0. Every secret used
in production must appear here with a tier classification, documented purpose,
rotation policy, and a validation schema used by the startup gate (section 9).

New secrets require a tier classification, documented purpose, and rotation
policy before production use — add them here first.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from backend.core.secrets.tiers import SecretTier, policy_for


@dataclass(frozen=True)
class SecretSchema:
    """Lightweight format expectations enforced by the startup gate.

    The gate validates presence and shape only — it never logs or stores the
    secret value itself.
    """

    min_length: int = 1
    prefix: str | None = None
    pattern: str | None = None

    def validate(self, value: str) -> list[str]:
        """Return a list of human-readable problems; empty means valid."""
        problems: list[str] = []
        if value is None or value == "":
            return ["missing"]
        if len(value) < self.min_length:
            problems.append(f"shorter than minimum length {self.min_length}")
        if self.prefix and not value.startswith(self.prefix):
            problems.append(f"expected prefix {self.prefix!r}")
        if self.pattern and not re.fullmatch(self.pattern, value):
            problems.append("does not match required format")
        return problems


@dataclass(frozen=True)
class SecretSpec:
    """A single inventoried secret and the rules that govern it."""

    name: str
    tier: SecretTier
    usage: str
    # Environment-variable name used by the local/dev EnvProvider. Production
    # providers resolve by ``name`` under an environment-scoped prefix.
    env_var: str
    schema: SecretSchema = field(default_factory=SecretSchema)
    # Whether a deployment may not start without this secret present and valid.
    required: bool = True
    # Override the tier's default rotation. ``None`` keeps the tier default;
    # a value of ``0`` denotes event-driven rotation (breach / access change).
    rotation_interval_days_override: int | None = None
    rotation_cadence_override: str | None = None

    @property
    def rotation_interval_days(self) -> int | None:
        if self.rotation_interval_days_override is not None:
            # 0 is the sentinel for "event-driven only".
            return None if self.rotation_interval_days_override == 0 else self.rotation_interval_days_override
        return policy_for(self.tier).rotation_interval_days

    @property
    def rotation_cadence(self) -> str:
        if self.rotation_cadence_override is not None:
            return self.rotation_cadence_override
        return policy_for(self.tier).rotation_cadence


# Section 10: Secrets Inventory. Mirrors the policy table verbatim.
SECRETS_INVENTORY: tuple[SecretSpec, ...] = (
    SecretSpec(
        name="finnhub-api-key",
        tier=SecretTier.TIER_2,
        usage="Market data",
        env_var="NOBLEPORT_FINNHUB_API_KEY",
        required=False,
    ),
    SecretSpec(
        name="coingecko-api-key",
        tier=SecretTier.TIER_2,
        usage="Crypto data",
        env_var="NOBLEPORT_COINGECKO_API_KEY",
        required=False,
    ),
    SecretSpec(
        name="alpha-vantage-key",
        tier=SecretTier.TIER_2,
        usage="Failover data",
        env_var="NOBLEPORT_ALPHA_VANTAGE_KEY",
        required=False,
    ),
    SecretSpec(
        name="stripe-secret-key",
        tier=SecretTier.TIER_1,
        usage="Payments",
        env_var="NOBLEPORT_STRIPE_SECRET_KEY",
        schema=SecretSchema(min_length=20, prefix="sk_"),
        required=False,
    ),
    SecretSpec(
        name="stripe-webhook-secret",
        tier=SecretTier.TIER_1,
        usage="Webhook verification",
        env_var="NOBLEPORT_STRIPE_WEBHOOK_SECRET",
        schema=SecretSchema(min_length=20, prefix="whsec_"),
        required=False,
    ),
    SecretSpec(
        name="paypal-client-id",
        tier=SecretTier.TIER_1,
        usage="PayPal auth",
        env_var="NOBLEPORT_PAYPAL_CLIENT_ID",
        required=False,
    ),
    SecretSpec(
        name="paypal-secret",
        tier=SecretTier.TIER_1,
        usage="PayPal auth",
        env_var="NOBLEPORT_PAYPAL_SECRET",
        required=False,
    ),
    SecretSpec(
        name="database-url",
        tier=SecretTier.TIER_1,
        usage="Datastore connection",
        env_var="NOBLEPORT_DATABASE_URL",
        schema=SecretSchema(min_length=10, pattern=r"(postgres|postgresql|sqlite)(\+\w+)?://.*"),
        required=True,
        rotation_interval_days_override=0,  # event-driven: on breach / access change
        rotation_cadence_override="On breach / access change",
    ),
    SecretSpec(
        name="redis-url",
        tier=SecretTier.TIER_2,
        usage="Cache connection",
        env_var="NOBLEPORT_REDIS_URL",
        schema=SecretSchema(min_length=8, pattern=r"rediss?://.*"),
        required=False,
        rotation_interval_days_override=0,  # event-driven: on breach / access change
        rotation_cadence_override="On breach / access change",
    ),
    SecretSpec(
        name="jwt-secret",
        tier=SecretTier.TIER_0,
        usage="Token signing",
        env_var="NOBLEPORT_SECRET_KEY",
        schema=SecretSchema(min_length=16),
        required=True,
        rotation_interval_days_override=30,  # risk-based
        rotation_cadence_override="30 days (risk-based)",
    ),
    SecretSpec(
        name="encryption-key",
        tier=SecretTier.TIER_0,
        usage="Data encryption",
        env_var="NOBLEPORT_ENCRYPTION_KEY",
        schema=SecretSchema(min_length=32),
        required=False,
    ),
)

SECRETS_BY_NAME: dict[str, SecretSpec] = {spec.name: spec for spec in SECRETS_INVENTORY}


def get_spec(name: str) -> SecretSpec | None:
    return SECRETS_BY_NAME.get(name)
