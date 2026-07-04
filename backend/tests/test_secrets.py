"""
Tests for the Secrets Management layer.

These assert the policy's hard guarantees: tier-derived cache TTLs, an encrypted
cache that never stores plaintext, least-privilege single-secret retrieval that
fails closed on unknown names, rotation that invalidates the cache and fires
callbacks, the fail-fast startup gate (missing / malformed / overdue), and
value-free health output.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from backend.core.secrets import (
    SECRETS_INVENTORY,
    EncryptedSecretCache,
    EnvProvider,
    SecretNotFoundError,
    SecretsManager,
    SecretTier,
    get_spec,
    policy_for,
)
from backend.core.secrets.inventory import SecretSchema, SecretSpec
from backend.core.secrets.providers import SecretsProvider


class DictProvider(SecretsProvider):
    """In-memory provider for tests."""

    name = "dict"

    def __init__(self, values: dict[str, str]) -> None:
        self.values = values
        self.fetch_calls = 0

    def fetch(self, spec: SecretSpec) -> str | None:
        self.fetch_calls += 1
        return self.values.get(spec.name)


# ----- tiers & inventory --------------------------------------------------


def test_tier_cache_ttls_match_policy():
    # Section 6: Tier 1 caches for at most 60s; Tier 2/3 up to 5 minutes.
    assert policy_for(SecretTier.TIER_1).cache_ttl_seconds == 60
    assert policy_for(SecretTier.TIER_0).cache_ttl_seconds == 60
    assert policy_for(SecretTier.TIER_2).cache_ttl_seconds == 300
    assert policy_for(SecretTier.TIER_3).cache_ttl_seconds == 300


def test_inventory_covers_policy_table():
    names = {s.name for s in SECRETS_INVENTORY}
    for expected in (
        "finnhub-api-key",
        "coingecko-api-key",
        "alpha-vantage-key",
        "stripe-secret-key",
        "stripe-webhook-secret",
        "paypal-client-id",
        "paypal-secret",
        "database-url",
        "redis-url",
        "jwt-secret",
        "encryption-key",
    ):
        assert expected in names


def test_event_driven_rotation_has_no_clock_interval():
    # database-url / redis-url rotate "on breach / access change" only.
    assert get_spec("database-url").rotation_interval_days is None
    assert get_spec("redis-url").rotation_interval_days is None
    # Tier defaults still apply to clock-rotated secrets.
    assert get_spec("finnhub-api-key").rotation_interval_days == 90
    assert get_spec("jwt-secret").rotation_interval_days == 30


def test_schema_validation_flags_bad_shape():
    schema = SecretSchema(min_length=20, prefix="sk_")
    assert schema.validate("") == ["missing"]
    assert "expected prefix 'sk_'" in schema.validate("pk_short")
    assert schema.validate("sk_" + "x" * 30) == []


# ----- encrypted cache ----------------------------------------------------


def test_cache_roundtrip_and_no_plaintext_at_rest():
    cache = EncryptedSecretCache()
    cache.set("jwt-secret", "super-secret-value", ttl_seconds=60)
    assert cache.get("jwt-secret") == "super-secret-value"
    # The stored entry must not contain the plaintext anywhere.
    entry = cache._store["jwt-secret"]
    assert b"super-secret-value" not in entry.ciphertext
    assert b"super-secret-value" not in entry.nonce


def test_cache_expiry_evicts_and_misses():
    cache = EncryptedSecretCache()
    cache.set("jwt-secret", "v", ttl_seconds=0)
    assert cache.get("jwt-secret") is None
    stats = cache.stats()
    assert stats.expirations >= 1
    assert stats.entries == 0


def test_cache_invalidate_on_rotation():
    cache = EncryptedSecretCache()
    cache.set("jwt-secret", "v", ttl_seconds=60)
    assert cache.invalidate("jwt-secret") is True
    assert cache.get("jwt-secret") is None


# ----- manager retrieval --------------------------------------------------


def test_get_secret_uses_cache_and_avoids_refetch():
    provider = DictProvider({"jwt-secret": "abc"})
    mgr = SecretsManager(provider=provider)
    assert mgr.get_secret("jwt-secret") == "abc"
    assert mgr.get_secret("jwt-secret") == "abc"
    # Second call served from cache → provider hit only once.
    assert provider.fetch_calls == 1


def test_unknown_secret_fails_closed():
    mgr = SecretsManager(provider=DictProvider({}))
    with pytest.raises(KeyError):
        mgr.get_secret("not-in-inventory")


def test_missing_value_raises_not_found():
    mgr = SecretsManager(provider=DictProvider({}))
    with pytest.raises(SecretNotFoundError):
        mgr.get_secret("jwt-secret")
    assert mgr.try_get_secret("jwt-secret") is None


# ----- rotation -----------------------------------------------------------


def test_rotation_invalidates_cache_and_fires_callbacks():
    provider = DictProvider({"jwt-secret": "v1"})
    mgr = SecretsManager(provider=provider)
    fired: list[str] = []
    mgr.register_rotation_callback("jwt-secret", lambda name: fired.append(name))

    assert mgr.get_secret("jwt-secret") == "v1"
    provider.values["jwt-secret"] = "v2"
    mgr.rotate("jwt-secret")

    assert fired == ["jwt-secret"]
    # Cache was invalidated, so the new value is fetched.
    assert mgr.get_secret("jwt-secret") == "v2"


def test_failing_callback_does_not_block_rotation():
    mgr = SecretsManager(provider=DictProvider({"jwt-secret": "v"}))

    def boom(_name: str) -> None:
        raise RuntimeError("callback failure")

    ok: list[str] = []
    mgr.register_rotation_callback("jwt-secret", boom)
    mgr.register_rotation_callback("jwt-secret", lambda n: ok.append(n))
    mgr.rotate("jwt-secret")  # must not raise
    assert ok == ["jwt-secret"]


def test_rotation_status_marks_overdue():
    mgr = SecretsManager(provider=DictProvider({}))
    long_ago = datetime.now(timezone.utc) - timedelta(days=400)
    mgr.record_rotation("jwt-secret", long_ago)  # 30-day cadence → overdue
    statuses = {s.name: s for s in mgr.rotation_status()}
    assert statuses["jwt-secret"].overdue is True
    # Event-driven secrets are never clock-overdue.
    assert statuses["database-url"].overdue is False


# ----- startup gate -------------------------------------------------------


def test_startup_gate_blocks_on_missing_required():
    mgr = SecretsManager(provider=DictProvider({}))
    report = mgr.validate_startup()
    assert report.ok is False
    assert "jwt-secret" in report.missing
    assert "database-url" in report.missing


def test_startup_gate_flags_invalid_shape():
    provider = DictProvider(
        {"jwt-secret": "x" * 32, "database-url": "not-a-valid-url"}
    )
    mgr = SecretsManager(provider=provider)
    report = mgr.validate_startup()
    assert report.ok is False
    assert "database-url" in report.invalid


def test_startup_gate_passes_with_valid_required_secrets():
    provider = DictProvider(
        {
            "jwt-secret": "x" * 32,
            "database-url": "postgresql://user:pass@localhost:5432/db",
        }
    )
    mgr = SecretsManager(provider=provider)
    report = mgr.validate_startup()
    assert report.ok is True
    assert report.missing == []
    assert report.invalid == {}


def test_startup_gate_blocks_on_overdue_rotation():
    provider = DictProvider(
        {
            "jwt-secret": "x" * 32,
            "database-url": "postgresql://user:pass@localhost:5432/db",
        }
    )
    mgr = SecretsManager(provider=provider)
    mgr.record_rotation("jwt-secret", datetime.now(timezone.utc) - timedelta(days=400))
    blocked = mgr.validate_startup(block_on_overdue=True)
    assert blocked.ok is False
    assert "jwt-secret" in blocked.overdue
    # With override, an overdue secret no longer blocks the boot.
    overridden = mgr.validate_startup(block_on_overdue=False)
    assert overridden.ok is True


# ----- health -------------------------------------------------------------


def test_health_is_value_free():
    provider = DictProvider({"jwt-secret": "super-secret"})
    mgr = SecretsManager(provider=provider)
    mgr.get_secret("jwt-secret")
    health = mgr.health()
    assert health["provider"] == "dict"
    assert health["inventory_count"] == len(SECRETS_INVENTORY)
    assert health["cache"]["entries"] >= 1
    # No secret value may appear anywhere in the health payload.
    assert "super-secret" not in str(health)


def test_env_provider_reads_from_environment(monkeypatch):
    monkeypatch.setenv("NOBLEPORT_SECRET_KEY", "y" * 20)
    provider = EnvProvider()
    assert provider.fetch(get_spec("jwt-secret")) == "y" * 20
