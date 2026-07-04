"""
NoblePort Integration Connector Registry

Manages the status, health, and sync lifecycle of all external service
integrations:

  - HubSpot (CRM / lead sync)
  - Google Calendar (scheduling)
  - Stripe (deposits / payments)
  - CostCertified (estimating bridge)
  - Buildertrend (field operations)

Each integration is tracked as an ``IntegrationConnector`` with its own
health check, sync interval, and last-sync timestamp.  The
``IntegrationRegistry`` provides a single pane of glass for integration
health and a ``sync_all()`` trigger.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class IntegrationStatus(str, Enum):
    """Connection status for an external integration."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    DEGRADED = "degraded"
    NOT_CONFIGURED = "not_configured"


# ---------------------------------------------------------------------------
# Integration Connector
# ---------------------------------------------------------------------------

@dataclass
class IntegrationConnector:
    """
    Represents a single external service integration.

    Attributes:
        name: Human-readable name (e.g. "HubSpot CRM").
        service: Machine identifier (e.g. "hubspot").
        status: Current connection status.
        last_sync: When the integration last successfully synced.
        sync_interval_seconds: How often the integration should sync.
        config: Opaque configuration dict (API keys, tenant IDs, etc.).
        health_check: Async callable that probes the service and returns
                      an IntegrationStatus.
        sync_fn: Async callable that performs a full or incremental sync.
        error_message: Last error message if status is DEGRADED or DISCONNECTED.
        records_synced: Total records synced in the last run.
    """

    name: str
    service: str
    status: IntegrationStatus = IntegrationStatus.NOT_CONFIGURED
    last_sync: datetime | None = None
    sync_interval_seconds: int = 300  # 5 minutes default
    config: dict[str, Any] = field(default_factory=dict)
    health_check: Callable[[], Awaitable[IntegrationStatus]] | None = None
    sync_fn: Callable[[], Awaitable[dict[str, Any]]] | None = None
    error_message: str | None = None
    records_synced: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "service": self.service,
            "status": self.status.value,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "sync_interval_seconds": self.sync_interval_seconds,
            "error_message": self.error_message,
            "records_synced": self.records_synced,
        }

    async def check_health(self) -> IntegrationStatus:
        """Run the health check and update status."""
        if self.health_check is None:
            return self.status

        try:
            self.status = await self.health_check()
            if self.status == IntegrationStatus.CONNECTED:
                self.error_message = None
        except Exception as exc:
            logger.warning("Health check failed for %s: %s", self.service, exc)
            self.status = IntegrationStatus.DEGRADED
            self.error_message = str(exc)

        return self.status

    async def sync(self) -> dict[str, Any]:
        """Execute a sync and update metadata."""
        if self.sync_fn is None:
            return {"status": "no_sync_function", "service": self.service}

        if self.status == IntegrationStatus.NOT_CONFIGURED:
            return {"status": "not_configured", "service": self.service}

        try:
            result = await self.sync_fn()
            self.last_sync = datetime.now(timezone.utc)
            self.records_synced = result.get("records_synced", 0)
            self.status = IntegrationStatus.CONNECTED
            self.error_message = None
            logger.info(
                "Sync complete for %s: %d records",
                self.service, self.records_synced,
            )
            return {
                "status": "success",
                "service": self.service,
                "records_synced": self.records_synced,
                "synced_at": self.last_sync.isoformat(),
            }
        except Exception as exc:
            self.status = IntegrationStatus.DEGRADED
            self.error_message = str(exc)
            logger.error("Sync failed for %s: %s", self.service, exc)
            return {
                "status": "error",
                "service": self.service,
                "error": str(exc),
            }


# ---------------------------------------------------------------------------
# Integration Registry
# ---------------------------------------------------------------------------

