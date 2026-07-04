"""
NoblePort Revenue API

Pipeline analytics, HubSpot webhook ingestion, and
Stephanie.ai revenue health endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import get_db
from backend.services.hubspot_sync import HubSpotSyncService
from backend.services.revenue_engine import RevenueEngine
from backend.services.stephanie_revenue import StephanieRevenueOperator

router = APIRouter()
revenue_engine = RevenueEngine()
hubspot_sync = HubSpotSyncService()
stephanie = StephanieRevenueOperator()


# =========================================================================
# PIPELINE ANALYTICS
# =========================================================================


@router.get("/pipeline")
async def get_pipeline_snapshot(db: AsyncSession = Depends(get_db)):
    """
    Real-time pipeline snapshot. Shows estimates, jobs, payments,
    and change order totals across the entire revenue engine.
    """
    return await revenue_engine.get_pipeline_snapshot(db)


# =========================================================================
# STEPHANIE.AI REVENUE OPERATOR
# =========================================================================


@router.get("/health")
async def get_revenue_health():
    """
    Full revenue health report from Stephanie.ai.
    Includes stalled deals, deposit reminders, margin alerts,
    high-probability closes, and AWO suggestions.
    """
    return await stephanie.generate_revenue_health_report()


@router.get("/alerts/stalled-deals")
async def get_stalled_deals(days: int = 7):
    """Get estimates that have gone stale without response."""
    return await stephanie.detect_stalled_deals(stale_days=days)


@router.get("/alerts/deposit-reminders")
async def get_deposit_reminders():
    """Get jobs waiting on deposit payments."""
    return await stephanie.get_pending_deposit_reminders()


@router.get("/alerts/margin-compression")
async def get_margin_alerts(threshold: float = 15.0):
    """Get jobs with margin below threshold."""
    return await stephanie.detect_margin_compression(threshold_percent=threshold)


@router.get("/alerts/high-probability")
async def get_high_probability_closes(min_prob: float = 0.7):
    """Get estimates with high win probability."""
    return await stephanie.get_high_probability_closes(min_probability=min_prob)


@router.get("/alerts/awo-suggestions")
async def get_awo_suggestions():
    """Get AI-suggested change order opportunities."""
    return await stephanie.suggest_change_orders()


# =========================================================================
# HUBSPOT WEBHOOK INGESTION
# =========================================================================


@router.post("/webhook/hubspot")
async def hubspot_webhook(request: Request):
    """
    HubSpot webhook endpoint.
    Receives deal/contact events and syncs to Postgres.
    """
    try:
        import json
        payload = await request.body()
        events = json.loads(payload)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid payload")

    # HubSpot sends arrays of events
    if isinstance(events, list):
        results = []
        for event in events:
            event_type = event.get("subscriptionType", "")
            result = await hubspot_sync.handle_hubspot_webhook(event_type, event)
            results.append(result)
        return {"processed": len(results), "results": results}

    # Single event
    event_type = events.get("subscriptionType", "")
    result = await hubspot_sync.handle_hubspot_webhook(event_type, events)
    return result


@router.post("/sync/hubspot")
async def trigger_hubspot_sync():
    """Manually trigger a full HubSpot sync."""
    return await hubspot_sync.run_full_sync()
