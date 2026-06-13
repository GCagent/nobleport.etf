"""
CYBORG.IO — Rate Limiting Middleware
Protects NVIDIA API quota and prevents runaway requests.
Uses a simple in-process sliding window — upgrade to Redis for multi-instance.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


# ─── Rate limit config per path prefix ───────────────────────────────────────
# Format: (requests, window_seconds)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/nv/stephanie":  (20, 60),   # 20 req/min per IP — Stephanie is expensive
    "/nv/chat":       (30, 60),   # 30 req/min per IP
    "/nv/models":     (10, 60),   # 10 req/min — list models is low-value
    "/nv/":           (60, 60),   # fallback for any /nv/ route
    "/admin/":        (10, 60),   # admin endpoints — tight limit
    "/telemetry/":    (60, 60),   # dashboard polling — generous
}

# Global request log: {ip -> deque of timestamps}
_request_log: dict[str, deque[float]] = defaultdict(lambda: deque())
_ADMIN_IPS_BYPASS: set[str] = {"127.0.0.1", "::1"}  # localhost always bypasses


def _get_limit(path: str) -> tuple[int, int] | None:
    """Return (max_requests, window_seconds) for the best matching prefix."""
    for prefix, limit in RATE_LIMITS.items():
        if path.startswith(prefix):
            return limit
    return None


def _client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For (nginx sets this)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        limit = _get_limit(path)

        if limit is None:
            return await call_next(request)

        ip = _client_ip(request)

        # Localhost always bypasses (dashboard, operator, health checks)
        if ip in _ADMIN_IPS_BYPASS:
            return await call_next(request)

        max_req, window = limit
        now = time.monotonic()
        bucket_key = f"{ip}:{path.split('/')[1]}"  # per-IP per-section
        log = _request_log[bucket_key]

        # Purge old entries outside the window
        while log and log[0] < now - window:
            log.popleft()

        if len(log) >= max_req:
            retry_after = int(window - (now - log[0])) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "detail": f"Too many requests — max {max_req} per {window}s",
                    "retry_after_s": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        log.append(now)
        response = await call_next(request)

        # Inject rate limit headers so the dashboard can show quota status
        response.headers["X-RateLimit-Limit"] = str(max_req)
        response.headers["X-RateLimit-Remaining"] = str(max_req - len(log))
        response.headers["X-RateLimit-Reset"] = str(int(now + window))

        return response
