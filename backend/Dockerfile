# NoblePort Systems — Backend container
#
# Containerizes the FastAPI API + core agent layer (Stephanie / GCagent /
# PermitStream / Cyborg / AuditBeacon) so a small business can launch a private,
# secure instance with a single command (docker compose) or a single deploy
# (Fly.io).
#
# Build context is the repository root so the `backend` and `gcagent` packages
# are importable as `backend.main:app` and `gcagent.*`.
#
#   docker build -f backend/Dockerfile -t nobleport-backend .
#   fly deploy           # uses backend/Dockerfile via fly.toml

# ---------------------------------------------------------------------------
# Stage 1: builder — compile dependencies into an isolated virtualenv
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Build toolchain for any packages that need to compile from source.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv "$VIRTUAL_ENV"

COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip wheel && pip install -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 2: runtime — slim image with only the venv + application code
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    NOBLEPORT_HOST=0.0.0.0 \
    NOBLEPORT_PORT=8400

# Runtime deps: curl for the container healthcheck, libpq5 for Postgres drivers.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bring over the pre-built virtualenv.
COPY --from=builder /opt/venv /opt/venv

# Application packages (importable from /app).
COPY backend ./backend
COPY gcagent ./gcagent

# Run as an unprivileged user.
RUN useradd --system --create-home --uid 1001 nobleport \
    && mkdir -p /app/data \
    && chown -R nobleport:nobleport /app
USER nobleport

EXPOSE 8400

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${NOBLEPORT_PORT}/api/health" || exit 1

# Two workers keep memory inside the 512MB Fly.io shared VM while still
# handling concurrent no-code dashboard requests.
CMD ["sh", "-c", "uvicorn backend.main:app --host \"$NOBLEPORT_HOST\" --port \"$NOBLEPORT_PORT\" --workers 2 --log-level info"]
