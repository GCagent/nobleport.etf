"""
NoblePort Sync API

Endpoints for managing data synchronization between
NoblePort and Buildertrend.
"""

from fastapi import APIRouter, HTTPException, Request

from backend.api.schemas import SyncRequest, SyncStatusResponse
from backend.integrations.buildertrend_client import BuildertrendEntity
from backend.services.sync_engine import SyncDirection

router = APIRouter()


@router.get("/status", response_model=SyncStatusResponse)
async def sync_status(request: Request):
    """Get current sync engine status."""
    sync_engine = request.app.state.sync_engine
    status = sync_engine.get_status()
    return SyncStatusResponse(**status)


@router.get("/history")
async def sync_history(request: Request, limit: int = 10):
    """Get recent sync history."""
    sync_engine = request.app.state.sync_engine
    return {"history": sync_engine.get_history(limit=limit)}


@router.post("/run")
async def trigger_sync(data: SyncRequest, request: Request):
    """Manually trigger a sync operation."""
    sync_engine = request.app.state.sync_engine

    try:
        direction = SyncDirection(data.direction)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid direction: {data.direction}. Use pull, push, or bidirectional.",
        )

    entities = None
    if data.entities:
        try:
            entities = [BuildertrendEntity(e) for e in data.entities]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid entity: {e}")

    result = await sync_engine.run_full_sync(direction=direction, entities=entities)
    return result


@router.post("/stop")
async def stop_sync(request: Request):
    """Stop the scheduled sync engine."""
    sync_engine = request.app.state.sync_engine
    await sync_engine.stop()
    return {"status": "stopped"}


@router.post("/start")
async def start_sync(request: Request):
    """Start the scheduled sync engine."""
    sync_engine = request.app.state.sync_engine
    await sync_engine.start_scheduled_sync()
    return {"status": "started"}
