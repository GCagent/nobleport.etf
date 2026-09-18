"""
Kuzo Platform — Prometheus HTTP Middleware
Starlette BaseHTTPMiddleware that instruments every request with:
  - kuzo_http_requests_total      (Counter)
  - kuzo_http_request_duration_seconds (Histogram)
  - kuzo_http_requests_in_flight  (Gauge)

Path normalisation collapses UUIDs, slugs, and Ethereum addresses
to keep label cardinality bounded.
"""

import re
import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.metrics import (
    HTTP_IN_FLIGHT,
    HTTP_REQUEST_DURATION,
    HTTP_REQUESTS_TOTAL,
)

# ---------------------------------------------------------------------------
# Path-normalisation patterns
# ---------------------------------------------------------------------------
_UUID_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
_HEX_ID_RE = re.compile(r"[0-9a-fA-F]{24,}")
_ETH_ADDR_RE = re.compile(r"0x[0-9a-fA-F]{40}")
_NUMERIC_RE = re.compile(r"/\d+")
_SLUG_RE = re.compile(r"/[a-z0-9]+-[a-z0-9-]+")


def _normalise_path(path: str) -> str:
    """Collapse dynamic path segments to placeholders.

    Examples:
        /api/dapps/550e8400-e29b-41d4-a716-446655440000  -> /api/dapps/:id
        /api/users/0xAbC123...                             -> /api/users/:address
        /api/deployments/12345                             -> /api/deployments/:id
    """
    path = _UUID_RE.sub(":id", path)
    path = _ETH_ADDR_RE.sub(":address", path)
    path = _HEX_ID_RE.sub(":id", path)
    path = _NUMERIC_RE.sub("/:id", path)
    # Only collapse obvious slugs in the last segment
    segments = path.rsplit("/", 1)
    if len(segments) == 2 and _SLUG_RE.fullmatch("/" + segments[1]):
        path = segments[0] + "/:slug"
    return path


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Instrument every HTTP request for Prometheus."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        method = request.method
        path = _normalise_path(request.url.path)

        HTTP_IN_FLIGHT.inc()
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            # Record 500 on unhandled exceptions and re-raise
            duration = time.perf_counter() - start
            HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status_code="500").inc()
            HTTP_REQUEST_DURATION.labels(method=method, path=path).observe(duration)
            raise
        finally:
            HTTP_IN_FLIGHT.dec()

        duration = time.perf_counter() - start
        status_code = str(response.status_code)

        HTTP_REQUESTS_TOTAL.labels(
            method=method, path=path, status_code=status_code
        ).inc()
        HTTP_REQUEST_DURATION.labels(method=method, path=path).observe(duration)

        return response
