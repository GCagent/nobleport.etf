"""Run dispatch routes — zoning, estimate, report.

Each route enforces its approval gate before dispatching to Celery.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.gates import (
    GateError,
    require_estimate_issued,
    require_zoning_approved,
)
from app.models.project import AuditLog, Project, Run, RunStatus, RunType
from app.workers.estimate import run_estimate
from app.workers.report import run_report
from app.workers.zoning import run_zoning

router = APIRouter(prefix="/runs", tags=["runs"])


class ZoningRequest(BaseModel):
    project_id: int


class EstimateRequest(BaseModel):
    project_id: int
    price_book_version: str = "v1"
    labor_burden_pct: float = 28
    waste_factor_pct: float = 10
    markup_pct: float = 20


class RunOut(BaseModel):
    id: int
    project_id: int
    run_type: str
    status: str
    celery_task_id: str | None
    output_payload: dict | None
    artifact_path: str | None

    model_config = {"from_attributes": True}


class ApproveRequest(BaseModel):
    run_id: int
    approved: bool
    comment: str | None = None


def _ensure_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/zoning", response_model=RunOut, status_code=201)
def dispatch_zoning(body: ZoningRequest, db: Session = Depends(get_db)):
    _ensure_project(db, body.project_id)

    run = Run(
        project_id=body.project_id,
        run_type=RunType.zoning,
        status=RunStatus.pending,
        input_payload=body.model_dump(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    task = run_zoning.delay(run.id)
    run.celery_task_id = task.id
    db.commit()

    db.add(
        AuditLog(
            project_id=body.project_id,
            action="zoning.dispatched",
            detail={"run_id": run.id, "task_id": task.id},
        )
    )
    db.commit()
    db.refresh(run)
    return run


@router.post("/estimate", response_model=RunOut, status_code=201)
def dispatch_estimate(body: EstimateRequest, db: Session = Depends(get_db)):
    _ensure_project(db, body.project_id)

    # GATE: zoning must be approved/completed first
    try:
        require_zoning_approved(db, body.project_id)
    except GateError as e:
        raise HTTPException(status_code=409, detail=e.message)

    run = Run(
        project_id=body.project_id,
        run_type=RunType.estimate,
        status=RunStatus.pending,
        input_payload=body.model_dump(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    task = run_estimate.delay(run.id)
    run.celery_task_id = task.id
    db.commit()

    db.add(
        AuditLog(
            project_id=body.project_id,
            action="estimate.dispatched",
            detail={"run_id": run.id, "task_id": task.id},
        )
    )
    db.commit()
    db.refresh(run)
    return run


@router.post("/report", response_model=RunOut, status_code=201)
def dispatch_report(project_id: int = Query(...), db: Session = Depends(get_db)):
    _ensure_project(db, project_id)

    # GATE: estimate must be issued first
    try:
        require_estimate_issued(db, project_id)
    except GateError as e:
        raise HTTPException(status_code=409, detail=e.message)

    run = Run(
        project_id=project_id,
        run_type=RunType.report,
        status=RunStatus.pending,
        input_payload={"project_id": project_id},
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    task = run_report.delay(run.id)
    run.celery_task_id = task.id
    db.commit()

    db.add(
        AuditLog(
            project_id=project_id,
            action="report.dispatched",
            detail={"run_id": run.id, "task_id": task.id},
        )
    )
    db.commit()
    db.refresh(run)
    return run


@router.post("/approve", response_model=RunOut)
def approve_run(body: ApproveRequest, db: Session = Depends(get_db)):
    run = db.query(Run).get(body.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.completed:
        raise HTTPException(
            status_code=409,
            detail=f"Run status is '{run.status.value}', must be 'completed' to approve/reject",
        )

    run.status = RunStatus.approved if body.approved else RunStatus.rejected
    db.commit()

    db.add(
        AuditLog(
            project_id=run.project_id,
            action=f"{run.run_type.value}.{'approved' if body.approved else 'rejected'}",
            actor="user",
            detail={"run_id": run.id, "comment": body.comment},
        )
    )
    db.commit()
    db.refresh(run)
    return run


@router.get("/{run_id}", response_model=RunOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(Run).get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("", response_model=list[RunOut])
def list_runs(project_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Run)
    if project_id:
        q = q.filter(Run.project_id == project_id)
    return q.order_by(Run.id.desc()).all()
