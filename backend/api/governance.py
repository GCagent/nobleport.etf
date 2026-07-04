"""
Stephanie.ai Governance API

Exposes the executable governance layer: the Authority Matrix, the credential
register, a live classification endpoint, and measured governance metrics.

The /metrics endpoint computes numbers from real gate decisions over the
reproducible scenario baseline — not asserted figures. POST /classify runs a
single action through the same gate the metrics are built on.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.governance import (
    AUTHORITY_MATRIX,
    CREDENTIAL_REGISTER,
    ActionRequest,
    Lane,
    StephanieGate,
    run_baseline,
)
from backend.governance.truth_layer import TAG_DEFINITIONS

router = APIRouter()


class ClassifyRequest(BaseModel):
    action_type: str = Field(..., examples=["payment_approval"])
    lane: Lane = Field(default=Lane.SYSTEMS)
    description: str = ""
    amount_usd: float | None = None
    external_stakeholder: bool = False
    architectural_change: bool = False
    regulated_action: bool = False
    simulated: bool = False


@router.get("/authority-matrix")
async def authority_matrix():
    """The Authority Matrix (Section 05) as enforced in code."""
    return {
        "rules": [
            {
                "action_type": r.action_type,
                "tag": r.tag.value,
                "disposition": r.disposition.value,
                "note": r.note,
            }
            for r in AUTHORITY_MATRIX
        ],
        "truth_layer_tags": {k.value: v for k, v in TAG_DEFINITIONS.items()},
    }


@router.get("/credentials")
async def credential_register():
    """Credential register (Section 03) — Stephanie may claim none of these."""
    return {
        "register": [
            {
                "credential": c.credential,
                "can_claim": c.can_claim,
                "correct_treatment": c.correct_treatment,
                "licensed_reviewer_required": c.licensed_reviewer_required,
            }
            for c in CREDENTIAL_REGISTER
        ]
    }


@router.post("/classify")
async def classify(req: ClassifyRequest):
    """Run one action through the decision gate and return the ruling."""
    gate = StephanieGate()
    decision = gate.process(
        ActionRequest(
            action_type=req.action_type,
            lane=req.lane,
            description=req.description,
            amount_usd=req.amount_usd,
            external_stakeholder=req.external_stakeholder,
            architectural_change=req.architectural_change,
            regulated_action=req.regulated_action,
            simulated=req.simulated,
        )
    )
    return decision.to_dict()


@router.get("/metrics")
async def metrics():
    """
    Measured governance metrics over the reproducible scenario baseline.
    Every number is computed from actual gate decisions, not asserted.
    """
    _, m = run_baseline()
    return m.as_report()
