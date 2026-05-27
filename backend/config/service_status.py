"""
Service Status Matrix — Matter OS v2.0

Cross-references all production services against their deployment status
and environment. This is the canonical source for the /api/health endpoint
and dashboard status indicators.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ServiceStatus(str, Enum):
    LIVE = "LIVE"
    STAGED = "STAGED"
    MODELED = "MODELED"
    EXTERNAL = "EXTERNAL"


class ServiceEnvironment(str, Enum):
    PRODUCTION = "Production"
    DEVELOPMENT = "Development"
    TEST_MODE = "Test mode"
    SANDBOX = "Sandbox"
    DEVNET = "Devnet"
    SPEC_ONLY = "Specification only"
    EXTERNAL = "External service"
    CONFIGURATION = "Configuration"


@dataclass(frozen=True)
class ServiceEntry:
    name: str
    status: ServiceStatus
    environment: ServiceEnvironment
    layer: str


SERVICE_MATRIX: tuple[ServiceEntry, ...] = (
    ServiceEntry("Stephanie.ai Core", ServiceStatus.STAGED, ServiceEnvironment.DEVELOPMENT, "Executive AI"),
    ServiceEntry("Vercel Deployment", ServiceStatus.LIVE, ServiceEnvironment.PRODUCTION, "Frontend Delivery"),
    ServiceEntry("FastAPI Backend", ServiceStatus.STAGED, ServiceEnvironment.DEVELOPMENT, "Backend Logic"),
    ServiceEntry("PostgreSQL", ServiceStatus.LIVE, ServiceEnvironment.PRODUCTION, "Backend Logic"),
    ServiceEntry("Redis", ServiceStatus.STAGED, ServiceEnvironment.DEVELOPMENT, "Backend Logic"),
    ServiceEntry("HubSpot", ServiceStatus.LIVE, ServiceEnvironment.PRODUCTION, "CRM"),
    ServiceEntry("Stripe", ServiceStatus.STAGED, ServiceEnvironment.TEST_MODE, "Treasury"),
    ServiceEntry("Harvey.ai", ServiceStatus.LIVE, ServiceEnvironment.EXTERNAL, "Operational Systems"),
    ServiceEntry("Parallel Markets", ServiceStatus.STAGED, ServiceEnvironment.SANDBOX, "Trust Infrastructure"),
    ServiceEntry("Solana Programs", ServiceStatus.STAGED, ServiceEnvironment.DEVNET, "Blockchain Execution"),
    ServiceEntry("zkSBT Engine", ServiceStatus.MODELED, ServiceEnvironment.SPEC_ONLY, "Trust Infrastructure"),
    ServiceEntry("ElevenLabs", ServiceStatus.STAGED, ServiceEnvironment.DEVELOPMENT, "Voice/Avatar"),
    ServiceEntry("LiveKit", ServiceStatus.STAGED, ServiceEnvironment.DEVELOPMENT, "Voice/Avatar"),
    ServiceEntry("AuditBeacon", ServiceStatus.MODELED, ServiceEnvironment.SPEC_ONLY, "Trust Infrastructure"),
    ServiceEntry("Safe Multisig", ServiceStatus.STAGED, ServiceEnvironment.CONFIGURATION, "Treasury"),
)


def get_live_services() -> list[ServiceEntry]:
    return [s for s in SERVICE_MATRIX if s.status == ServiceStatus.LIVE]


def get_services_by_layer(layer: str) -> list[ServiceEntry]:
    return [s for s in SERVICE_MATRIX if s.layer == layer]
