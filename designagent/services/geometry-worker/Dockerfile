FROM python:3.12-slim

WORKDIR /backend

# Install deps (worker + backend shared)
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy the shared backend app code (same celery_app, models, workers)
COPY backend/app/ app/

# Copy worker entrypoint
COPY services/geometry-worker/worker.py .

CMD ["celery", "-A", "app.celery_app:celery", "worker", \
     "--queues=zoning,estimate,geometry", \
     "--loglevel=info", "--concurrency=2"]
