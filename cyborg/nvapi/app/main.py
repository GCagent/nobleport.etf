"""
CYBORG.IO — NVAPI Gateway
FastAPI backend powering the NVAPI Sandbox Control dashboard.
Production-hardened: startup validation, deep health checks, rate limiting.
"""
from __future__ import annotations

import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from .config import Settings
from .middleware import RateLimitMiddleware
from .quantum import get_threat_by_id, get_threat_matrix, get_threat_summary
from .startup import run_startup_validation
from .streaming import AVAILABLE_MODELS, REASONING_MODELS, stream_nim_response
from .telemetry import Telemetry
from .vault import VaultClient

# ─── Singletons ───────────────────────────────────────────────────────────────
settings = Settings()
telemetry = Telemetry()
vault = VaultClient(settings)


# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Validate environment BEFORE accepting traffic — exits if broken
    run_startup_validation(settings)
    # 2. Pull NVAPI key from Vault (falls back to env if Vault unavailable)
    await vault.load_key()
    yield


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CYBORG.IO NVAPI Gateway",
    version="1.1.0",
    docs_url="/docs" if settings.env != "production" else None,  # hide Swagger in prod
    redoc_url=None,
    lifespan=lifespan,
)

# CORS — tighten allow_origins for production (set via CORS_ORIGINS in .env)
_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# Rate limiting
app.add_middleware(RateLimitMiddleware)


# ─── Kill switch ──────────────────────────────────────────────────────────────
class KillSwitch:
    active: bool = False
    reason: str = ""
    toggled_at: str | None = None


kill_switch = KillSwitch()


# ─── Request models ───────────────────────────────────────────────────────────
class KillSwitchRequest(BaseModel):
    active: bool
    reason: str = ""


class ChatRequest(BaseModel):
    prompt: str
    model: str = "meta/llama-3.1-70b-instruct"
    system: str | None = None
    temperature: float = 0.7
    max_tokens: int = 1024


class StreamRequest(BaseModel):
    prompt: str
    model: str = "nvidia/nemotron-3-nano-30b-a3b"
    system: str | None = None
    temperature: float = 1.0
    top_p: float = 1.0
    max_tokens: int = 16384
    reasoning_budget: int = 16384


# ─── Helpers ──────────────────────────────────────────────────────────────────
def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def assert_not_killed():
    if kill_switch.active:
        raise HTTPException(
            status_code=503,
            detail=f"Kill switch active: {kill_switch.reason or 'operator halt'}",
        )


async def _probe_nvidia(key: str, timeout: float = 6.0) -> dict[str, Any]:
    """Live probe to NVIDIA API — used in deep health check."""
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(
                "https://integrate.api.nvidia.com/v1/models",
                headers={"Authorization": f"Bearer {key}"},
            )
        lat = round((time.perf_counter() - t0) * 1000)
        if r.status_code == 200:
            return {"status": "green", "latency_ms": lat}
        elif r.status_code == 401:
            return {"status": "red", "reason": "invalid_key", "latency_ms": lat}
        else:
            return {"status": "yellow", "reason": f"http_{r.status_code}", "latency_ms": lat}
    except httpx.TimeoutException:
        return {"status": "yellow", "reason": "timeout", "latency_ms": round((time.perf_counter() - t0) * 1000)}
    except Exception as e:
        return {"status": "red", "reason": str(e), "latency_ms": round((time.perf_counter() - t0) * 1000)}


async def _probe_vault() -> dict[str, Any]:
    """Live probe to HashiCorp Vault seal status."""
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            r = await client.get(f"{settings.vault_addr}/v1/sys/health")
        lat = round((time.perf_counter() - t0) * 1000)
        body = r.json()
        sealed = body.get("sealed", True)
        initialized = body.get("initialized", False)
        if r.status_code in (200, 429) and initialized and not sealed:
            return {"status": "green", "sealed": False, "latency_ms": lat}
        elif sealed:
            return {"status": "red", "reason": "sealed", "sealed": True, "latency_ms": lat}
        else:
            return {"status": "yellow", "reason": f"http_{r.status_code}", "latency_ms": lat}
    except Exception as e:
        return {"status": "red", "reason": str(e), "latency_ms": round((time.perf_counter() - t0) * 1000)}


