"""
Mission Control dashboard router.

Serves the same JSON contracts the Next.js console reads against. Every
endpoint here is the swap point for the live data path: today the bodies
return deterministic fixtures so the front-end ships before the gateway is
fully wired; tomorrow each handler is replaced with a join across the
existing revenue / jobs / permits services and the Cyborg.ai policy log.

The TypeScript types live in `src/lib/dashboard/types.ts`. Keep these shapes
in sync.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _minus(minutes: int) -> str:
    return (_now() - timedelta(minutes=minutes)).isoformat()


def _plus(minutes: int) -> str:
    return (_now() + timedelta(minutes=minutes)).isoformat()


# ---------------------------------------------------------------------------
# KPIs / overview
# ---------------------------------------------------------------------------


def _kpis() -> list[dict[str, Any]]:
    return [
        {
            "id": "pipeline",
            "label": "Pipeline Value",
            "value": "$18.4M",
            "raw": 18_412_500,
            "source": "CRM",
            "delta": 0.062,
            "deltaLabel": "vs 30d",
            "trend": "up",
            "health": "healthy",
            "href": "/dashboard/revenue",
        },
        {
            "id": "deposits",
            "label": "Deposits Collected (MTD)",
            "value": "$1.27M",
            "raw": 1_270_400,
            "source": "Stripe / QB",
            "delta": 0.181,
            "deltaLabel": "vs forecast",
            "trend": "up",
            "health": "healthy",
            "href": "/dashboard/revenue",
        },
        {
            "id": "jobs",
            "label": "Active Jobs",
            "value": "37",
            "raw": 37,
            "source": "GCagent",
            "delta": 3,
            "deltaLabel": "WoW",
            "trend": "up",
            "health": "healthy",
            "href": "/dashboard/jobs",
        },
        {
            "id": "permits",
            "label": "Permit Queue",
            "value": "24",
            "raw": 24,
            "source": "PermitStream",
            "delta": -2,
            "deltaLabel": "WoW",
            "trend": "down",
            "health": "degraded",
            "hint": "4 stalled in corrections > 14d",
            "href": "/dashboard/permits",
        },
        {
            "id": "gp",
            "label": "Gross Margin (Q2 forecast)",
            "value": "21.4%",
            "raw": 0.214,
            "source": "ERPNext",
            "delta": -0.012,
            "deltaLabel": "vs target",
            "trend": "down",
            "health": "degraded",
            "hint": "2 jobs under GP floor",
            "href": "/dashboard/jobs",
        },
        {
            "id": "agents",
            "label": "AI Agent Health",
            "value": "108 / 112",
            "raw": 108,
            "source": "Orchestrator",
            "delta": -1,
            "deltaLabel": "1h",
            "trend": "down",
            "health": "degraded",
            "hint": "2 degraded · 2 unhealthy",
            "href": "/dashboard/agents",
        },
        {
            "id": "voice",
            "label": "Voice Latency (p95)",
            "value": "312ms",
            "raw": 312,
            "source": "Stephanie.ai / LiveKit",
            "delta": 18,
            "deltaLabel": "15m",
            "trend": "up",
            "health": "healthy",
            "href": "/dashboard/voice",
        },
        {
            "id": "compliance",
            "label": "Compliance Alerts",
            "value": "3",
            "raw": 3,
            "source": "Cyborg.ai",
            "delta": 1,
            "deltaLabel": "24h",
            "trend": "up",
            "health": "degraded",
            "hint": "1 critical · 2 warnings",
            "href": "/dashboard/compliance",
        },
    ]


def _pipeline() -> list[dict[str, Any]]:
    return [
        {"id": "lead", "name": "Lead", "count": 41, "value": 8_140_000, "staleCount": 6},
        {"id": "proposal", "name": "Proposal", "count": 22, "value": 5_870_000, "staleCount": 4},
        {"id": "deposit", "name": "Deposit Pending", "count": 9, "value": 2_310_000, "staleCount": 3},
        {"id": "scheduled", "name": "Scheduled", "count": 14, "value": 4_220_000, "staleCount": 1},
        {"id": "production", "name": "In Production", "count": 23, "value": 11_240_000, "staleCount": 0},
        {"id": "invoice", "name": "Invoicing", "count": 12, "value": 3_980_000, "staleCount": 2},
        {"id": "cash", "name": "Cash Collected", "count": 18, "value": 5_460_000, "staleCount": 0},
    ]


def _cash() -> dict[str, Any]:
    return {
        "asOf": _now().isoformat(),
        "operating": 1_842_300,
        "reserve": 750_000,
        "escrow": 412_500,
        "pendingDeposits": 318_000,
        "pendingPayables": 624_900,
        "runwayDays": 184,
    }


def _agent_summary() -> dict[str, Any]:
    return {
        "total": 112,
        "healthy": 108,
        "degraded": 2,
        "unhealthy": 2,
        "totalQueue": 57,
        "totalInFlight": 8,
        "topLatencyMs": 4810,
    }


def _alerts() -> list[dict[str, Any]]:
    return [
        {
            "id": "c-501",
            "ts": _minus(48),
            "severity": "critical",
            "category": "erc1400",
            "subject": "Restricted transfer attempt",
            "detail": "ERC-1400 restriction blocked transfer of NP-RE-204",
            "agent": "Cyborg.ai",
            "resolved": False,
        },
        {
            "id": "c-503",
            "ts": _minus(640),
            "severity": "warn",
            "category": "policy",
            "subject": "GP floor breach forecast",
            "detail": "Job NP-211 forecast GP 14.6% below 18% floor",
            "agent": "GCagent.ai",
            "resolved": False,
        },
        {
            "id": "c-505",
            "ts": _minus(1300),
            "severity": "critical",
            "category": "kill-switch",
            "subject": "Kill-switch armed: tx-broadcast",
            "detail": "Operator armed kill-switch on tx-broadcast scope",
            "agent": "Operator · m.velasquez",
            "resolved": False,
        },
    ]


@router.get("/overview")
async def get_overview() -> dict[str, Any]:
    return {
        "generatedAt": _now().isoformat(),
        "kpis": _kpis(),
        "alerts": _alerts(),
        "agentSummary": _agent_summary(),
        "cash": _cash(),
        "pipeline": _pipeline(),
        "upcomingMilestones": [
            {"jobCode": "NP-211", "milestone": "Permit re-submit", "at": _plus(60 * 6)},
            {"jobCode": "NP-220", "milestone": "Site mobilization complete", "at": _plus(60 * 18)},
            {"jobCode": "NP-204", "milestone": "Rough-in inspection", "at": _plus(60 * 28)},
            {"jobCode": "NP-198", "milestone": "Steel topping-out", "at": _plus(60 * 96)},
            {"jobCode": "NP-225", "milestone": "Foundation permit issuance", "at": _plus(60 * 220)},
        ],
    }


# ---------------------------------------------------------------------------
# Sub-resources
# ---------------------------------------------------------------------------


@router.get("/revenue/pipeline")
async def get_pipeline() -> dict[str, Any]:
    return {"pipeline": _pipeline()}


@router.get("/revenue/cash")
async def get_cash() -> dict[str, Any]:
    return {"cash": _cash()}


@router.get("/agents/summary")
async def get_agents_summary() -> dict[str, Any]:
    return {"summary": _agent_summary()}


@router.get("/compliance/alerts")
async def get_alerts(
    severity: str | None = Query(default=None, pattern="^(info|warn|critical)$"),
) -> dict[str, Any]:
    items = _alerts()
    if severity:
        items = [a for a in items if a["severity"] == severity]
    return {"alerts": items}


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "service": "dashboard.nobleport.ai", "ts": _now().isoformat()}
