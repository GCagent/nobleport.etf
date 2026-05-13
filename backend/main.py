"""
NoblePort Backend - Main Application Entry Point

FastAPI application serving as the Python/Linux backend for NoblePort Networks.
Provides REST APIs for construction project management, Buildertrend integration,
and bridge services to the NoblePort ETF tokenization platform.
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
from backend.config.database import init_db
from backend.config.settings import settings
from backend.services.sync_engine import SyncEngine
from backend.services.hubspot_sync import HubSpotSyncService
from backend.utils.ai_guardrails import (
    AIGuardrailsMiddleware,
    router as ai_guardrails_router,
)
import backend.models  # noqa: F401 - ensure all models registered with Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    await init_db()

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
    title="NoblePort Backend",
    description=(
        "Python/Linux backend for NoblePort Networks. "
        "Provides construction project management APIs, Buildertrend integration bridge, "
        "and data sync services connecting to the NoblePort ETF tokenization platform."
    ),
    version="1.0.0",
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

# NoblePort AI Guardrails — disclosure (T16), version header, and
# correlation ID for the audit chain (T26, T30, L64).
app.add_middleware(AIGuardrailsMiddleware)

# Register API routers
app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(
    ai_guardrails_router, prefix="/api/ai/guardrails", tags=["AI Guardrails"]
)
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
