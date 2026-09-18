"""Report worker entrypoint.

Starts a Celery worker that processes the report queue.
The backend app code is mounted at /app inside the container.
"""

from app.celery_app import celery  # noqa: F401

# Ensure tasks are registered
import app.workers.report  # noqa: F401