# ─── HEALTH (deep) ────────────────────────────────────────────────────────────
@app.get("/health")
async def health(deep: bool = False):
    """
    Basic: returns gateway state instantly.
    Deep (?deep=true): probes Vault + NVIDIA live — use for readiness checks.
    """
    base = {
        "status": "ok",
        "version": "1.1.0",
        "env": settings.env,
        "key_configured": bool(vault.current_key),
        "key_source": vault.key_source(),
        "kill_switch": kill_switch.active,
        "uptime_s": telemetry.uptime_seconds(),
        "started_at": telemetry.started_at,
    }

    if not deep:
        return base

    # Deep mode — actually probe dependencies
    vault_probe = await _probe_vault()
    nv_probe = (
        await _probe_nvidia(vault.current_key)
        if vault.current_key
        else {"status": "red", "reason": "no_key"}
    )

    services = {
        "vault": vault_probe,
        "nvidia_api": nv_probe,
    }

    # Compute overall status: red if any red, yellow if any yellow
    statuses = [s["status"] for s in services.values()]
    if "red" in statuses:
        overall = "degraded"
    elif "yellow" in statuses:
        overall = "partial"
    else:
        overall = "ok"

    return {**base, "status": overall, "services": services}


# ─── READINESS (Docker / K8s probe) ───────────────────────────────────────────
@app.get("/ready")
async def readiness():
    """
    Lightweight readiness check — returns 200 only when the gateway is
    ready to serve traffic (key loaded, kill switch off).
    Returns 503 during startup or if kill switch is active.
    """
    if not vault.current_key:
        raise HTTPException(status_code=503, detail="NVAPI key not loaded yet")
    if kill_switch.active:
        raise HTTPException(status_code=503, detail="Kill switch active")
    return {"ready": True}


# ─── NVIDIA HEALTH ────────────────────────────────────────────────────────────
@app.get("/nv/health")
async def nv_health():
    if not vault.current_key:
        return JSONResponse(
            status_code=200,
            content={"nv_reachable": False, "reason": "NVAPI key not configured"},
        )
    result = await _probe_nvidia(vault.current_key)
    return {
        "nv_reachable": result["status"] == "green",
        "status": result["status"],
        "latency_ms": result.get("latency_ms"),
        "reason": result.get("reason"),
    }


# ─── NIM MODELS ───────────────────────────────────────────────────────────────
@app.get("/nv/models")
async def nv_models():
    assert_not_killed()
    if not vault.current_key:
        raise HTTPException(status_code=401, detail="NVAPI key not configured")
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(
                "https://integrate.api.nvidia.com/v1/models",
                headers={"Authorization": f"Bearer {vault.current_key}"},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Upstream NVIDIA error")
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── CHAT HELPERS ─────────────────────────────────────────────────────────────
async def _nim_call(
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    endpoint_label: str,
) -> dict[str, Any]:
    """Shared NIM inference call with telemetry recording."""
    t0 = time.perf_counter()
    call_id = str(uuid.uuid4())[:8]
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {vault.current_key}",
                    "Content-Type": "application/json",
                },
                json={"model": model, "messages": messages,
                      "temperature": temperature, "max_tokens": max_tokens},
            )
        latency = round((time.perf_counter() - t0) * 1000)
        if r.status_code != 200:
            err = r.json() if "application/json" in r.headers.get("content-type", "") else {"raw": r.text[:500]}
            telemetry.record_call(model, 0, latency, success=False, endpoint=endpoint_label)
            raise HTTPException(status_code=r.status_code, detail=err)
        data = r.json()
        reply = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens", 0)
        telemetry.record_call(model, tokens, latency, success=True, endpoint=endpoint_label)
        return {"reply": reply, "model": model, "tokens_used": tokens, "latency_ms": latency, "call_id": call_id}
    except HTTPException:
        raise
    except Exception as e:
        latency = round((time.perf_counter() - t0) * 1000)
        telemetry.record_call(model, 0, latency, success=False, endpoint=endpoint_label)
        raise HTTPException(status_code=502, detail=str(e))


# ─── RAW CHAT ─────────────────────────────────────────────────────────────────
@app.post("/nv/chat")
async def nv_chat(req: ChatRequest):
    assert_not_killed()
    if not vault.current_key:
        raise HTTPException(status_code=401, detail="NVAPI key not configured")
    messages = ([{"role": "system", "content": req.system}] if req.system else []) + \
               [{"role": "user", "content": req.prompt}]
    return await _nim_call(req.model, messages, req.temperature, req.max_tokens, "/nv/chat")


# ─── STEPHANIE.AI ─────────────────────────────────────────────────────────────
STEPHANIE_SYSTEM = (
    "You are Stephanie, an elite AI intelligence system built for NoblePort Systems — "
    "the CYBORG.IO platform. You specialize in blockchain, DeFi, real estate, construction "
    "technology, and Web3 infrastructure. You are precise, analytical, and proactive. "
    "You assist operators, developers, and executives of the NoblePort ecosystem with "
    "strategic insights, technical analysis, and actionable intelligence. "
    "Always sign off with situational awareness."
)


