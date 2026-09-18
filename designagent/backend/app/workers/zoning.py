"""Zoning analysis worker — deterministic zoning envelope calculation.

Computes max buildable envelope from lot geometry + zoning district rules.
"""

from datetime import datetime, timezone

from app.celery_app import celery
from app.database import SessionLocal
from app.models.project import AuditLog, Project, Run, RunStatus

# Newburyport zoning rules (subset — extend as districts are added)
ZONING_RULES = {
    "R-1": {
        "max_stories": 2,
        "max_height_ft": 35,
        "front_setback_ft": 25,
        "side_setback_ft": 15,
        "rear_setback_ft": 25,
        "max_lot_coverage_pct": 30,
        "min_lot_area_sf": 20000,
        "min_frontage_ft": 125,
    },
    "R-2": {
        "max_stories": 2.5,
        "max_height_ft": 35,
        "front_setback_ft": 15,
        "side_setback_ft": 10,
        "rear_setback_ft": 20,
        "max_lot_coverage_pct": 35,
        "min_lot_area_sf": 10000,
        "min_frontage_ft": 80,
    },
    "R-3": {
        "max_stories": 3,
        "max_height_ft": 40,
        "front_setback_ft": 10,
        "side_setback_ft": 8,
        "rear_setback_ft": 15,
        "max_lot_coverage_pct": 45,
        "min_lot_area_sf": 5000,
        "min_frontage_ft": 50,
    },
    "B-1": {
        "max_stories": 3,
        "max_height_ft": 45,
        "front_setback_ft": 0,
        "side_setback_ft": 0,
        "rear_setback_ft": 10,
        "max_lot_coverage_pct": 80,
        "min_lot_area_sf": 2500,
        "min_frontage_ft": 25,
    },
}


def _compute_envelope(project: Project, rules: dict) -> dict:
    """Pure function: lot geometry + rules -> buildable envelope."""
    width = project.lot_width_sf or project.frontage_sf or 0
    depth = project.depth_sf or 0

    buildable_width = max(
        0, width - rules["side_setback_ft"] * 2
    )
    buildable_depth = max(
        0, depth - rules["front_setback_ft"] - rules["rear_setback_ft"]
    )
    buildable_footprint_sf = buildable_width * buildable_depth

    max_footprint_sf = (project.lot_area_sf or 0) * (
        rules["max_lot_coverage_pct"] / 100
    )
    effective_footprint_sf = min(buildable_footprint_sf, max_footprint_sf)

    max_floors = int(rules["max_stories"])
    max_gfa_sf = effective_footprint_sf * max_floors

    conforming = True
    violations = []
    if (project.lot_area_sf or 0) < rules["min_lot_area_sf"]:
        conforming = False
        violations.append(
            f"Lot area {project.lot_area_sf} sf < minimum {rules['min_lot_area_sf']} sf"
        )
    if (project.frontage_sf or 0) < rules["min_frontage_ft"]:
        conforming = False
        violations.append(
            f"Frontage {project.frontage_sf} ft < minimum {rules['min_frontage_ft']} ft"
        )

    return {
        "zoning_district": project.zoning_district,
        "rules_applied": rules,
        "buildable_width_ft": buildable_width,
        "buildable_depth_ft": buildable_depth,
        "buildable_footprint_sf": buildable_footprint_sf,
        "max_coverage_footprint_sf": max_footprint_sf,
        "effective_footprint_sf": effective_footprint_sf,
        "max_floors": max_floors,
        "max_height_ft": rules["max_height_ft"],
        "max_gfa_sf": max_gfa_sf,
        "conforming": conforming,
        "violations": violations,
    }


@celery.task(name="app.workers.zoning.run_zoning", bind=True)
def run_zoning(self, run_id: int):
    db = SessionLocal()
    try:
        run = db.query(Run).get(run_id)
        if not run:
            return {"error": f"Run {run_id} not found"}

        run.status = RunStatus.running
        run.celery_task_id = self.request.id
        db.commit()

        project = db.query(Project).get(run.project_id)
        district = project.zoning_district or "R-2"
        rules = ZONING_RULES.get(district)

        if not rules:
            run.status = RunStatus.failed
            run.output_payload = {"error": f"Unknown zoning district: {district}"}
            db.commit()
            return run.output_payload

        envelope = _compute_envelope(project, rules)

        run.status = RunStatus.completed
        run.output_payload = envelope
        run.completed_at = datetime.now(timezone.utc)
        db.commit()

        db.add(
            AuditLog(
                project_id=project.id,
                action="zoning.completed",
                detail={"run_id": run.id, "conforming": envelope["conforming"]},
            )
        )
        db.commit()

        return envelope
    finally:
        db.close()
