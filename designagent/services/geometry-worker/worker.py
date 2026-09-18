"""Geometry worker entrypoint.

Starts a Celery worker that processes geometry queue tasks.
The backend app code is mounted at /app inside the container.
"""

# The actual celery app and tasks are imported from the shared backend code.
# This file serves as the entrypoint for the container CMD.
from app.celery_app import celery  # noqa: F401

# Ensure tasks are registered
import app.workers.zoning  # noqa: F401
import app.workers.estimate  # noqa: F401