class IntegrationRegistry:
    """
    Central registry for all NoblePort integrations.

    Provides:
    - Registration of integration connectors
    - Aggregate health status
    - Batch sync across all connected integrations
    - Individual integration lookup
    """

    def __init__(self) -> None:
        self._integrations: dict[str, IntegrationConnector] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        """Register the standard NoblePort integrations (unconfigured)."""

        self.register(IntegrationConnector(
            name="HubSpot CRM",
            service="hubspot",
            status=IntegrationStatus.NOT_CONFIGURED,
            sync_interval_seconds=300,
        ))

        self.register(IntegrationConnector(
            name="Google Calendar",
            service="google_calendar",
            status=IntegrationStatus.NOT_CONFIGURED,
            sync_interval_seconds=60,
        ))

        self.register(IntegrationConnector(
            name="Stripe Payments",
            service="stripe",
            status=IntegrationStatus.NOT_CONFIGURED,
            sync_interval_seconds=120,
        ))

        self.register(IntegrationConnector(
            name="CostCertified Estimating",
            service="costcertified",
            status=IntegrationStatus.NOT_CONFIGURED,
            sync_interval_seconds=600,
        ))

        self.register(IntegrationConnector(
            name="Buildertrend Field Ops",
            service="buildertrend",
            status=IntegrationStatus.NOT_CONFIGURED,
            sync_interval_seconds=300,
        ))

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, connector: IntegrationConnector) -> None:
        """Register or replace an integration connector."""
        self._integrations[connector.service] = connector
        logger.info("Registered integration: %s (%s)", connector.name, connector.service)

    def get(self, service: str) -> IntegrationConnector | None:
        """Look up an integration by service identifier."""
        return self._integrations.get(service)

    def configure(
        self,
        service: str,
        *,
        config: dict[str, Any] | None = None,
        health_check: Callable[[], Awaitable[IntegrationStatus]] | None = None,
        sync_fn: Callable[[], Awaitable[dict[str, Any]]] | None = None,
        sync_interval_seconds: int | None = None,
    ) -> IntegrationConnector:
        """
        Configure an existing integration with credentials, health check,
        and sync function.
        """
        connector = self._integrations.get(service)
        if connector is None:
            raise ValueError(f"Integration {service!r} not registered")

        if config is not None:
            connector.config = config
        if health_check is not None:
            connector.health_check = health_check
        if sync_fn is not None:
            connector.sync_fn = sync_fn
        if sync_interval_seconds is not None:
            connector.sync_interval_seconds = sync_interval_seconds

        connector.status = IntegrationStatus.DISCONNECTED  # configured but not yet verified
        logger.info("Configured integration: %s", service)
        return connector

    # ------------------------------------------------------------------
    # Health & Sync
    # ------------------------------------------------------------------

    async def get_integration_health(self) -> dict[str, Any]:
        """
        Return the health status of all registered integrations.

        Runs health checks in parallel for all configured integrations.
        """
        # Run health checks for configured integrations
        configured = [
            c for c in self._integrations.values()
            if c.status != IntegrationStatus.NOT_CONFIGURED
        ]
        if configured:
            await asyncio.gather(*(c.check_health() for c in configured))

        integrations_status = []
        connected_count = 0
        degraded_count = 0
        disconnected_count = 0
        not_configured_count = 0

        for connector in self._integrations.values():
            integrations_status.append(connector.to_dict())
            match connector.status:
                case IntegrationStatus.CONNECTED:
                    connected_count += 1
                case IntegrationStatus.DEGRADED:
                    degraded_count += 1
                case IntegrationStatus.DISCONNECTED:
                    disconnected_count += 1
                case IntegrationStatus.NOT_CONFIGURED:
                    not_configured_count += 1

        total = len(self._integrations)
        overall_health: str
        if degraded_count > 0 or disconnected_count > 0:
            overall_health = "degraded"
        elif connected_count == total - not_configured_count and connected_count > 0:
            overall_health = "healthy"
        else:
            overall_health = "unknown"

        return {
            "overall_health": overall_health,
            "total": total,
            "connected": connected_count,
            "degraded": degraded_count,
            "disconnected": disconnected_count,
            "not_configured": not_configured_count,
            "integrations": integrations_status,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    async def sync_all(self) -> dict[str, Any]:
        """
        Trigger sync for all connected integrations.

        Returns a summary of sync results.
        """
        syncable = [
            c for c in self._integrations.values()
            if c.status in (IntegrationStatus.CONNECTED, IntegrationStatus.DEGRADED)
            and c.sync_fn is not None
        ]

        if not syncable:
            return {
                "status": "no_syncable_integrations",
                "results": [],
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }

        results = await asyncio.gather(
            *(c.sync() for c in syncable),
            return_exceptions=True,
        )

        sync_results = []
        for connector, result in zip(syncable, results):
            if isinstance(result, Exception):
                sync_results.append({
                    "service": connector.service,
                    "status": "error",
                    "error": str(result),
                })
            else:
                sync_results.append(result)

        success_count = sum(1 for r in sync_results if r.get("status") == "success")

        return {
            "status": "complete",
            "total_synced": success_count,
            "total_attempted": len(syncable),
            "results": sync_results,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

    async def sync_one(self, service: str) -> dict[str, Any]:
        """Trigger sync for a single integration."""
        connector = self._integrations.get(service)
        if connector is None:
            raise ValueError(f"Integration {service!r} not registered")
        return await connector.sync()

    # ------------------------------------------------------------------
    # Enumeration
    # ------------------------------------------------------------------

    def list_all(self) -> list[IntegrationConnector]:
        """Return all registered integrations."""
        return list(self._integrations.values())

    @property
    def services(self) -> list[str]:
        """Return all registered service identifiers."""
        return list(self._integrations.keys())
