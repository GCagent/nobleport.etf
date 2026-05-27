"""
KPI Dashboard API Routes

Endpoints:
  GET /api/kpi/modules         — All 50 modules with latest KPI readings
  GET /api/kpi/module/:id      — Single module detail
  GET /api/kpi/agent/:name     — All modules for a specific agent
  GET /api/kpi/summary         — Truth label summary (LIVE/MODELED/BLOCKED)
  GET /api/kpi/layers          — Modules grouped by architecture layer
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.config.module_registry import (
    MODULE_DEFINITIONS,
    get_modules_by_agent,
    get_modules_by_layer,
)
from backend.services.kpi_worker import TABLE_QUERY_MAP, kpi_worker

router = APIRouter()


def _module_to_dict(m, reading: dict | None = None):
    base = {
        "module_id": m.module_id,
        "module_name": m.module_name,
        "owner_agent": m.owner_agent,
        "layer": m.layer,
        "kpi_name": m.kpi_name,
        "kpi_unit": m.kpi_unit,
        "source_table": m.source_table,
        "blocked_reason": m.blocked_reason,
        "next_action": m.next_action,
    }

    if reading:
        base["kpi_value"] = reading["kpi_value"]
        base["truth_label"] = reading["truth_label"]
        base["source_ref"] = reading["source_ref"]
        base["measured_at"] = reading["measured_at"]
    else:
        base["kpi_value"] = None
        base["truth_label"] = "BLOCKED"
        base["source_ref"] = None
        base["measured_at"] = None
        base["reason"] = m.blocked_reason
        base["next_action"] = m.next_action

    return base


@router.get("/modules")
async def list_all_modules():
    latest = {r["module_id"]: r for r in kpi_worker.get_latest()}
    modules = [
        _module_to_dict(m, latest.get(m.module_id))
        for m in MODULE_DEFINITIONS
    ]
    return {
        "modules": modules,
        "summary": kpi_worker.get_truth_summary(),
        "total": len(MODULE_DEFINITIONS),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/module/{module_id}")
async def get_module(module_id: int):
    module = next(
        (m for m in MODULE_DEFINITIONS if m.module_id == module_id), None
    )
    if not module:
        return {"error": f"Module {module_id} not found"}

    reading = kpi_worker.get_module_reading(module_id)
    return _module_to_dict(module, reading)


@router.get("/agent/{agent_name}")
async def get_agent_modules(agent_name: str):
    modules = get_modules_by_agent(agent_name)
    if not modules:
        return {"error": f"No modules found for agent: {agent_name}", "modules": []}

    readings = {r["module_id"]: r for r in kpi_worker.get_agent_readings(agent_name)}
    return {
        "agent": agent_name,
        "modules": [
            _module_to_dict(m, readings.get(m.module_id))
            for m in modules
        ],
        "total": len(modules),
    }


@router.get("/summary")
async def get_kpi_summary():
    summary = kpi_worker.get_truth_summary()
    return {
        "summary": summary,
        "by_agent": {
            agent: {
                "total": len(mods),
                "modules": [m.module_name for m in mods],
            }
            for agent in [
                "Stephanie.ai", "GCagent.ai", "PermitStream.ai",
                "Cyborg.ai", "Borg.ai", "Kuzo.io",
            ]
            if (mods := get_modules_by_agent(agent))
        },
        "by_layer": {
            layer: {
                "total": len(mods),
                "modules": [m.module_name for m in mods],
            }
            for layer in [
                "Executive", "Construction", "Permitting",
                "Security", "Infrastructure",
            ]
            if (mods := get_modules_by_layer(layer))
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/layers")
async def get_modules_by_layers():
    latest = {r["module_id"]: r for r in kpi_worker.get_latest()}
    layers: dict[str, list] = {}
    for m in MODULE_DEFINITIONS:
        if m.layer not in layers:
            layers[m.layer] = []
        layers[m.layer].append(_module_to_dict(m, latest.get(m.module_id)))
    return {
        "layers": layers,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/refresh")
async def refresh_kpi():
    """Trigger a manual KPI collection cycle."""
    readings = await kpi_worker.collect_all()
    summary = kpi_worker.get_truth_summary()
    return {
        "collected": len(readings),
        "summary": summary,
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/wiring")
async def get_wiring_status():
    """Show which modules have source tables wired vs blocked."""
    wired = sorted(TABLE_QUERY_MAP.keys())
    all_ids = [m.module_id for m in MODULE_DEFINITIONS]
    blocked = [mid for mid in all_ids if mid not in TABLE_QUERY_MAP]

    wired_modules = [
        {"module_id": m.module_id, "module_name": m.module_name, "source_table": m.source_table}
        for m in MODULE_DEFINITIONS
        if m.module_id in TABLE_QUERY_MAP
    ]
    blocked_modules = [
        {"module_id": m.module_id, "module_name": m.module_name, "blocked_reason": m.blocked_reason, "next_action": m.next_action}
        for m in MODULE_DEFINITIONS
        if m.module_id not in TABLE_QUERY_MAP
    ]

    return {
        "wired": {"count": len(wired), "modules": wired_modules},
        "blocked": {"count": len(blocked), "modules": blocked_modules},
        "total": len(MODULE_DEFINITIONS),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
