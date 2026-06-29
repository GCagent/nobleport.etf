"""
NoblePort OS — Stephanie Orchestras API

Exposes the score catalog and lets the executive console *conduct* a score
across the agent mesh. The conductor reuses the application's shared
``AgentMesh`` (``app.state.agent_mesh``) so every movement flows through the
same routing, audit, and governance path as the rest of the system.

All scores are advisory: frozen commands are staged for human approval, never
executed (see ``backend.agents.orchestras``).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.agents.orchestras import (
    OrchestraConductor,
    get_score,
    list_scores,
)

router = APIRouter()


class ConductRequest(BaseModel):
    """Optional context passed into every movement of a conducted score."""
    context: dict[str, Any] = Field(default_factory=dict)


@router.get("")
async def catalog() -> dict[str, Any]:
    """The catalog of available scores (definitions only — nothing runs)."""
    scores = list_scores()
    return {
        "count": len(scores),
        "advisoryOnly": True,
        "scores": scores,
    }


@router.get("/{score_id}")
async def score_detail(score_id: str) -> dict[str, Any]:
    """A single score definition by id."""
    score = get_score(score_id)
    if score is None:
        raise HTTPException(status_code=404, detail=f"Unknown score {score_id!r}")
    return {"score": score.to_dict()}


@router.post("/{score_id}/conduct")
async def conduct(score_id: str, request: Request, body: ConductRequest | None = None) -> dict[str, Any]:
    """
    Conduct a score across the shared agent mesh and return the performance.

    Frozen movements are staged for human approval, not executed.
    """
    if get_score(score_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown score {score_id!r}")

    mesh = getattr(request.app.state, "agent_mesh", None)
    if mesh is None:
        raise HTTPException(status_code=503, detail="Agent mesh is not available")

    conductor = OrchestraConductor(mesh)
    context = body.context if body else {}
    return await conductor.conduct(score_id, context)
