"""
Kuzo Platform — FastAPI Application Entry Point

Sets up:
  - PrometheusMiddleware (before CORS so every request is instrumented)
  - CORS middleware
  - Metrics router (GET /metrics)
  - BUILD_INFO on startup
  - Lifespan context manager for startup / shutdown hooks
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.metrics_route import router as metrics_router
from app.core.metrics import BUILD_INFO
from app.core.metrics_middleware import PrometheusMiddleware

logger = logging.getLogger("kuzo.main")

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
SERVICE_NAME = os.getenv("KUZO_SERVICE_NAME", "kuzo-api")
SERVICE_VERSION = os.getenv("KUZO_VERSION", "0.1.0")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")


# ---------------------------------------------------------------------------
# Lifespan — startup & shutdown hooks
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # -- Startup --------------------------------------------------------------
    logger.info("Starting %s v%s", SERVICE_NAME, SERVICE_VERSION)

    BUILD_INFO.info({
        "version": SERVICE_VERSION,
        "service": SERVICE_NAME,
    })

    yield

    # -- Shutdown -------------------------------------------------------------
    logger.info("Shutting down %s", SERVICE_NAME)


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Kuzo Platform API",
    version=SERVICE_VERSION,
    description="Blockchain dApp deployment platform with SIWE auth, Stripe billing, "
                "IPFS pinning, Arbitrum anchoring, and Prometheus observability.",
    lifespan=lifespan,
    debug=DEBUG,
)

# ---------------------------------------------------------------------------
# Middleware — order matters: Prometheus wraps everything including CORS
# ---------------------------------------------------------------------------
app.add_middleware(PrometheusMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(metrics_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health() -> dict:
    """Simple liveness probe."""
    return {"status": "ok", "service": SERVICE_NAME, "version": SERVICE_VERSION}


# ---------------------------------------------------------------------------
# Run with uvicorn
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=DEBUG,
        log_level="debug" if DEBUG else "info",
    )
