"""
TruthAuditor API

Exposes the Truth & Audit Module:

  GET  /api/truth-audit/label     evidence-gated verdict for a target (real
                                  numbers from the evidence index — never asserted)
  POST /api/truth-audit/audit     same, with target/simulated/prev_digest control
  POST /api/truth-audit/filter    route an avatar/briefing output through the
                                  pre-output truth filter before release

Every score here is computed by ``truth_auditor.audit`` from collected
artifacts. There is no field on this surface that lets a caller inject a score.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.governance.pre_output_filter import filter_output
from backend.verification import truth_auditor as core

router = APIRouter()


class AuditRequest(BaseModel):
    target: str = Field(default="NoblePort Platform", examples=["Irwin Residence Dashboard"])
    simulated: bool = False
    prev_digest: str = core.GENESIS_DIGEST


class FilterRequest(BaseModel):
    text: str = Field(..., examples=["Heah's the read on Irwin Residence..."])
    tag: str | None = Field(
        default=None,
        description="Truth-Layer tag (LIVE/STAGED/SIMULATED/BLOCKED). "
        "Omit with auto_tag=true to derive it from a fresh audit of target.",
    )
    target: str | None = None
    auto_tag: bool = False


@router.get("/label")
async def label(target: str = "NoblePort Platform", simulated: bool = False):
    """Evidence-gated truth verdict for a target (mechanically computed)."""
    return core.audit(target, simulated=simulated).to_dict()


@router.post("/audit")
async def audit(req: AuditRequest):
    """Produce a chained TruthAudit verdict (supply prev_digest to link the chain)."""
    return core.audit(
        req.target, simulated=req.simulated, prev_digest=req.prev_digest
    ).to_dict()


@router.post("/filter")
async def filter_response(req: FilterRequest):
    """
    Route one output through the pre-output truth filter. Untagged input is
    rejected fail-closed unless auto_tag derives a tag from the target's audit.
    """
    tag = req.tag
    if req.auto_tag and not tag:
        tag = core.audit(req.target or "NoblePort Platform").truth_tag
    try:
        result = filter_output(req.text, tag, target=req.target)
        return result.to_dict()
    except ValueError as exc:
        # Fail-closed: an untagged output is withheld, not released with a 500.
        return {
            "released": False,
            "tag": None,
            "disposition": "WITHHOLD_ESCALATE",
            "text": "",
            "disclaimer": core.OVERSIGHT_NOTICE,
            "credential_caveats": [],
            "escalate_to": None,
            "reason": str(exc),
        }
