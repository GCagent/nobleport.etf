"""FastAPI application — DesignAgent API."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.database import Base, get_engine, SessionLocal
from app.routes.projects import router as projects_router
from app.routes.runs import router as runs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (in production, use Alembic migrations)
    Base.metadata.create_all(bind=get_engine())
    yield


app = FastAPI(
    title="DesignAgent API",
    version="0.1.0",
    description="NoblePort DesignAgent — automated design feasibility control plane",
    lifespan=lifespan,
)

app.include_router(projects_router)
app.include_router(runs_router)


@app.get("/health")
def health():
    """Health check — verifies DB and Redis connectivity."""
    checks = {"api": "ok"}

    # DB check
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        checks["db"] = "ok"
        db.close()
    except Exception as e:
        checks["db"] = f"error: {e}"

    # Redis check
    try:
        from app.celery_app import celery

        celery.connection_for_read().ensure_connection(max_retries=1)
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    status_code = 200 if all(v == "ok" for v in checks.values()) else 503
    return {"status": "healthy" if status_code == 200 else "degraded", "checks": checks}


@app.get("/audit/{project_id}")
def get_audit_log(project_id: int):
    """Return audit trail for a project."""
    from app.models.project import AuditLog

    db = SessionLocal()
    try:
        logs = (
            db.query(AuditLog)
            .filter(AuditLog.project_id == project_id)
            .order_by(AuditLog.id)
            .all()
        )
        return [
            {
                "id": log.id,
                "action": log.action,
                "actor": log.actor,
                "detail": log.detail,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    finally:
        db.close()
