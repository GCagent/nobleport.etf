"""
Stephanie.ai Modules API

The 50-module catalog and the orchestrated execution surface. Execution flows
through StephanieOrchestrator, so every register gate (blocked, legal hold,
claimed, human-gated) is enforced on the wire, and every decision — including
refusals — is hash-chain logged.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.stephanie import StephanieOrchestrator

router = APIRouter()
orchestrator = StephanieOrchestrator()


class ExecuteRequest(BaseModel):
    module_key: str
    operation: str = "default"
    payload: dict[str, Any] = Field(default_factory=dict)


@router.get("")
async def get_catalog():
    """All 50 modules with build state (executable / bound / scaffold)."""
    return orchestrator.catalog_dict()


@router.get("/decisions")
async def get_decision_log():
    """The hash-chained orchestration decision log."""
    return {
        "chain_intact": orchestrator.verify_log(),
        "decisions": orchestrator.decision_log(),
    }


@router.get("/{module_key}")
async def get_module(module_key: str):
    """One module spec by register key."""
    spec = orchestrator.module(module_key)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Unknown module {module_key!r}")
    return spec.to_dict(orchestrator.has_handler(module_key))


@router.post("/execute")
async def execute_module(req: ExecuteRequest):
    """
    Route a task through Stephanie. Register gates apply: blocked/held/claimed
    modules refuse, human-gated modules stage drafts, demo output is SIMULATED.
    """
    try:
        decision = orchestrator.execute(req.module_key, req.operation, req.payload)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return decision.to_dict()
