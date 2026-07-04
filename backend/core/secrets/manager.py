"""
Secrets Manager (provider-agnostic abstraction layer)

Implements the runtime described in section 2 and the controls in sections
5, 6, 7, and 9 of the Secrets Management Policy v1.0:

  * Fetch only the secrets a service needs, by name (bulk listing prohibited).
  * Hold decrypted values in an encrypted, short-TTL in-memory cache.
  * Support rotation with callbacks so clients can reconnect / re-auth, and
    invalidate caches on change.
  * Fail fast at startup if required secrets are missing, malformed, or overdue
    for rotation (the startup gate).
  * Expose attributable, value-free health/stats for monitoring and audit.

Audit attribution (CloudTrail / GCP Data Access logs / Vault audit devices) is
produced by the providers themselves; this layer adds structured access logging
without ever emitting secret values.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable

from backend.core.secrets.cache import CacheStats, EncryptedSecretCache
from backend.core.secrets.inventory import SECRETS_INVENTORY, SecretSpec, get_spec
from backend.core.secrets.providers import EnvProvider, SecretsProvider
from backend.core.secrets.tiers import policy_for

logger = logging.getLogger("nobleport.secrets")

RotationCallback = Callable[[str], None]


class SecretNotFoundError(KeyError):
    """Raised when a known secret cannot be resolved by the active provider."""


@dataclass
class RotationStatus:
    name: str
    tier: str
    cadence: str
    interval_days: int | None
    last_rotated: datetime | None
    overdue: bool
    days_since_rotation: int | None


@dataclass
class StartupReport:
    ok: bool
    missing: list[str] = field(default_factory=list)
    invalid: dict[str, list[str]] = field(default_factory=dict)
    overdue: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "missing": self.missing,
            "invalid": self.invalid,
            "overdue": self.overdue,
        }


class SecretsManager:
    """Single entry point services use to resolve secrets at runtime."""

    def __init__(self, provider: SecretsProvider | None = None) -> None:
        self.provider: SecretsProvider = provider or EnvProvider()
        self._cache = EncryptedSecretCache()
        self._rotation_callbacks: dict[str, list[RotationCallback]] = {}
        self._last_rotated: dict[str, datetime] = {}

    # ----- retrieval -------------------------------------------------------

    def get_secret(self, name: str, *, use_cache: bool = True) -> str:
        """Resolve a single secret by inventory name (least-privilege fetch).

        Raises KeyError for unknown names (fail closed) and
        SecretNotFoundError when the provider has no value.
        """
        spec = get_spec(name)
        if spec is None:
            raise KeyError(f"Unknown secret {name!r}: not in the secrets inventory")

        if use_cache:
            cached = self._cache.get(name)
            if cached is not None:
                return cached

        value = self.provider.fetch(spec)
        if value is None:
            raise SecretNotFoundError(
                f"Secret {name!r} not available from provider {self.provider.name!r}"
            )

        ttl = policy_for(spec.tier).cache_ttl_seconds
        self._cache.set(name, value, ttl)
        logger.info(
            "secret_access",
            extra={"secret": name, "tier": spec.tier.value, "provider": self.provider.name},
        )
        return value

    def try_get_secret(self, name: str) -> str | None:
        """Like get_secret but returns None instead of raising when absent."""
        try:
            return self.get_secret(name)
        except (KeyError, SecretNotFoundError):
            return None

    # ----- rotation --------------------------------------------------------

    def register_rotation_callback(self, name: str, callback: RotationCallback) -> None:
        """Register a hook fired when ``name`` rotates (e.g. reconnect sockets)."""
        self._rotation_callbacks.setdefault(name, []).append(callback)

    def rotate(self, name: str, *, when: datetime | None = None) -> None:
        """Mark a secret rotated: invalidate cache and fire callbacks.

        For JWT signing keys this is the hook that forces re-authentication;
        callbacks are responsible for broadcasting the re-auth requirement.
        """
        if get_spec(name) is None:
            raise KeyError(f"Unknown secret {name!r}: not in the secrets inventory")
        self._cache.invalidate(name)
        self._last_rotated[name] = when or datetime.now(timezone.utc)
        for callback in self._rotation_callbacks.get(name, []):
            try:
                callback(name)
            except Exception:  # noqa: BLE001 - one bad callback must not block rotation
                logger.exception("rotation_callback_failed", extra={"secret": name})

    def record_rotation(self, name: str, when: datetime) -> None:
        """Record a rotation that happened out of band (e.g. provider dashboard)."""
        if get_spec(name) is None:
            raise KeyError(f"Unknown secret {name!r}: not in the secrets inventory")
        self._last_rotated[name] = when

    def rotation_status(self, *, now: datetime | None = None) -> list[RotationStatus]:
        now = now or datetime.now(timezone.utc)
        statuses: list[RotationStatus] = []
        for spec in SECRETS_INVENTORY:
            last = self._last_rotated.get(spec.name)
            interval = spec.rotation_interval_days
            days_since = (now - last).days if last else None
            overdue = bool(
                interval is not None
                and last is not None
                and now - last > timedelta(days=interval)
            )
            statuses.append(
                RotationStatus(
                    name=spec.name,
                    tier=spec.tier.value,
                    cadence=spec.rotation_cadence,
                    interval_days=interval,
                    last_rotated=last,
                    overdue=overdue,
                    days_since_rotation=days_since,
                )
            )
        return statuses

    # ----- startup gate ----------------------------------------------------

    def validate_startup(self, *, block_on_overdue: bool = True) -> StartupReport:
        """Section 9 startup gate: required secrets must be present and valid.

        Returns a report; callers decide whether to abort the boot. Overdue
        rotation blocks by default and requires an explicit override.
        """
        report = StartupReport(ok=True)
        for spec in SECRETS_INVENTORY:
            value = self.provider.fetch(spec)
            if value is None:
                if spec.required:
                    report.missing.append(spec.name)
                    report.ok = False
                continue
            problems = spec.schema.validate(value)
            if problems:
                report.invalid[spec.name] = problems
                if spec.required:
                    report.ok = False

        for status in self.rotation_status():
            if status.overdue:
                report.overdue.append(status.name)
                if block_on_overdue:
                    report.ok = False

        return report

    # ----- monitoring / audit ---------------------------------------------

    def cache_stats(self) -> CacheStats:
        return self._cache.stats()

    def invalidate_cache(self, name: str | None = None) -> None:
        if name is None:
            self._cache.clear()
        else:
            self._cache.invalidate(name)

    def health(self) -> dict:
        """Value-free health snapshot for /api/health/secrets and monitoring."""
        stats = self.cache_stats()
        rotation = self.rotation_status()
        return {
            "provider": self.provider.name,
            "inventory_count": len(SECRETS_INVENTORY),
            "cache": {
                "entries": stats.entries,
                "hits": stats.hits,
                "misses": stats.misses,
                "expirations": stats.expirations,
                "evictions": stats.evictions,
            },
            "rotation_callbacks": {
                name: len(cbs) for name, cbs in self._rotation_callbacks.items()
            },
            "rotation": [
                {
                    "name": s.name,
                    "tier": s.tier,
                    "cadence": s.cadence,
                    "interval_days": s.interval_days,
                    "last_rotated": s.last_rotated.isoformat() if s.last_rotated else None,
                    "days_since_rotation": s.days_since_rotation,
                    "overdue": s.overdue,
                }
                for s in rotation
            ],
            "overdue_count": sum(1 for s in rotation if s.overdue),
        }


_default_manager: SecretsManager | None = None


def get_secrets_manager() -> SecretsManager:
    """Process-wide SecretsManager (env provider by default)."""
    global _default_manager
    if _default_manager is None:
        _default_manager = SecretsManager()
    return _default_manager


def set_secrets_manager(manager: SecretsManager) -> None:
    """Install the process-wide SecretsManager (e.g. the configured provider)."""
    global _default_manager
    _default_manager = manager
