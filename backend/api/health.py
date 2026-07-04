"""
NoblePort Health Check Endpoint
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.config.command_freeze import BLOCKED_COMMANDS
from backend.config.operational_truth import OPERATIONAL_TRUTH, get_status_summary
from backend.config.settings import settings
from backend.core.secrets import get_secrets_manager

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "environment": settings.environment.value,
        "version": "1.0.0",
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
        },
        "operational_truth": get_status_summary(),
        "frozen_commands": len(BLOCKED_COMMANDS),
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


@router.get("/health/secrets")
async def secrets_health():
    """Secrets management posture per the Secrets Management Policy v1.0.

    Reports the active provider, encrypted-cache stats, rotation-callback
    registrations, and rotation status — without ever exposing secret values.
    """
    return get_secrets_manager().health()


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
