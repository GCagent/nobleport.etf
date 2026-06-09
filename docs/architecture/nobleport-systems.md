# NoblePort Systems — Architecture & Deployment

How NoblePort's open-source AI agents talk to a clean, no-code user interface.

The complex AI logic stays powerful and open-source; a small general contractor
or real estate agent gets a simple, point-and-click dashboard. The two halves
run independently and are deployed independently.

---

## 1. System architecture

```
+-----------------------------------------------------------------------+
|                           NO-CODE USER LAYER                          |
|        Next.js + Tailwind dashboard  (this repo: src/, /dashboard)    |
|   [ Upload Document ]     [ Select Template ]     [ Prompt Input ]    |
|                  Deployed on Vercel (see .vercelignore)               |
+-----------------------------------------------------------------------+
                                   |
                                   |  Secure HTTPS  (CORS-restricted)
                                   v
+-----------------------------------------------------------------------+
|                          API & ROUTING LAYER                          |
|        FastAPI engine  (backend/main.py, backend/api/*.py)            |
|   * Authenticates small-business users                                |
|   * Standardizes incoming files/requests into JSON payloads          |
|   * Routes to the agent mesh via the orchestrator                     |
+-----------------------------------------------------------------------+
                                   |
                                   |  Internal function calls (AgentMesh)
                                   v
+-----------------------------------------------------------------------+
|                  NOBLEPORT SYSTEMS CORE AGENT LAYER                    |
|              (backend/agents/* + gcagent open-source core)            |
|                                                                       |
|  +-----------+ +--------------+ +-------------+ +--------+ +--------+  |
|  | Stephanie | |   GCagent    | | PermitStream| | Cyborg | | Audit  |  |
|  | intake /  | | construction | | permit &    | | sec /  | | Beacon |  |
|  | routing   | | execution +  | | zoning doc  | | govern | | append |  |
|  |           | | estimating   | | analysis    | | -ance  | | -only  |  |
|  +-----------+ +--------------+ +-------------+ +--------+ +--------+  |
+-----------------------------------------------------------------------+
          |                        |                       |
          v                        v                       v
+-----------------------+ +--------------------+ +----------------------+
|     VECTOR STORAGE    | |    BLOCKCHAIN      | |     LLM GATEWAY      |
|  (Postgres / Supabase | |  NoblePort.eth     | | Anthropic / Ollama   |
|   RAG) zoning &       | |  on-chain escrow & | | deep construction &  |
|   building codes      | |  RWA verification  | | real-estate logic    |
+-----------------------+ +--------------------+ +----------------------+
```

### Conceptual → actual mapping

The conceptual blueprint (`gcagent-core` / `nobleport-api` / `nobleport-ui`)
is already implemented in this repository under production names:

| Conceptual blueprint        | Lives in this repo                                   |
| --------------------------- | ---------------------------------------------------- |
| `nobleport-ui/` (no-code)   | `src/` — Next.js + Tailwind dashboard (Vercel)       |
| `nobleport-api/app.py`      | `backend/main.py` + `backend/api/*.py` (FastAPI)     |
| `gcagent-core/agents/`      | `backend/agents/*` + the open-source `gcagent/` core |
| Estimator Agent             | `backend/agents/gcagent.py` + `backend/api/estimates.py` |
| Document Analyzer           | `backend/agents/permit_stream.py` + `backend/api/buildertrend.py` |
| Lead Prioritizer            | `backend/agents/stephanie.py` + `backend/api/leads.py` |
| Vector storage (RAG)        | Postgres (`asyncpg`) / Supabase                      |
| Blockchain (NoblePort.eth)  | `backend/api/bridge.py`, `backend/services/nobleport_bridge.py`, `web3` |
| LLM gateway                 | Agent layer (Anthropic / Ollama-pluggable)           |

The API surface lives under `/api/*` (full interactive docs at
`/api/docs`). The no-code dashboard calls these endpoints; a button click on a
template becomes an HTTP request that the orchestrator routes into the agent
mesh — exactly the bridge pattern from the conceptual design.

---

## 2. Deployment

Two independently deployable halves:

- **No-code UI** → Vercel (Next.js). `.vercelignore` excludes the Python
  backend so the frontend build stays clean.
- **API + agent core** → Fly.io (this section), or any Docker host via
  `docker-compose.yml`.

### A. Fly.io (recommended — small-business one-click)

The backend is containerized by `backend/Dockerfile` and configured by
`fly.toml` (app `nobleport-systems`, region `bos` / Boston, scale-to-zero so an
idle instance costs almost nothing).

A small business can stand up their **own private, secure instance** from their
fork:

```bash
# 1. Install flyctl and sign in
curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Create the app from the committed config (no deploy yet)
fly launch --copy-config --no-deploy

# 3. Provide secrets (never commit these)
fly secrets set \
  NOBLEPORT_SECRET_KEY="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')" \
  NOBLEPORT_STRIPE_SECRET_KEY="sk_live_..." \
  NOBLEPORT_NOBLEPORT_RPC_URL="https://mainnet.infura.io/v3/YOUR_KEY"

# 4. (Optional) attach managed Postgres for persistent storage
fly postgres create
fly postgres attach <pg-app-name>
# Fly injects DATABASE_URL; map it to the app's expected variable:
fly secrets set NOBLEPORT_DATABASE_URL="postgresql+asyncpg://<user>:<pass>@<host>:5432/<db>"

# 5. Ship it
fly deploy

# 6. Verify
fly status
curl https://nobleport-systems.fly.dev/api/health
```

Fly health checks hit `GET /api/health` every 30s (see `[[http_service.checks]]`
in `fly.toml`). The container also defines a Docker `HEALTHCHECK` against the
same endpoint.

Point the Vercel dashboard at the deployed API by setting its
`NEXT_PUBLIC_API_BASE_URL` to `https://nobleport-systems.fly.dev`.

### B. Self-hosted / local — Docker Compose

For a fully self-owned data pipeline (backend + Postgres + Redis) with one
command:

```bash
cp backend/.env.example .env   # edit secrets
docker compose up -d
open http://localhost:8400/api/docs
```

### C. Bare-metal Linux (systemd)

The original install path is still supported via `backend/deploy/setup.sh`
(systemd unit + nginx reverse proxy). See `backend/deploy/`.

---

## 3. Data ownership

Whether deployed on Fly.io, Docker, or bare metal, the small business owns the
full pipeline end to end: their own database, their own secrets, and a backend
that connects directly to Web3 infrastructure via **NoblePort.eth** to log
transactions and pull verifiable property data.
