"""
NoblePort Backend — Main Application Entry Point

FastAPI application serving as the Python/Linux backend for NoblePort Networks.

Architecture:
  Stephanie.ai  → intake / orchestration interface
  GCagent.ai    → construction execution agent
  PermitStream.ai → permit intelligence (MA-focused)
  This backend  → API gateway, data layer, integration bridge

Revenue spine: Lead → Intake → Estimate → Permit → Build → Invoice → Closeout
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
from backend.api.sales import router as sales_router
from backend.api.program import router as program_router
from backend.api.systems import router as systems_router
from backend.api.modules import router as modules_router
from backend.api.gateway import router as gateway_router
from backend.api.dashboard import router as dashboard_router
from backend.api.trust import router as trust_router
from backend.api.ops_brief import router as ops_brief_router
from backend.api.governance import router as governance_router
from backend.config.database import init_db
from backend.config.settings import settings
from backend.services.sync_engine import SyncEngine
from backend.services.hubspot_sync import HubSpotSyncService
from backend.agents.orchestrator import AgentMesh
import backend.models  # noqa: F401 - ensure all models registered with Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    await init_db()

    sync_engine = SyncEngine()
    app.state.sync_engine = sync_engine

    hubspot_sync = HubSpotSyncService()
    app.state.hubspot_sync = hubspot_sync

    agent_mesh = AgentMesh()
    app.state.agent_mesh = agent_mesh

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
    title="NoblePort OS",
    description=(
        "AI-operated infrastructure for construction, permitting, estimating, "
        "compliance, payments, and project execution. Powered by Stephanie.ai "
        "(intake/routing), GCagent.ai (construction execution), PermitStream.ai "
        "(permit/compliance), Cyborg.ai (security/governance), and AuditBeacon "
        "(immutable operational memory)."
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
app.include_router(sales_router, prefix="/api/sales", tags=["Sales Intelligence (GPPI)"])
app.include_router(program_router, prefix="/api/program", tags=["Program Completion"])
app.include_router(systems_router, prefix="/api/systems", tags=["Systems Truth Registry"])
app.include_router(modules_router, prefix="/api/modules", tags=["Stephanie.ai Modules"])
app.include_router(gateway_router, prefix="/api/gateway", tags=["MCP Control Gateway"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Mission Control"])
app.include_router(trust_router, prefix="/api/trust", tags=["Proof of Trust"])
app.include_router(ops_brief_router, prefix="/api/ops-brief", tags=["Stephanie Ops Brief"])
app.include_router(governance_router, prefix="/api/governance", tags=["Stephanie Governance"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
