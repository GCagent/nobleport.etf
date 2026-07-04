"""
Journey Agent API.

Exposes the Story Engine: capture an operational artifact and fan it out into its
downstream assets, run a playbook by artifact type, list the channels and
playbooks, read the asset ledger, approve a draft (the human gate), and read the
measured Story Engine metrics and the NoblePort Flywheel.

Every generated asset is a DRAFT (or BLOCKED pending client consent). Nothing is
published by this API — promotion to APPROVED is an explicit human action.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.journey import (
    CONTENT_CHANNELS,
    CONTENT_PLAYBOOKS,
    Artifact,
    AssetLedger,
    AssetStatus,
    JourneyEngine,
    compute_story_engine,
    flywheel_to_dict,
)

router = APIRouter()

# A process-local engine so assets accumulate across requests. (Production would
# hydrate the ledger from the JourneyAsset table on startup.)
_ledger = AssetLedger()
_engine = JourneyEngine(ledger=_ledger)


class ArtifactRequest(BaseModel):
    artifact_type: str = Field(..., examples=["completed_job"])
    project_name: str = Field(..., examples=["236 High Road Roof Replacement"])
    service_line: str = Field(default="", examples=["Roofing"])
    location: str = Field(default="", examples=["Newbury, MA"])
    summary: str = Field(default="", examples=["Full tear-off and architectural shingle install."])
    highlights: list[str] = Field(default_factory=list)
    metrics: dict[str, str] = Field(default_factory=dict, examples=[{"sq_ft": "2,400"}])
    client_name: str = Field(default="", examples=["The Smith Family"])
    client_consent: bool = Field(
        default=False,
        description="Has the client consented to public use of this project?",
    )
    photo_count: int = Field(default=0, ge=0)
    source_id: str = Field(default="")


class ApproveRequest(BaseModel):
    approver: str = Field(..., examples=["Michael F. O'Rourke"])
    consent_recorded: bool = Field(
        default=False,
        description="Set true to record client consent at approval time.",
    )


def _build_artifact(req: ArtifactRequest) -> Artifact:
    try:
        return Artifact(
            artifact_type=req.artifact_type,
            project_name=req.project_name,
            service_line=req.service_line,
            location=req.location,
            summary=req.summary,
            highlights=req.highlights,
            metrics=req.metrics,
            client_name=req.client_name,
            client_consent=req.client_consent,
            photo_count=req.photo_count,
            source_id=req.source_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/process-artifact")
async def process_artifact(req: ArtifactRequest):
    """Capture one artifact and fan it out into its downstream draft assets."""
    artifact = _build_artifact(req)
    run = _engine.process_artifact(artifact)
    return run.to_dict()


@router.post("/playbook/{artifact_type}")
async def run_playbook(artifact_type: str, req: ArtifactRequest):
    """Run a specific artifact type's playbook (path overrides body type)."""
    payload = req.model_copy(update={"artifact_type": artifact_type})
    artifact = _build_artifact(payload)
    return _engine.process_artifact(artifact).to_dict()


@router.post("/assets/{asset_id}/approve")
async def approve_asset(asset_id: str, req: ApproveRequest):
    """Promote a draft to APPROVED — the only path out of DRAFT/BLOCKED."""
    try:
        asset = _ledger.approve(
            asset_id, req.approver, consent_recorded=req.consent_recorded
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        # Consent gate not satisfied — 409 Conflict.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return asset.to_dict()


@router.get("/assets")
async def assets(status: str | None = None, project_name: str | None = None):
    """List generated assets, optionally filtered by status or project."""
    if status:
        try:
            items = _ledger.by_status(AssetStatus(status))
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown status {status!r}; valid: "
                f"{[s.value for s in AssetStatus]}",
            ) from exc
    elif project_name:
        items = _ledger.for_project(project_name)
    else:
        items = _ledger.all()
    return {
        "count": len(items),
        "chain_intact": _ledger.verify_chain(),
        "assets": [a.to_dict() for a in items],
    }


@router.get("/story-engine")
async def story_engine():
    """NoblePort Story Engine metrics, measured from the asset ledger."""
    return compute_story_engine(_ledger).to_dict()


@router.get("/flywheel")
async def flywheel():
    """The NoblePort Flywheel: Project → Documentation → Content → Audience → Leads."""
    return flywheel_to_dict()


@router.get("/channels")
async def channels():
    """The catalog of downstream content channels an artifact can become."""
    return {"channels": [c.to_dict() for c in CONTENT_CHANNELS.values()]}


@router.get("/playbooks")
async def playbooks():
    """Build Once, Publish Everywhere — each artifact type's downstream assets."""
    return {
        "playbooks": [p.to_dict() for p in CONTENT_PLAYBOOKS.values()],
        "note": (
            "Each playbook maps one primary work activity onto the downstream "
            "assets it should generate."
        ),
    }
