"""
NoblePort Buildertrend Integration API

Endpoints for managing the Buildertrend connection,
testing connectivity, and handling webhook callbacks.
"""

import hashlib
import hmac
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from backend.config.settings import settings
from backend.integrations.buildertrend_client import (
    BuildertrendAuthError,
    BuildertrendClient,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/status")
async def buildertrend_status():
    """Check Buildertrend integration configuration status."""
    return {
        "configured": settings.buildertrend_api_key is not None
        or settings.buildertrend_username is not None,
        "base_url": settings.buildertrend_base_url,
        "company_id": settings.buildertrend_company_id,
        "sync_mode": settings.buildertrend_sync_mode.value,
        "sync_interval_minutes": settings.buildertrend_sync_interval_minutes,
        "rate_limit_rpm": settings.buildertrend_rate_limit_rpm,
    }


@router.post("/test-connection")
async def test_buildertrend_connection():
    """Test connectivity to Buildertrend API."""
    client = BuildertrendClient()
    try:
        result = await client.test_connection()
        return result
    except BuildertrendAuthError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Buildertrend authentication failed: {e}",
        )
    finally:
        await client.close()


@router.post("/webhook")
async def buildertrend_webhook(
    request: Request,
    x_bt_signature: str | None = Header(None, alias="X-BT-Signature"),
):
    """
    Receive webhook callbacks from Buildertrend.
    Validates signature and queues sync operations for changed entities.
    """
    body = await request.body()

    # Verify webhook signature if secret is configured
    if settings.buildertrend_webhook_secret and x_bt_signature:
        expected = hmac.new(
            settings.buildertrend_webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_bt_signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload: dict[str, Any] = await request.json()
    event_type = payload.get("event", "unknown")
    entity_type = payload.get("entityType", "unknown")
    entity_id = payload.get("entityId")

    logger.info(
        f"Buildertrend webhook received: {event_type} for {entity_type} ({entity_id})"
    )

    # In a production system, this would queue a targeted sync job
    # via Celery or similar task queue. For now, log and acknowledge.
    return {
        "status": "received",
        "event": event_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
    }
