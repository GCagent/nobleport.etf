"""
Kuzo Platform — Prometheus Scrape Endpoint

GET /metrics — unauthenticated endpoint returning Prometheus
exposition-format text for scraping by the Prometheus server.
"""

from fastapi import APIRouter
from starlette.responses import Response

from app.core.metrics import content_type, metrics_snapshot

router = APIRouter(tags=["metrics"])


@router.get(
    "/metrics",
    summary="Prometheus scrape endpoint",
    description="Returns all registered Prometheus metrics in exposition format.",
    response_class=Response,
    include_in_schema=False,
)
async def prometheus_metrics() -> Response:
    """Serve the current metrics snapshot for Prometheus."""
    return Response(
        content=metrics_snapshot(),
        media_type=content_type(),
    )
