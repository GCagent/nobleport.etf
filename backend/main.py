"""
NoblePort Backend — Matter OS v2.0 (Layer 4: Backend Logic)

FastAPI application serving as the backend service layer for the
Stephanie.ai Production Stack.

Architecture Layers:
  Layer 1: Stephanie.ai     → Constitutional AI Executive
  Layer 2: Agent Layer      → GCagent.ai, PermitStream.ai, TreasuryBotV3
  Layer 3: Vercel           → Frontend Delivery (Next.js 15 + Edge)
  Layer 4: This Backend     → FastAPI + LangGraph + PostgreSQL
  Layer 5: Trust Infra      → AuditBeacon + IPFS + Arweave + Safe
  Layer 6: Blockchain       → Solana Token-2022 + zkSBT

Revenue spine: Lead → Intake → Estimate → Permit → Build → Invoice → Closeout

Design principle: Backend-authoritative for all regulated calculations.
Sovereignty mandate: US-based nodes only.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.health import router as health_router
from backend.api.leads import router as leads_router
from backend.api.projects import router as projects_router
from backend.api.schedules import router as schedules_router
from backend.api.invoices import router as invoices_router
from backend.api.buildertrend import router as buildertrend_router
from backend.api.sync import router as sync_router
from backend.api.bridge import router as bridge_router
from backend.api.estimates import router as estimates_router
from backend.api.jobs import router as jobs_router
from backend.api.payments import router as payments_router
from backend.api.change_orders import router as change_orders_router
from backend.api.revenue import router as revenue_router
from backend.api.dashboard import router as dashboard_router
from backend.api.mcp_gateway import router as mcp_router
from backend.api.kpi import router as kpi_router
from backend.api.audit_api import router as audit_router
from backend.config.database import init_db
from backend.config.module_registry import AGENT_DEFINITIONS
from backend.config.settings import settings
from backend.mcp.gateway import gateway as mcp_gateway
from backend.services.kpi_worker import kpi_worker
from backend.services.sync_engine import SyncEngine
from backend.services.hubspot_sync import HubSpotSyncService
import backend.models  # noqa: F401 - ensure all models registered with Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    await init_db()

    # Register MCP agents
    for agent_def in AGENT_DEFINITIONS:
        mcp_gateway.register_agent(
            agent_name=agent_def["agent_name"],
            endpoint=agent_def["endpoint"],
            owner_domain=agent_def["owner_domain"],
        )

    # Initial KPI collection (all modules start BLOCKED)
    await kpi_worker.collect_all()

    sync_engine = SyncEngine()
    app.state.sync_engine = sync_engine

    hubspot_sync = HubSpotSyncService()
    app.state.hubspot_sync = hubspot_sync

    if settings.buildertrend_sync_mode.value == "scheduled":
        await sync_engine.start_scheduled_sync()

    if settings.hubspot_sync_enabled:
        await hubspot_sync.start_scheduled_sync()

    yield

    if hasattr(app.state, "sync_engine"):
        await app.state.sync_engine.stop()
    if hasattr(app.state, "hubspot_sync"):
        await app.state.hubspot_sync.stop()


app = FastAPI(
    title="NoblePort Matter OS — Backend Service Layer",
    description=(
        "Layer 4 of the Stephanie.ai Production Stack. "
        "Provides construction project management APIs, multi-agent orchestration, "
        "revenue spine enforcement, and integration bridge for the NoblePort ecosystem."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(leads_router, prefix="/api/leads", tags=["Leads"])
app.include_router(projects_router, prefix="/api/projects", tags=["Projects"])
app.include_router(schedules_router, prefix="/api/schedules", tags=["Schedules"])
app.include_router(invoices_router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(buildertrend_router, prefix="/api/buildertrend", tags=["Buildertrend"])
app.include_router(sync_router, prefix="/api/sync", tags=["Sync"])
app.include_router(bridge_router, prefix="/api/bridge", tags=["NoblePort Bridge"])
app.include_router(estimates_router, prefix="/api/estimates", tags=["Estimates"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(payments_router, prefix="/api/payments", tags=["Payments"])
app.include_router(change_orders_router, prefix="/api/change-orders", tags=["Change Orders (AWO)"])
app.include_router(revenue_router, prefix="/api/revenue", tags=["Revenue Engine"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Mission Control"])
app.include_router(mcp_router, prefix="/api/mcp", tags=["MCP Gateway"])
app.include_router(kpi_router, prefix="/api/kpi", tags=["KPI Dashboard"])
app.include_router(audit_router, prefix="/api/audit", tags=["AuditBeacon"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
