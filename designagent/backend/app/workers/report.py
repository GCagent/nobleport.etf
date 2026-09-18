"""Report generation worker — assembles project report artifact.

Collects zoning envelope + cost estimate + project data into a structured
report and writes it to the shared artifact volume.
"""

import json
import os
from datetime import datetime, timezone

from app.celery_app import celery
from app.config import settings
from app.database import SessionLocal
from app.models.project import AuditLog, Project, Run, RunStatus, RunType


def _build_report(project: Project, zoning_output: dict, estimate_output: dict) -> dict:
    """Pure function: assemble report payload."""
    return {
        "report_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": {
            "id": project.id,
            "name": project.name,
            "address": project.address,
            "org_id": project.org_id,
            "zoning_district": project.zoning_district,
            "lot_area_sf": project.lot_area_sf,
            "frontage_sf": project.frontage_sf,
            "depth_sf": project.depth_sf,
            "lot_width_sf": project.lot_width_sf,
        },
        "zoning_envelope": {
            "conforming": zoning_output.get("conforming"),
            "violations": zoning_output.get("violations", []),
            "max_gfa_sf": zoning_output.get("max_gfa_sf"),
            "max_floors": zoning_output.get("max_floors"),
            "max_height_ft": zoning_output.get("max_height_ft"),
            "effective_footprint_sf": zoning_output.get("effective_footprint_sf"),
        },
        "cost_estimate": {
            "total_estimated_cost": estimate_output.get("total_estimated_cost"),
            "cost_per_sf": estimate_output.get("cost_per_sf"),
            "price_book_version": estimate_output.get("price_book_version"),
            "assumptions": estimate_output.get("assumptions"),
        },
    }


@celery.task(name="app.workers.report.run_report", bind=True)
def run_report(self, run_id: int):
    db = SessionLocal()
    try:
        run = db.query(Run).get(run_id)
        if not run:
            return {"error": f"Run {run_id} not found"}

        run.status = RunStatus.running
        run.celery_task_id = self.request.id
        db.commit()

        project = db.query(Project).get(run.project_id)

        # Fetch latest completed/approved zoning
        zoning_run = (
            db.query(Run)
            .filter(
                Run.project_id == run.project_id,
                Run.run_type == RunType.zoning,
                Run.status.in_([RunStatus.completed, RunStatus.approved]),
            )
            .order_by(Run.id.desc())
            .first()
        )
        # Fetch latest completed/approved estimate
        estimate_run = (
            db.query(Run)
            .filter(
                Run.project_id == run.project_id,
                Run.run_type == RunType.estimate,
                Run.status.in_([RunStatus.completed, RunStatus.approved]),
            )
            .order_by(Run.id.desc())
            .first()
        )

        if not zoning_run or not zoning_run.output_payload:
            run.status = RunStatus.failed
            run.output_payload = {"error": "No completed zoning run found"}
            db.commit()
            return run.output_payload

        if not estimate_run or not estimate_run.output_payload:
            run.status = RunStatus.failed
            run.output_payload = {"error": "No completed estimate run found"}
            db.commit()
            return run.output_payload

        report = _build_report(
            project, zoning_run.output_payload, estimate_run.output_payload
        )

        # Write report to shared volume
        artifact_dir = os.path.join(
            settings.ARTIFACT_ROOT, str(run.project_id), "reports"
        )
        os.makedirs(artifact_dir, exist_ok=True)
        artifact_path = os.path.join(artifact_dir, f"report_run_{run.id}.json")
        with open(artifact_path, "w") as f:
            json.dump(report, f, indent=2)

        run.status = RunStatus.completed
        run.output_payload = report
        run.artifact_path = artifact_path
        run.completed_at = datetime.now(timezone.utc)
        db.commit()

        db.add(
            AuditLog(
                project_id=run.project_id,
                action="report.completed",
                detail={"run_id": run.id, "artifact_path": artifact_path},
            )
        )
        db.commit()

        return report
    finally:
        db.close()