@app.post("/nv/stephanie")
async def nv_stephanie(req: ChatRequest):
    assert_not_killed()
    if not vault.current_key:
        raise HTTPException(status_code=401, detail="NVAPI key not configured")
    messages = [
        {"role": "system", "content": req.system or STEPHANIE_SYSTEM},
        {"role": "user", "content": req.prompt},
    ]
    result = await _nim_call(req.model, messages, req.temperature, req.max_tokens, "/nv/stephanie")
    return {**result, "agent": "stephanie.ai"}


# ─── TELEMETRY ────────────────────────────────────────────────────────────────
@app.get("/telemetry/stats")
async def telemetry_stats():
    return telemetry.stats(
        env=settings.env,
        key_configured=bool(vault.current_key),
        key_source=vault.key_source(),
        kill_switch=kill_switch.active,
    )


@app.get("/telemetry/log")
async def telemetry_log(limit: int = 80):
    return {"entries": telemetry.get_log(limit), "total": len(telemetry.call_log)}


@app.delete("/telemetry/reset")
async def telemetry_reset():
    telemetry.reset()
    return {"status": "ok", "message": "Telemetry counters reset", "reset_at": utcnow()}


# ─── QUANTUM THREAT INTELLIGENCE ──────────────────────────────────────────────
@app.get("/quantum/threat-level")
async def quantum_threat_level():
    return get_threat_summary()


@app.get("/quantum/matrix")
async def quantum_matrix():
    return {"threats": get_threat_matrix(), "count": 10}


@app.get("/quantum/threat/{threat_id}")
async def quantum_threat_detail(threat_id: int):
    threat = get_threat_by_id(threat_id)
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat ID {threat_id} not found")
    return threat


# ─── KILL SWITCH ──────────────────────────────────────────────────────────────
@app.post("/admin/kill-switch")
async def admin_kill_switch(req: KillSwitchRequest):
    kill_switch.active = req.active
    kill_switch.reason = req.reason
    kill_switch.toggled_at = utcnow()
    return {
        "status": "ok",
        "kill_switch": kill_switch.active,
        "reason": kill_switch.reason,
        "toggled_at": kill_switch.toggled_at,
        "message": "ACTIVE — all NVAPI calls halted" if req.active else "CLEARED — calls allowed",
    }


# ─── STREAMING INFERENCE ──────────────────────────────────────────────
@app.post("/nv/stream")
async def nv_stream(req: StreamRequest):
    """
    Server-Sent Events streaming endpoint.
    Supports reasoning_budget for Nemotron thinking models.
    Returns: text/event-stream with JSON chunks:
      {"type": "reasoning", "text": "..."}
      {"type": "content",   "text": "..."}
      {"type": "done",      "text": ""}
      {"type": "error",     "text": "..."}
    """
    assert_not_killed()
    if not vault.current_key:
        raise HTTPException(status_code=401, detail="NVAPI key not configured")

    messages = [
        {"role": "user", "content": req.prompt}
    ]

    async def event_generator():
        async for chunk in stream_nim_response(
            api_key=vault.current_key,
            model=req.model,
            messages=messages,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
            reasoning_budget=req.reasoning_budget,
            system_prompt=req.system,
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disables nginx buffering
        },
    )


@app.post("/nv/stephanie/stream")
async def nv_stephanie_stream(req: StreamRequest):
    """Stephanie.ai streaming — injects NoblePort system prompt."""
    assert_not_killed()
    if not vault.current_key:
        raise HTTPException(status_code=401, detail="NVAPI key not configured")

    messages = [{"role": "user", "content": req.prompt}]
    system = req.system or STEPHANIE_SYSTEM

    async def event_generator():
        async for chunk in stream_nim_response(
            api_key=vault.current_key,
            model=req.model,
            messages=messages,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
            reasoning_budget=req.reasoning_budget,
            system_prompt=system,
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/nv/models/catalog")
async def nv_models_catalog():
    """Returns available models with reasoning capability flags."""
    assert_not_killed()
    if not vault.current_key:
        raise HTTPException(status_code=401, detail="NVAPI key not configured")
    return {"models": AVAILABLE_MODELS, "reasoning_models": list(REASONING_MODELS)}


# ─── KEY ROTATION ─────────────────────────────────────────────────────────────
@app.post("/admin/rotate-key")
async def admin_rotate_key():
    t0 = time.perf_counter()
    success, new_source, message = await vault.rotate_key()
    latency = round((time.perf_counter() - t0) * 1000)
    if not success:
        raise HTTPException(status_code=500, detail=message)
    return {"status": "ok", "key_source": new_source, "message": message,
            "latency_ms": latency, "rotated_at": utcnow()}
