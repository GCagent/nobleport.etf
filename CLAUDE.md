# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this repo is

**Noble Port ETF** is a monorepo for the NoblePort ecosystem — a blockchain-enabled
real estate ETF combined with an AI-operated construction/operations platform
("NoblePort OS"). Despite the `nobleport.etf` name and ETF-focused README, the bulk
of the working code is an operations platform: a **Next.js Mission Control frontend**
and a **FastAPI agent-mesh backend** that run construction, permitting, estimating,
payments, compliance, and governance workflows.

It is intentionally a **polyglot monorepo** with four largely independent stacks that
share one git history but build and deploy separately:

| Stack | Language | Location | Purpose |
|-------|----------|----------|---------|
| Frontend | TypeScript / Next.js 14 (App Router) | `src/` | Mission Control dashboard, wallet UI, SSI/Stephanie dashboards |
| Backend | Python 3 / FastAPI | `backend/` | Agent mesh, REST API, data layer, integrations |
| Contracts | Solidity | `contracts/` | ERC-1400 security token, permit registry, human-approval gateway |
| Agent framework | Python + YAML | `gcagent/` | GCagent.ai declarative capability/skill registry |

Supporting, non-code directories: `skills/` (Markdown Agent Skills), `docs/`
(architecture and policy docs).

> Governance posture (applies everywhere): **NoblePort OS is advisory by default; a
> human authorizes.** Code, structural, financial, permit, and money-movement outputs
> are *drafts* requiring a named licensed reviewer or an explicit human approval gate.
> Never fabricate authority, credentials, code values, or engineering figures — surface
> unknowns as gaps to verify. See `skills/README.md` and `contracts/HumanApprovalGateway.sol`.

## Repository layout

```
nobleport.etf/
├── src/                      # Next.js frontend (TypeScript)
│   ├── app/                  # App Router: pages, layouts, API routes
│   │   ├── dashboard/        # Mission Control pages (revenue, jobs, permits, …)
│   │   └── api/v1/dashboard/ # Next.js route handlers (BFF for the dashboard)
│   ├── components/           # React components (dashboard/, wallet/, SSI, Stephanie)
│   ├── lib/                  # Client/business logic
│   │   ├── dashboard/        # Data layer (mock fixtures today; see "Frontend data layer")
│   │   ├── nemoclaw/         # Execution-policy framework (modes, approvals, circuit breakers)
│   │   ├── services/         # NoblePort service-line definitions
│   │   ├── roofing/ realty/ wallet/ nobleport-os/
│   │   ├── ensDidResolver.ts # ENS → DID resolution
│   │   └── stephanieAI.ts    # Stephanie.ai MCP orchestration client
│   └── data/                 # Static data (e.g. Newburyport directory)
│
├── backend/                  # FastAPI backend ("NoblePort OS")
│   ├── main.py               # App entry point — registers all routers, lifespan
│   ├── api/                  # 23 routers (leads, projects, estimates, payments, …)
│   ├── agents/               # Agent mesh: Stephanie, GCAgent, PermitStream, Cyborg,
│   │                         #   AuditBeacon, RecursiveLearning, Journey + orchestrator
│   ├── models/               # 20 SQLAlchemy models (lead, project, estimate, invoice, …)
│   ├── services/             # Sync engine, HubSpot, Stripe, revenue/proposal engines
│   ├── config/               # settings.py (pydantic-settings), database, truth/freeze
│   ├── governance/           # Truth layer, authority matrix, Stephanie gate
│   ├── journey/              # "Story Engine": ops artifacts → content assets
│   ├── integrations/         # Buildertrend client
│   ├── migrations/           # Alembic migrations
│   ├── trading/              # OctaStackTrader — standalone crypto trading bot + MCP server
│   └── verification/         # Evidence-based verification harness (tests + runner)
│
├── contracts/                # Solidity: NBPTSecurityToken1400, MassachusettsBuildingPermits,
│                             #   HumanApprovalGateway
├── gcagent/                  # GCagent.ai capability framework (YAML registry + Python loader)
├── skills/                   # 15 tiered Agent Skills (SKILL.md, Replit/Claude format)
├── docs/                     # Architecture, governance, tokenization, security docs
├── mcp.config.json           # Stephanie.ai MCP server + module routing config
└── package.json / tsconfig / next.config.js / vercel.json   # Frontend toolchain
```

