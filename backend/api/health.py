"""
NoblePort Health Check Endpoint — Matter OS v2.0
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.config.command_freeze import BLOCKED_COMMANDS
from backend.config.module_registry import AGENT_DEFINITIONS, MODULE_DEFINITIONS
from backend.config.operational_truth import OPERATIONAL_TRUTH, get_status_summary
from backend.config.settings import settings
from backend.mcp.audit import audit_beacon
from backend.mcp.gateway import gateway as mcp_gateway
from backend.services.kpi_worker import kpi_worker

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "environment": settings.environment.value,
        "version": "2.0.0",
        "stack": "Matter OS v2.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "integrations": {
            "buildertrend": {
                "configured": settings.buildertrend_api_key is not None
                or settings.buildertrend_username is not None,
                "sync_mode": settings.buildertrend_sync_mode.value,
            },
            "nobleport_etf": {
                "ens_domain": settings.nobleport_ens_domain,
                "chain_id": settings.nobleport_chain_id,
            },
            "solana": {
                "rpc_url": settings.solana_rpc_url,
                "token_mint_configured": settings.solana_token_mint is not None,
            },
            "voice": {
                "elevenlabs_configured": settings.elevenlabs_api_key is not None,
                "livekit_configured": settings.livekit_url is not None,
            },
        },
        "mcp_gateway": {
            "registered_agents": len(mcp_gateway.get_registered_agents()),
            "total_agents_defined": len(AGENT_DEFINITIONS),
            "total_modules": len(MODULE_DEFINITIONS),
            "call_stats": mcp_gateway.get_call_stats(),
            "audit_chain_length": audit_beacon.chain_length,
            "audit_chain_valid": audit_beacon.verify_chain(),
        },
        "kpi_truth": kpi_worker.get_truth_summary(),
        "operational_truth": get_status_summary(),
        "frozen_commands": len(BLOCKED_COMMANDS),
        "jurisdiction": settings.jurisdiction,
    }


@router.get("/health/features")
async def feature_status():
    """Operational truth matrix: deployment status for every feature surface."""
    return {
        "summary": get_status_summary(),
        "features": {
            k: {"status": v["status"].value, "surface": v["surface"]}
            for k, v in OPERATIONAL_TRUTH.items()
        },
    }


@router.get("/health/command-freeze")
async def command_freeze():
    """Lists all blocked autonomous commands and their alternatives."""
    return {
        "total_frozen": len(BLOCKED_COMMANDS),
        "commands": [
            {
                "command": cmd.command,
                "reason": cmd.reason.value,
                "description": cmd.description,
                "alternative": cmd.alternative,
            }
            for cmd in BLOCKED_COMMANDS
        ],
    }
