"""
NoblePort Master Operating System (NP-OS) — API

Exposes the canonical NP-OS definition (layers, master tables, North Star
metrics) and an executive daily-snapshot rollup. The system map is read
straight from ``backend.core.np_os.NP_OS`` so this endpoint and the registry
can never drift.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.core.np_os import NP_OS, LayerId

router = APIRouter()


@router.get("")
async def system_map():
    """The full NP-OS system map — the single source of truth."""
    return NP_OS.system_map()


@router.get("/layers")
async def list_layers():
    """All operating layers and the products that front them."""
    return {"layers": [layer.to_dict() for layer in NP_OS.layers]}


@router.get("/layers/{layer_id}")
async def get_layer(layer_id: str):
    """A single layer by id (e.g. ``revenue``, ``permit``, ``financial``)."""
    try:
        layer = NP_OS.layer(layer_id)
    except (KeyError, ValueError):
        valid = ", ".join(l.value for l in LayerId)
        raise HTTPException(
            status_code=404,
            detail=f"Unknown layer {layer_id!r}. Valid layers: {valid}",
        )
    return {
        "layer": layer.to_dict(),
        "tables": [t.to_dict() for t in NP_OS.tables_for_layer(layer.id)],
    }


@router.get("/master-tables")
async def master_tables():
    """The core database tables that make up the single source of truth."""
    return {
        "count": len(NP_OS.tables),
        "tables": [t.to_dict() for t in NP_OS.tables],
    }


@router.get("/north-star")
async def north_star_metrics():
    """The company North Star metrics everything rolls up into."""
    return {"metrics": [m.to_dict() for m in NP_OS.north_star_metrics]}


@router.get("/executive-snapshot")
async def executive_snapshot():
    """Executive Dashboard daily snapshot scaffold.

    Returns the North Star metric definitions alongside the daily-snapshot
    section structure the executive dashboard renders. Live values are
    populated by the data layer; this endpoint guarantees the shape and the
    metric catalog stay in lockstep with the registry.
    """
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "northStarMetrics": [m.to_dict() for m in NP_OS.north_star_metrics],
        "sections": {
            "revenue": ["Open Pipeline", "Deposits Received", "Contracts Signed"],
            "production": ["Active Jobs", "Behind Schedule", "Inspection Status"],
            "financial": ["Cash Balance", "AR", "AP", "Retention"],
            "permits": ["Submitted", "Approved", "Delayed"],
            "sales": ["Leads", "Estimates", "Close Rate"],
        },
    }