## Build, run, and test

### Frontend (Next.js) — root `package.json`

```bash
npm install          # install dependencies
npm run dev          # next dev — local dev server (default :3000)
npm run build        # next build — production build (Vercel runs this)
npm run start        # next start — serve the production build
npm run lint         # eslint src --ext .ts,.tsx
npm run type-check   # tsc --noEmit
```

- TypeScript is `strict`. The `@/*` path alias maps to `src/*`.
- `tsconfig.json` **excludes** `backend`, `gcagent`, and `contracts` — TS tooling only
  sees `src/`.
- `next.config.js` aliases several optional wallet SDKs to `false` (wagmi's connector
  barrel references packages we don't ship — leave these stubs in place) and sets
  security headers.

### Backend (FastAPI) — `backend/`

```bash
pip install -r backend/requirements.txt

# Run the API (from the repo root so `backend.*` imports resolve)
python -m backend.main          # or: uvicorn backend.main:app --reload
# Serves on :8400 by default. Docs at /api/docs, /api/redoc.

# Database migrations (Alembic; config in backend/alembic.ini)
alembic upgrade head

# Tests (pytest + pytest-asyncio). No pytest.ini — invoke targets directly:
pytest backend/verification/tests/
backend/verification/run_verification.sh   # evidence-based verification harness

# Validate the GCagent registry loads
python -m gcagent.capabilities
```

- Backend uses an **async SQLAlchemy** stack. Default DB is local SQLite
  (`sqlite+aiosqlite:///./nobleport.db`); Postgres (`asyncpg`) is the production target.
- The standalone trading bot has its own deps/config: `backend/trading/requirements.txt`,
  `backend/trading/.env.example`, and runs via `python -m backend.trading`.

### Deployment

- **Vercel** builds the frontend only (`vercel.json` → `next build`). `.vercelignore`
  excludes `backend/`, `contracts/`, `gcagent/`, and all `*.py` — the backend is
  **not** deployed by Vercel.
- The backend ships separately (see `backend/deploy/`: systemd unit + nginx config).

## Configuration & secrets

- **Frontend** env vars use the `NEXT_PUBLIC_` prefix (e.g.
  `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_NOBLEPORT_TREASURY`,
  `NEXT_PUBLIC_DASHBOARD_API_BASE`).
- **Backend** settings live in `backend/config/settings.py` (pydantic-settings) with the
  **`NOBLEPORT_` env prefix** and an `.env` file. See `.env.example` (root) for the full
  inventory.
- Secrets follow **Secrets Management Policy v1.0** (`docs/security/secrets-management-policy.md`):
  provider is `env` for local dev only; production must use AWS / GCP / Vault. The backend
  has a **startup gate** that fails the boot in production if required (Tier 0/1) secrets
  are missing, malformed, or overdue for rotation.
- **Never commit real secrets.** `.env*` is gitignored. Use non-production keys locally.

## Architecture notes

### Backend agent mesh
`backend/agents/orchestrator.py` (`AgentMesh`) is the kernel. It holds the agents and
routes events to a handler via the `EVENT_ROUTING` table (e.g. `lead_created` →
Stephanie). The agents:

- **StephanieAgent** — revenue / intake / executive orchestration
- **GCAgent** — construction execution (jobs, schedules)
- **PermitStreamAgent** — permit intelligence (Massachusetts-focused)
- **CyborgAgent** — security / governance
- **AuditBeaconAgent** — immutable operational memory / audit chain
- **RecursiveLearningAgent** — self-learning executive loop
- **JourneyAgent** — Story Engine (operational artifacts → content assets)

The **revenue spine** the platform automates: `Lead → Intake → Estimate → Permit →
Build → Invoice → Closeout`.

### Frontend data layer (important)
`src/lib/dashboard/api.ts` is the single seam between the dashboard UI and its data.
**Today every read returns deterministic mock fixtures** from `src/lib/dashboard/mock.ts`,
so panels render without a live backend. To wire the real FastAPI gateway, set
`NEXT_PUBLIC_DASHBOARD_API_BASE` and replace each `fetchX()` body with a `fetch()` call —
consumers and panels do not change. Preserve this seam; don't scatter `fetch` calls
through components.

### Nemoclaw execution policy
`src/lib/nemoclaw/` is a type-safe framework for operating modes, action classes,
approval thresholds, signer-gateway policy, proposal lifecycle, circuit breakers, and
audit trails. It is the client-side encoding of the human-approval/governance posture.

### Stephanie.ai + MCP
`mcp.config.json` defines Stephanie.ai's MCP server connections (Claude, ChatGPT, Grok,
Gemini, etc.) and per-module task routing. `src/lib/stephanieAI.ts` is the orchestration
client. Identity is ENS/DID-based (`stephanie.nobleport.eth`).

