"""NoblePort AI guardrails — backend bindings.

Exposes the guardrail registry to the FastAPI surface (`/api/ai/guardrails`)
and provides an ASGI middleware that:

- Sets the `X-NoblePort-AI-Disclosure` response header (T16) declaring AI
  involvement and pointing to the canonical policy.
- Sets `X-NoblePort-AI-Guardrails-Version` so clients can detect policy
  drift.
- Generates a correlation ID for every request (T26 audit chain) and
  emits a structured log line on response (T30, L64).

The registry is read once at startup. If PyYAML or the manifest is not
available the middleware degrades to disclosure-only mode (S5) rather
than failing the request.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Awaitable, Callable

from fastapi import APIRouter, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

try:
    from gcagent.core.reliability_safety import (
        GuardrailRegistry,
        default_registry,
    )
except Exception:  # pragma: no cover - never block traffic on policy import
    GuardrailRegistry = None  # type: ignore[assignment]
    default_registry = None  # type: ignore[assignment]


logger = logging.getLogger("nobleport.guardrails.api")

DISCLOSURE_HEADER = "X-NoblePort-AI-Disclosure"
VERSION_HEADER = "X-NoblePort-AI-Guardrails-Version"
REQUEST_ID_HEADER = "X-NoblePort-Request-ID"

DISCLOSURE_MESSAGE = (
    "AI-assisted surface. NoblePort AI Guardrails v{version} apply. "
    "Policy: /api/ai/guardrails. Canonical: AI_GUARDRAILS.md."
)


def _safe_registry() -> "GuardrailRegistry | None":
    if default_registry is None:
        return None
    try:
        return default_registry()
    except Exception as exc:  # pragma: no cover - logged, never raised
        logger.warning("guardrails.registry.load_failed error=%s", exc)
        return None


class AIGuardrailsMiddleware(BaseHTTPMiddleware):
    """Disclose AI involvement and emit an auditable trace per request."""

    def __init__(self, app, *, registry: "GuardrailRegistry | None" = None) -> None:
        super().__init__(app)
        self._registry = registry if registry is not None else _safe_registry()

    @property
    def version(self) -> str:
        return self._registry.version if self._registry else "1.0"

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        request.state.nobleport_request_id = request_id
        request.state.nobleport_guardrails_version = self.version
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            logger.exception(
                "guardrails.request.error rid=%s path=%s method=%s elapsed_ms=%.1f",
                request_id,
                request.url.path,
                request.method,
                elapsed_ms,
            )
            raise

        elapsed_ms = (time.perf_counter() - started) * 1000.0
        response.headers[DISCLOSURE_HEADER] = DISCLOSURE_MESSAGE.format(
            version=self.version
        )
        response.headers[VERSION_HEADER] = self.version
        response.headers[REQUEST_ID_HEADER] = request_id

        logger.info(
            "guardrails.request rid=%s method=%s path=%s status=%s elapsed_ms=%.1f",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response


router = APIRouter()


def _registry_or_503() -> "GuardrailRegistry":
    reg = _safe_registry()
    if reg is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "NoblePort AI Guardrails registry is unavailable. "
                "Install PyYAML and verify gcagent/config/ai_guardrails.yaml."
            ),
        )
    return reg


def _serialize(reg: "GuardrailRegistry") -> dict:
    return {
        "version": reg.version,
        "canonical_document": reg.canonical_document,
        "review_cadence_days": reg.review_cadence_days,
        "authority": {
            "policy_owner": reg.policy_owner,
            "technical_owner": reg.technical_owner,
            "ethics_board": reg.ethics_board,
        },
        "applies_to": list(reg.applies_to),
        "categories": [
            {
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "range": list(c.range),
                "count": len(reg.by_category(c.id)),
            }
            for c in reg.categories.values()
        ],
        "guardrails": [
            {
                "id": g.id,
                "category": g.category,
                "severity": g.severity,
                "summary": g.summary,
                "enforcement": list(g.enforcement),
                "binding": g.is_binding,
            }
            for g in reg.guardrails.values()
        ],
        "counts": {
            "total": len(reg),
            "binding": len(reg.binding()),
            "should": sum(1 for g in reg if g.severity == "should"),
        },
    }


@router.get("")
async def get_guardrails():
    """Return the full NoblePort AI Guardrails manifest.

    Honors T16 (disclosure), T23 (regulator transparency), T28 (public
    registry), and A100 (publicly disclosed amendments).
    """
    reg = _registry_or_503()
    return _serialize(reg)


@router.get("/categories")
async def list_categories():
    reg = _registry_or_503()
    return [
        {
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "range": list(c.range),
            "count": len(reg.by_category(c.id)),
        }
        for c in reg.categories.values()
    ]


@router.get("/{guardrail_id}")
async def get_guardrail(guardrail_id: str):
    reg = _registry_or_503()
    gid = guardrail_id.upper()
    if gid not in reg:
        raise HTTPException(status_code=404, detail=f"Unknown guardrail '{gid}'.")
    rail = reg.get(gid)
    return {
        "id": rail.id,
        "category": rail.category,
        "severity": rail.severity,
        "summary": rail.summary,
        "enforcement": list(rail.enforcement),
        "binding": rail.is_binding,
    }
