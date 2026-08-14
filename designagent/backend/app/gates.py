"""Approval gates — enforced in code, not just UI language.

Rules:
  - No estimate unless latest zoning gate is approved.
  - No report unless estimate is issued (completed or approved).
  - No handoff unless report is released (approved).
"""

from sqlalchemy.orm import Session

from app.models.project import Run, RunStatus, RunType


class GateError(Exception):
    """Raised when a workflow gate is not satisfied."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def _latest_run(db: Session, project_id: int, run_type: RunType) -> Run | None:
    return (
        db.query(Run)
        .filter(Run.project_id == project_id, Run.run_type == run_type)
        .order_by(Run.id.desc())
        .first()
    )


def require_zoning_approved(db: Session, project_id: int) -> Run:
    """Gate: zoning must be approved before estimate can start."""
    run = _latest_run(db, project_id, RunType.zoning)
    if run is None:
        raise GateError("No zoning run exists for this project. Run zoning first.")
    if run.status not in (RunStatus.approved, RunStatus.completed):
        raise GateError(
            f"Latest zoning run (id={run.id}) has status '{run.status.value}'. "
            "It must be approved or completed before an estimate can start."
        )
    return run


def require_estimate_issued(db: Session, project_id: int) -> Run:
    """Gate: estimate must be completed/approved before report can start."""
    run = _latest_run(db, project_id, RunType.estimate)
    if run is None:
        raise GateError("No estimate run exists for this project. Run estimate first.")
    if run.status not in (RunStatus.approved, RunStatus.completed):
        raise GateError(
            f"Latest estimate run (id={run.id}) has status '{run.status.value}'. "
            "It must be completed or approved before a report can start."
        )
    return run


def require_report_released(db: Session, project_id: int) -> Run:
    """Gate: report must be approved before handoff."""
    run = _latest_run(db, project_id, RunType.report)
    if run is None:
        raise GateError("No report run exists for this project. Run report first.")
    if run.status != RunStatus.approved:
        raise GateError(
            f"Latest report run (id={run.id}) has status '{run.status.value}'. "
            "It must be approved before handoff."
        )
    return run
