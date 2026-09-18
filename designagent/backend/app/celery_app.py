"""Canonical Celery application.

Every worker and the API import from here — one app, one broker, one truth.
"""

from celery import Celery

from app.config import settings

celery = Celery(
    "designagent",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="US/Eastern",
    enable_utc=True,
    task_track_started=True,
    task_routes={
        "app.workers.zoning.*": {"queue": "zoning"},
        "app.workers.estimate.*": {"queue": "estimate"},
        "app.workers.report.*": {"queue": "report"},
        "app.workers.geometry.*": {"queue": "geometry"},
    },
)

# Auto-discover tasks from worker modules
celery.autodiscover_tasks(
    [
        "app.workers.zoning",
        "app.workers.estimate",
        "app.workers.report",
    ]
)
