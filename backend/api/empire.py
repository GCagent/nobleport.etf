"""
Construction Empire API

Serves the NoblePort Construction Empire Registry: every company, platform,
module, and integration in the ecosystem with its Operational Truth status.
This is the surface dashboards and external materials must read from —
no asset may be presented as LIVE unless this registry says so.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.config.empire_registry import (
    EMPIRE_REGISTRY,
    EmpireCategory,
    get_asset,
    get_assets_by_category,
    get_assets_by_status,
    get_empire_map,
    get_empire_summary,
    get_operational_today,
)
from backend.config.operational_truth import DeploymentStatus

router = APIRouter()


@router.get("/")
async def empire_map():
    """The full empire map, grouped by category, every asset truth-labeled."""
    return get_empire_map()


@router.get("/summary")
async def empire_summary():
    """Asset counts by status and category, plus the LIVE roster."""
    return get_empire_summary()


@router.get("/operational")
async def operational_today():
    """Only assets verified operational today (LIVE). The Truth Label roster."""
    return {"operational_today": [a.to_dict() for a in get_operational_today()]}


@router.get("/assets")
async def list_assets(
    status: DeploymentStatus | None = Query(default=None),
    category: EmpireCategory | None = Query(default=None),
):
    """List empire assets, optionally filtered by status and/or category."""
    assets = list(EMPIRE_REGISTRY)
    if status is not None:
        assets = [a for a in assets if a.status == status]
    if category is not None:
        assets = [a for a in assets if a.category == category]
    return {"count": len(assets), "assets": [a.to_dict() for a in assets]}


@router.get("/assets/{key}")
async def asset_detail(key: str):
    """Single asset by registry key."""
    asset = get_asset(key)
    if asset is None:
        raise HTTPException(status_code=404, detail=f"Unknown empire asset: {key}")
    return asset.to_dict()