### GCagent framework
`gcagent/` is **declarative-first**: the YAML files under `gcagent/config/` are the source
of truth (capability layers, skill registry, module registry, output modes); `capabilities.py`
loads and *validates the contracts on every load* (missing fields / unknown references fail
loudly). To add a capability, edit the YAML, add a layer assignment, create the code package
under `gcagent/<layer>/<skill_id>/`, then run `python -m gcagent.capabilities` to validate.

## Conventions

- **Frontend:** TypeScript strict mode; React Server Components by default (Next App
  Router); Tailwind CSS (dark theme, custom `ink-*` palette in `tailwind.config.js`);
  imports via `@/` alias; ESLint `next/core-web-vitals`. Files are documented with a
  top-of-file block comment explaining intent — match that style.
- **Backend:** `from __future__ import annotations`; type hints throughout; pydantic for
  config/schemas; async SQLAlchemy; routers in `backend/api/` registered in `main.py` with
  an explicit `prefix` and `tags`. Models register against `Base` (import side effects in
  `backend.models`). Module docstrings explain purpose — keep them.
- **Skills (`skills/`):** each is a folder with a `SKILL.md` — YAML frontmatter (`name`,
  `description`) plus a fixed body shape (Purpose · When to use · When NOT to use · Inputs ·
  Workflow · Outputs · System integration · Guardrails · Success criteria). Where a skill has
  a live counterpart it names the real endpoint/agent.
- **Match the surrounding code.** This repo is heavily commented and documentation-forward;
  new code should read like its neighbors in comment density, naming, and idiom.

## Working in this repo

- Treat the four stacks as independent: a frontend change rarely needs Python, and vice
  versa. Know which stack a file belongs to before editing (and which toolchain validates it).
- After frontend changes, run `npm run lint` and `npm run type-check`. After backend
  changes, run the relevant `pytest` target. There is no unified CI script that runs both.
- Respect the governance gates: do not remove or bypass human-approval / truth-layer checks,
  and do not introduce code that asserts unverified authority or invents code/engineering/
  financial values.
- This is **proprietary, UNLICENSED** software (registered investment company). Keep it
  internal; don't add code that publishes repo contents externally.

## Git workflow

- Active development branch for current work: **`claude/claude-md-docs-oad1tc`**. Develop,
  commit, and push there; create the branch locally if needed. Do not push to `main` or
  another branch without explicit permission.
- Push with `git push -u origin <branch>`. Do **not** open a pull request unless explicitly
  asked.
</content>
</invoke>
