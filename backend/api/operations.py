"""
NoblePort FieldOps — Operations API: Revenue Spine

Exposes the Revenue Spine workflow (backend.operations.revenue_spine_workflow)
over HTTP and persists every committed transition into the AuditBeacon
hash-chain ledger — the system's append-only operational memory.

Endpoints:
  GET  /revenue-spine/stages          — canonical stage order, restrictions, guards
  POST /revenue-spine/propose         — advisory decision (no side effects)
  POST /revenue-spine/commit          — enforce the gate, advance, persist an audit record
  GET  /revenue-spine/activity/{pid}  — the persisted activity trail for a project

Authority model: ``propose`` is what Stephanie.ai calls to recommend a
transition; it never writes. ``commit`` enforces the gate — a restricted
transition without an authorized human ``Approval`` is refused (HTTP 409), and a
successful commit writes an AuditBeacon record. Stephanie may recommend, only a
human may authorize a restricted stage change.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.operations.revenue_spine_workflow import (
    REVENUE_STAGE_ORDER,
    RESTRICTED_TRANSITIONS,
    Approval,
    RevenueSpineWorkflow,
    RevenueStage,
    TransitionError,
    evaluate_transition,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ApprovalIn(BaseModel):
    approver: str
    role: str
    reason: str = ""


class ProposeIn(BaseModel):
    from_stage: RevenueStage
    to_stage: RevenueStage
    context: dict[str, Any] = Field(default_factory=dict)


class CommitIn(BaseModel):
    project_id: str
    from_stage: RevenueStage
    to_stage: RevenueStage
    actor: str = "stephanie"
    context: dict[str, Any] = Field(default_factory=dict)
    approval: ApprovalIn | None = None
    reason: str = ""


def _guard_keys(stage: RevenueStage) -> list[str]:
    """The context keys that must be truthy to enter ``stage`` (advisory display)."""
    from backend.operations.revenue_spine_workflow import _GUARDS  # local: internal map

    return [g.context_key for g in _GUARDS.get(stage, ())]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/revenue-spine/stages")
async def stages() -> dict[str, Any]:
    """The canonical Revenue Spine: ordered stages, restrictions, and guards."""
    return {
        "stages": [
            {
                "stage": s.value,
                "index": i,
                "restricted": s in RESTRICTED_TRANSITIONS,
                "guards": _guard_keys(s),
            }
            for i, s in enumerate(REVENUE_STAGE_ORDER)
        ],
        "restrictedStages": sorted(s.value for s in RESTRICTED_TRANSITIONS),
    }


@router.post("/revenue-spine/propose")
async def propose(body: ProposeIn) -> dict[str, Any]:
    """Advisory: would this transition be allowed, and does it need approval?"""
    decision = evaluate_transition(body.from_stage, body.to_stage, body.context)
    return {"decision": decision.to_dict()}


@router.post("/revenue-spine/commit")
async def commit(body: CommitIn, request: Request) -> dict[str, Any]:
    """
    Enforce the gate, advance the workflow, and persist an AuditBeacon record.

    Returns 409 (with the blocking decision) if the transition is refused.
    """
    workflow = RevenueSpineWorkflow(body.project_id, stage=body.from_stage)
    approval = (
        Approval(approver=body.approval.approver, role=body.approval.role, reason=body.approval.reason)
        if body.approval
        else None
    )

    try:
        record = workflow.commit(
            body.to_stage,
            actor=body.actor,
            context=body.context,
            approval=approval,
            reason=body.reason,
        )
    except TransitionError as exc:
        raise HTTPException(status_code=409, detail=exc.decision.to_dict())

    # Persist into the AuditBeacon hash-chain ledger (append-only memory).
    mesh = getattr(request.app.state, "agent_mesh", None)
    audit: dict[str, Any] | None = None
    if mesh is not None and getattr(mesh, "audit_beacon", None) is not None:
        audit = await mesh.audit_beacon.record_event({
            "actor": body.actor,
            "actor_type": "human" if approval else "agent",
            "agent_family": "Stephanie",
            "action": f"revenue_spine.transition.{body.to_stage.value}",
            "subject_type": "revenue_spine",
            "subject_id": body.project_id,
            "detail": f"{body.from_stage.value} → {body.to_stage.value}"
                      + (f": {body.reason}" if body.reason else ""),
            "approval_type": "human" if approval else "auto",
            "approved_by": approval.approver if approval else None,
            "approval_reason": approval.reason if approval else None,
            "document_hash": record.event_hash,
            "ai_suggested": True,
            "human_overrode_ai": False,
        })

    return {
        "committed": True,
        "stage": workflow.stage.value,
        "activityRecord": record.to_dict(),
        "auditRecord": audit,
    }


@router.get("/revenue-spine/activity/{project_id}")
async def activity(project_id: str, request: Request) -> dict[str, Any]:
    """The persisted activity trail for a project, from the AuditBeacon ledger."""
    mesh = getattr(request.app.state, "agent_mesh", None)
    if mesh is None or getattr(mesh, "audit_beacon", None) is None:
        raise HTTPException(status_code=503, detail="Audit ledger is not available")

    trail = await mesh.audit_beacon.get_audit_trail(
        subject_id=project_id, subject_type="revenue_spine"
    )
    return trail
