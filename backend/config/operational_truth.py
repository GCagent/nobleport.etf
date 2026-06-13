"""
Operational Truth Matrix

Enforces LIVE / STAGED / MODELED / INTERNAL_R&D classification for every
feature surface. Prevents simulated infrastructure from being interpreted
as live production capability. This matrix is the single source of truth
for dashboards, investor decks, API docs, sales demos, internal telemetry,
and website badges.
"""

from __future__ import annotations

from enum import Enum
from typing import Any


class DeploymentStatus(str, Enum):
    LIVE = "LIVE"
    STAGED = "STAGED"
    MODELED = "MODELED"
    INTERNAL_RD = "INTERNAL_R&D"


OPERATIONAL_TRUTH: dict[str, dict[str, Any]] = {
    # ── LIVE ──────────────────────────────────────────────────────────
    "voice_intake": {
        "status": DeploymentStatus.LIVE,
        "surface": "Stephanie.ai",
        "description": "Homeowner voice intake via LiveKit + ElevenLabs",
        "dependencies": ["livekit", "elevenlabs", "fastapi"],
    },
    "crew_task_routing": {
        "status": DeploymentStatus.LIVE,
        "surface": "GCagent.ai",
        "description": "Crew and subcontractor task routing from intake",
        "dependencies": ["langgraph", "redis"],
    },
    "lead_pipeline": {
        "status": DeploymentStatus.LIVE,
        "surface": "Backend",
        "description": "Lead capture, CRM sync, and pipeline management",
        "dependencies": ["hubspot", "fastapi", "postgres"],
    },
    "estimate_generation": {
        "status": DeploymentStatus.LIVE,
        "surface": "Backend",
        "description": "Estimate creation, sending, and tracking",
        "dependencies": ["fastapi", "postgres"],
    },
    "dashboard_kpis": {
        "status": DeploymentStatus.LIVE,
        "surface": "Frontend",
        "description": "Mission Control KPI tiles and pipeline funnel",
        "dependencies": ["nextjs", "tailwind"],
    },

    # ── STAGED ────────────────────────────────────────────────────────
    "permit_scraping": {
        "status": DeploymentStatus.STAGED,
        "surface": "PermitStream.ai",
        "description": "Municipality permit status scraping (MA towns)",
        "dependencies": ["playwright", "postgres"],
        "geo_constraint": "Massachusetts",
    },
    "treasury_workflows": {
        "status": DeploymentStatus.STAGED,
        "surface": "Backend",
        "description": "Stripe invoicing, deposit logging, payment tracking",
        "dependencies": ["stripe", "quickbooks"],
    },
    "hubspot_sync": {
        "status": DeploymentStatus.STAGED,
        "surface": "Backend",
        "description": "Bidirectional HubSpot CRM synchronization",
        "dependencies": ["hubspot"],
    },
    "calendar_scheduling": {
        "status": DeploymentStatus.STAGED,
        "surface": "Stephanie.ai",
        "description": "Google Calendar integration for job scheduling",
        "dependencies": ["google_calendar"],
    },
    "revenue_operator": {
        "status": DeploymentStatus.STAGED,
        "surface": "Stephanie.ai",
        "description": "Stalled deal detection, deposit reminders, margin alerts",
        "dependencies": ["fastapi", "postgres"],
    },
    "nvapi_gateway": {
        "status": DeploymentStatus.STAGED,
        "surface": "Cyborg.ai",
        "description": "NVIDIA NIM inference gateway: Vault key custody, "
                       "kill switch, telemetry, Stephanie endpoints (cyborg/nvapi)",
        "dependencies": ["fastapi", "vault", "nvidia-nim", "docker"],
    },
    "asr_streaming_proxy": {
        "status": DeploymentStatus.STAGED,
        "surface": "Cyborg.ai",
        "description": "Riva/Nemotron ASR HTTP+WebSocket transcription proxy (cyborg/asr)",
        "dependencies": ["riva", "fastapi", "ffmpeg", "docker"],
    },

    # ── MODELED ───────────────────────────────────────────────────────
    "permit_forecast": {
        "status": DeploymentStatus.MODELED,
        "surface": "PermitStream.ai",
        "description": "AHJ-level permit issuance time forecasting",
        "dependencies": [],
    },
    "agent_mesh": {
        "status": DeploymentStatus.MODELED,
        "surface": "Orchestrator",
        "description": "Multi-agent health monitoring and mesh coordination",
        "dependencies": [],
    },
    "compliance_engine": {
        "status": DeploymentStatus.MODELED,
        "surface": "Cyborg.ai",
        "description": "Policy enforcement, kill switches, audit chain",
        "dependencies": [],
    },
    "job_cost_forecasting": {
        "status": DeploymentStatus.MODELED,
        "surface": "GCagent.ai",
        "description": "GP floor enforcement and cost variance prediction",
        "dependencies": [],
    },
    "quantum_threat_matrix": {
        "status": DeploymentStatus.MODELED,
        "surface": "Cyborg.ai",
        "description": "Static 10-vector quantum threat assessment dataset "
                       "(2025 NIST/IETF research) served by cyborg/nvapi — not a live scanner",
        "dependencies": [],
    },

    # ── INTERNAL R&D ──────────────────────────────────────────────────
    "dao_governance": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Nemoclaw",
        "description": "Multi-sig approval flows and proposal lifecycle",
        "dependencies": ["ethers"],
    },
    "erc1400_tokenization": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Contracts",
        "description": "Security token issuance for real estate assets",
        "dependencies": ["solidity"],
    },
    "ssi_identity": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Identity",
        "description": "DID/ENS-based self-sovereign identity resolution",
        "dependencies": ["ethers", "did-resolver"],
    },
    "billion_task_systems": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Research",
        "description": "Large-scale task orchestration simulation",
        "dependencies": [],
    },
}


def get_live_features() -> list[str]:
    return [k for k, v in OPERATIONAL_TRUTH.items()
            if v["status"] == DeploymentStatus.LIVE]


def get_feature_status(feature: str) -> DeploymentStatus | None:
    entry = OPERATIONAL_TRUTH.get(feature)
    return entry["status"] if entry else None


def is_production_ready(feature: str) -> bool:
    return get_feature_status(feature) == DeploymentStatus.LIVE


def get_status_summary() -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in OPERATIONAL_TRUTH.values():
        key = entry["status"].value
        counts[key] = counts.get(key, 0) + 1
    return counts
