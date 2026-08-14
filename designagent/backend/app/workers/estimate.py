"""Cost estimate worker — versioned price book with snapshot assumptions.

Produces a deterministic cost estimate from the zoning envelope + price book.
"""

import json
import os
from datetime import datetime, timezone

from app.celery_app import celery
from app.config import settings
from app.database import SessionLocal
from app.models.project import AuditLog, Run, RunStatus, RunType

# Embedded price book v1 — unit costs per sf by category
PRICE_BOOKS = {
    "v1": {
        "version": "v1",
        "effective_date": "2025-01-01",
        "units": "USD/sf",
        "categories": {
            "foundation": 18.50,
            "framing": 22.00,
            "roofing": 12.00,
            "exterior_envelope": 14.50,
            "interior_finishes": 28.00,
            "mechanical": 16.00,
            "electrical": 11.00,
            "plumbing": 9.50,
            "sitework": 6.00,
            "general_conditions": 8.00,
        },
    }
}


def _compute_estimate(
    zoning_output: dict,
    price_book: dict,
    labor_burden_pct: float,
    waste_factor_pct: float,
    markup_pct: float,
) -> dict:
    """Pure function: envelope + price book + assumptions -> cost estimate."""
    gfa = zoning_output.get("max_gfa_sf", 0)
    categories = price_book["categories"]

    line_items = {}
    base_total = 0.0
    for cat, unit_cost in categories.items():
        raw = gfa * unit_cost
        with_waste = raw * (1 + waste_factor_pct / 100)
        with_labor = with_waste * (1 + labor_burden_pct / 100)
        line_items[cat] = {
            "unit_cost_per_sf": unit_cost,
            "gfa_sf": gfa,
            "raw_cost": round(raw, 2),
            "with_waste": round(with_waste, 2),
            "with_labor_burden": round(with_labor, 2),
        }
        base_total += with_labor

    markup_amount = base_total * (markup_pct / 100)
    total = base_total + markup_amount

    return {
        "price_book_version": price_book["version"],
        "gfa_sf": gfa,
        "assumptions": {
            "labor_burden_pct": labor_burden_pct,
            "waste_factor_pct": waste_factor_pct,
            "markup_pct": markup_pct,
        },
        "line_items": line_items,
        "base_total": round(base_total, 2),
        "markup_amount": round(markup_amount, 2),
        "total_estimated_cost": round(total, 2),
        "cost_per_sf": round(total / gfa, 2) if gfa > 0 else 0,
    }


@celery.task(name="app.workers.estimate.run_estimate", bind=True)
def run_estimate(self, run_id: int):
    db = SessionLocal()
    try:
        run = db.query(Run).get(run_id)
        if not run:
            return {"error": f"Run {run_id} not found"}

        run.status = RunStatus.running
        run.celery_task_id = self.request.id
        db.commit()

        # Get latest completed zoning run for the project
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

        if not zoning_run or not zoning_run.output_payload:
            run.status = RunStatus.failed
            run.output_payload = {"error": "No completed zoning run found"}
            db.commit()
            return run.output_payload

        payload = run.input_payload or {}
        pb_version = payload.get("price_book_version", "v1")
        price_book = PRICE_BOOKS.get(pb_version)
        if not price_book:
            run.status = RunStatus.failed
            run.output_payload = {"error": f"Unknown price book: {pb_version}"}
            db.commit()
            return run.output_payload

        estimate = _compute_estimate(
            zoning_output=zoning_run.output_payload,
            price_book=price_book,
            labor_burden_pct=payload.get("labor_burden_pct", 28),
            waste_factor_pct=payload.get("waste_factor_pct", 10),
            markup_pct=payload.get("markup_pct", 20),
        )

        # Write snapshot to artifact storage
        artifact_dir = os.path.join(
            settings.ARTIFACT_ROOT, str(run.project_id), "estimates"
        )
        os.makedirs(artifact_dir, exist_ok=True)
        artifact_path = os.path.join(artifact_dir, f"estimate_run_{run.id}.json")
        with open(artifact_path, "w") as f:
            json.dump(estimate, f, indent=2)

        run.status = RunStatus.completed
        run.output_payload = estimate
        run.artifact_path = artifact_path
        run.completed_at = datetime.now(timezone.utc)
        db.commit()

        db.add(
            AuditLog(
                project_id=run.project_id,
                action="estimate.completed",
                detail={
                    "run_id": run.id,
                    "total": estimate["total_estimated_cost"],
                    "price_book": pb_version,
                },
            )
        )
        db.commit()

        return estimate
    finally:
        db.close()
