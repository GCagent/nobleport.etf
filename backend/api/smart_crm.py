"""
NoblePort Construction Smart CRM — API (STAGED)

Exposes the canonical Smart CRM blueprint (hubs, core tables, AI agents,
dashboard views, build phases). The map is read straight from
``backend.core.smart_crm.SMART_CRM`` so this endpoint and the registry can
never drift.

This surface is read-only by design. The Smart CRM is a STAGED design blueprint:
every response carries ``status: "staged"`` and no endpoint mutates state,
moves money, files permits, or signs contracts.
"""

from fastapi import APIRouter, HTTPException

from backend.core.smart_crm import SMART_CRM, STATUS, STATUS_NOTE, HubId

router = APIRouter()


@router.get("")
async def system_map():
    """The full Smart CRM blueprint — the single source of truth."""
    return SMART_CRM.system_map()


@router.get("/status")
async def status():
    """Lifecycle status of the Smart CRM blueprint."""
    return {
        "name": SMART_CRM.name,
        "version": SMART_CRM.version,
        "status": STATUS,
        "note": STATUS_NOTE,
    }


@router.get("/hubs")
async def list_hubs():
    """All seven hubs and the capabilities they own."""
    return {"status": STATUS, "hubs": [hub.to_dict() for hub in SMART_CRM.hubs]}


@router.get("/hubs/{hub_id}")
async def get_hub(hub_id: str):
    """A single hub by id (e.g. ``lead``, ``sales``, ``finance``)."""
    try:
        hub = SMART_CRM.hub(hub_id)
    except (KeyError, ValueError):
        valid = ", ".join(h.value for h in HubId)
        raise HTTPException(
            status_code=404,
            detail=f"Unknown hub {hub_id!r}. Valid hubs: {valid}",
        )
    return {
        "status": STATUS,
        "hub": hub.to_dict(),
        "tables": [t.to_dict() for t in SMART_CRM.tables_for_hub(hub.id)],
    }


@router.get("/core-tables")
async def core_tables():
    """The core data tables that make up the single customer record."""
    return {
        "status": STATUS,
        "count": len(SMART_CRM.tables),
        "tables": [t.to_dict() for t in SMART_CRM.tables],
    }


@router.get("/agents")
async def agents():
    """The Stephanie.ai agent layer."""
    return {"status": STATUS, "agents": [a.to_dict() for a in SMART_CRM.agents]}


@router.get("/dashboards")
async def dashboards():
    """Role-scoped dashboard views (CEO, Sales, PM, Finance)."""
    return {
        "status": STATUS,
        "dashboards": [d.to_dict() for d in SMART_CRM.dashboards],
    }


@router.get("/build-phases")
async def build_phases():
    """The recommended build order."""
    return {
        "status": STATUS,
        "phases": [p.to_dict() for p in SMART_CRM.build_phases],
    }
