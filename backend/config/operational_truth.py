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
        "layer": "Executive AI",
        "description": "Homeowner voice intake via LiveKit + ElevenLabs",
        "dependencies": ["livekit", "elevenlabs", "fastapi"],
    },
    "crew_task_routing": {
        "status": DeploymentStatus.LIVE,
        "surface": "GCagent.ai",
        "layer": "Operational Systems",
        "description": "Crew and subcontractor task routing from intake",
        "dependencies": ["langgraph", "redis"],
    },
    "lead_pipeline": {
        "status": DeploymentStatus.LIVE,
        "surface": "Backend",
        "layer": "Backend Logic",
        "description": "Lead capture, CRM sync, and pipeline management",
        "dependencies": ["hubspot", "fastapi", "postgres"],
    },
    "estimate_generation": {
        "status": DeploymentStatus.LIVE,
        "surface": "Backend",
        "layer": "Backend Logic",
        "description": "Estimate creation, sending, and tracking",
        "dependencies": ["fastapi", "postgres"],
    },
    "dashboard_kpis": {
        "status": DeploymentStatus.LIVE,
        "surface": "Frontend",
        "layer": "Frontend Delivery",
        "description": "Mission Control KPI tiles and pipeline funnel",
        "dependencies": ["nextjs", "tailwind", "vercel"],
    },
    "vercel_deployment": {
        "status": DeploymentStatus.LIVE,
        "surface": "Frontend",
        "layer": "Frontend Delivery",
        "description": "Global edge deployment via Vercel with streaming SSR",
        "dependencies": ["vercel", "nextjs"],
    },
    "edge_middleware": {
        "status": DeploymentStatus.LIVE,
        "surface": "Frontend",
        "layer": "Frontend Delivery",
        "description": "Edge middleware for auth checks and request filtering",
        "dependencies": ["vercel", "nextjs"],
    },
    "hubspot_crm": {
        "status": DeploymentStatus.LIVE,
        "surface": "CRM",
        "layer": "Integration",
        "description": "HubSpot CRM for customer relationship management",
        "dependencies": ["hubspot"],
    },

    # ── STAGED ────────────────────────────────────────────────────────
    "gcagent_ops": {
        "status": DeploymentStatus.STAGED,
        "surface": "GCagent.ai",
        "layer": "Operational Systems",
        "description": "Construction operations and contractor coordination",
        "dependencies": ["langgraph", "buildertrend"],
    },
    "permitstream_intel": {
        "status": DeploymentStatus.STAGED,
        "surface": "PermitStream.ai",
        "layer": "Operational Systems",
        "description": "Permit intelligence and compliance attestation",
        "dependencies": ["playwright", "postgres"],
        "geo_constraint": "Massachusetts",
    },
    "permit_scraping": {
        "status": DeploymentStatus.STAGED,
        "surface": "PermitStream.ai",
        "layer": "Operational Systems",
        "description": "Municipality permit status scraping (MA towns)",
        "dependencies": ["playwright", "postgres"],
        "geo_constraint": "Massachusetts",
    },
    "treasury_workflows": {
        "status": DeploymentStatus.STAGED,
        "surface": "Backend",
        "layer": "Treasury",
        "description": "Stripe invoicing, deposit logging, payment tracking",
        "dependencies": ["stripe", "safe_multisig"],
    },
    "hubspot_sync": {
        "status": DeploymentStatus.STAGED,
        "surface": "Backend",
        "layer": "Integration",
        "description": "Bidirectional HubSpot CRM synchronization",
        "dependencies": ["hubspot"],
    },
    "calendar_scheduling": {
        "status": DeploymentStatus.STAGED,
        "surface": "Stephanie.ai",
        "layer": "Executive AI",
        "description": "Google Calendar integration for job scheduling",
        "dependencies": ["google_calendar"],
    },
    "revenue_operator": {
        "status": DeploymentStatus.STAGED,
        "surface": "Stephanie.ai",
        "layer": "Executive AI",
        "description": "Stalled deal detection, deposit reminders, margin alerts",
        "dependencies": ["fastapi", "postgres"],
    },
    "solana_token_2022": {
        "status": DeploymentStatus.STAGED,
        "surface": "Blockchain",
        "layer": "Blockchain Execution",
        "description": "Tokenized membership interests on Solana Token-2022",
        "dependencies": ["solana", "token-2022"],
    },
    "transfer_hook": {
        "status": DeploymentStatus.STAGED,
        "surface": "Blockchain",
        "layer": "Blockchain Execution",
        "description": "Whitelist enforcement via Transfer Hook program",
        "dependencies": ["solana", "token-2022"],
    },
    "safe_multisig": {
        "status": DeploymentStatus.STAGED,
        "surface": "Treasury",
        "layer": "Trust Infrastructure",
        "description": "Multi-signature treasury controls",
        "dependencies": ["safe", "ethereum"],
    },
    "elevenlabs_voice": {
        "status": DeploymentStatus.STAGED,
        "surface": "Voice",
        "layer": "Voice/Avatar",
        "description": "ElevenLabs integration for voice interactions",
        "dependencies": ["elevenlabs"],
    },
    "livekit_avatar": {
        "status": DeploymentStatus.STAGED,
        "surface": "Avatar",
        "layer": "Voice/Avatar",
        "description": "LiveKit streaming for visual avatar interaction",
        "dependencies": ["livekit"],
    },
    "parallel_markets_kyc": {
        "status": DeploymentStatus.STAGED,
        "surface": "Compliance",
        "layer": "Trust Infrastructure",
        "description": "Investor accreditation verification via Parallel Markets",
        "dependencies": ["parallel_markets"],
    },
    "stripe_payments": {
        "status": DeploymentStatus.STAGED,
        "surface": "Payments",
        "layer": "Treasury",
        "description": "Stripe payment processing in test mode",
        "dependencies": ["stripe"],
    },

    # ── MODELED ───────────────────────────────────────────────────────
    "treasurybot_v3": {
        "status": DeploymentStatus.MODELED,
        "surface": "TreasuryBotV3",
        "layer": "Operational Systems",
        "description": "Financial operations and distribution prep",
        "dependencies": [],
    },
    "permit_forecast": {
        "status": DeploymentStatus.MODELED,
        "surface": "PermitStream.ai",
        "layer": "Operational Systems",
        "description": "AHJ-level permit issuance time forecasting",
        "dependencies": [],
    },
    "agent_mesh": {
        "status": DeploymentStatus.MODELED,
        "surface": "Orchestrator",
        "layer": "Executive AI",
        "description": "Multi-agent health monitoring and mesh coordination",
        "dependencies": [],
    },
    "compliance_engine": {
        "status": DeploymentStatus.MODELED,
        "surface": "Cyborg.ai",
        "layer": "Trust Infrastructure",
        "description": "Policy enforcement, kill switches, audit chain",
        "dependencies": [],
    },
    "job_cost_forecasting": {
        "status": DeploymentStatus.MODELED,
        "surface": "GCagent.ai",
        "layer": "Operational Systems",
        "description": "GP floor enforcement and cost variance prediction",
        "dependencies": [],
    },
    "auditbeacon": {
        "status": DeploymentStatus.MODELED,
        "surface": "AuditBeacon",
        "layer": "Trust Infrastructure",
        "description": "Append-only event logging with IPFS + Arweave anchor",
        "dependencies": [],
    },
    "zksbt_engine": {
        "status": DeploymentStatus.MODELED,
        "surface": "Identity",
        "layer": "Trust Infrastructure",
        "description": "zkSBT engine for operational authorization credentials",
        "dependencies": [],
    },

    # ── INTERNAL R&D ──────────────────────────────────────────────────
    "dao_governance": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Nemoclaw",
        "layer": "Trust Infrastructure",
        "description": "Multi-sig approval flows and proposal lifecycle",
        "dependencies": ["ethers"],
    },
    "erc1400_tokenization": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Contracts",
        "layer": "Blockchain Execution",
        "description": "Security token issuance for real estate assets",
        "dependencies": ["solidity"],
    },
    "ssi_identity": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Identity",
        "layer": "Trust Infrastructure",
        "description": "DID/ENS-based self-sovereign identity resolution",
        "dependencies": ["ethers", "did-resolver"],
    },
    "billion_task_systems": {
        "status": DeploymentStatus.INTERNAL_RD,
        "surface": "Research",
        "layer": "Research",
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
