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
from backend.api.proposals import router as proposals_router
from backend.api.jobs import router as jobs_router
from backend.api.payments import router as payments_router
from backend.api.change_orders import router as change_orders_router
from backend.api.revenue import router as revenue_router
from backend.api.dashboard import router as dashboard_router
from backend.api.trust import router as trust_router
from backend.api.ops_brief import router as ops_brief_router
from backend.api.governance import router as governance_router
from backend.api.learning import router as learning_router
from backend.api.journey import router as journey_router
from backend.api.np_os import router as np_os_router
from backend.api.orchestras import router as orchestras_router
from backend.api.operations import router as operations_router
from backend.config.database import init_db
from backend.config.settings import settings
from backend.core.secrets import build_secrets_manager, set_secrets_manager
from backend.services.sync_engine import SyncEngine
from backend.services.hubspot_sync import HubSpotSyncService
from backend.agents.orchestrator import AgentMesh
import backend.models  # noqa: F401 - ensure all models registered with Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    await init_db()

    # Secrets startup gate (Secrets Management Policy v1.0, section 9):
    # fail fast if required secrets are missing, malformed, or overdue for
    # rotation. In production a failing gate aborts the boot.
    import logging

    secrets_manager = build_secrets_manager()
    set_secrets_manager(secrets_manager)
    app.state.secrets = secrets_manager
    report = secrets_manager.validate_startup(
        block_on_overdue=settings.secrets_block_on_overdue_rotation
    )
    if not report.ok:
        logging.getLogger("nobleport.secrets").error(
            "secrets_startup_gate_failed", extra={"report": report.as_dict()}
        )
        if settings.environment.value == "production":
            raise RuntimeError(
                f"Secrets startup gate failed: {report.as_dict()}. "
                "Resolve missing/invalid/overdue secrets or set an explicit override."
            )

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
        "(permit/compliance), Cyborg.ai (security/governance), AuditBeacon "
        "(immutable operational memory), the RecursiveLearningAgent "
        "(recursive executive operator / self-learning loop), and the "
        "JourneyAgent (Story Engine: operational artifacts → content assets)."
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
app.include_router(proposals_router, prefix="/api/proposals", tags=["Proposal Engine"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(payments_router, prefix="/api/payments", tags=["Payments"])
app.include_router(change_orders_router, prefix="/api/change-orders", tags=["Change Orders (AWO)"])
app.include_router(revenue_router, prefix="/api/revenue", tags=["Revenue Engine"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Mission Control"])
app.include_router(trust_router, prefix="/api/trust", tags=["Proof of Trust"])
app.include_router(ops_brief_router, prefix="/api/ops-brief", tags=["Stephanie Ops Brief"])
app.include_router(governance_router, prefix="/api/governance", tags=["Stephanie Governance"])
app.include_router(learning_router, prefix="/api/learning", tags=["Recursive Learning"])
app.include_router(journey_router, prefix="/api/journey", tags=["Journey Agent (Story Engine)"])
app.include_router(np_os_router, prefix="/api/np-os", tags=["NP-OS Master Operating System"])
app.include_router(orchestras_router, prefix="/api/orchestras", tags=["Stephanie Orchestras"])
app.include_router(operations_router, prefix="/api/operations", tags=["FieldOps Operations"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
