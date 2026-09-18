# DesignAgent — Automated Design Feasibility Control Plane

## Architecture

```
designagent/
  backend/           # FastAPI API server
    app/
      models/        # SQLAlchemy models (Project, Run, AuditLog)
      routes/        # REST endpoints
      workers/       # Celery task definitions (zoning, estimate, report)
      celery_app.py  # Canonical Celery app (single source of truth)
      config.py      # Environment-driven configuration
      database.py    # DB engine and session
      gates.py       # Approval gates enforced in code
      main.py        # FastAPI entrypoint
  services/
    geometry-worker/ # Celery worker: zoning + estimate queues
    report-worker/   # Celery worker: report queue
  frontend/          # (future) React dashboard
  docker-compose.yml
  .env.example
  smoke-test.sh      # End-to-end validation script
```

## Quick Start

```bash
# 1. Copy env
cp .env.example .env

# 2. Build and start all services
docker compose up --build

# 3. Run smoke test (in another terminal)
./smoke-test.sh
```

## Services

| Service           | Port | Description                          |
|-------------------|------|--------------------------------------|
| api               | 8000 | FastAPI REST API                     |
| worker-geometry   | —    | Celery worker (zoning, estimate)     |
| worker-report     | —    | Celery worker (report generation)    |
| redis             | 6379 | Message broker + result backend      |
| db                | 5432 | PostgreSQL                           |

## Approval Gates (Enforced in Code)

These are **not** UI suggestions — they are hard blocks in the API:

1. **Estimate** requires zoning to be `completed` or `approved`
2. **Report** requires estimate to be `completed` or `approved`
3. **Handoff** requires report to be `approved`

## Smoke Test: 26 Dorothy Lucille

The smoke test creates a project at 26 Dorothy Lucille, Newburyport MA (R-2 zone, 9600 sf lot) and runs:

1. Health check
2. Project creation
3. Zoning analysis (deterministic envelope)
4. Gate enforcement verification
5. Cost estimate (versioned price book)
6. Report generation (artifact written to shared volume)
7. Audit log verification
8. DB persistence check

## Key Design Decisions

- **One Celery app**: All workers import from `app.celery_app` — no `@shared_task` drift
- **Shared volume**: `/artifacts` is a Docker volume mounted across API + all workers
- **Deterministic zoning**: Pure function from lot geometry + district rules, no randomness
- **Versioned price book**: Estimate snapshots include all assumptions for reproducibility
- **Audit trail**: Every material action (create, dispatch, complete, approve) logged
