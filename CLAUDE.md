# CLAUDE.md - NoblePort ETF Codebase Guide

## Project Overview

NoblePort ETF (`nobleport-etf`) is a blockchain-enabled real estate ETF integration platform. It bridges tokenized real estate assets with traditional Exchange-Traded Fund structures, combining a Next.js frontend, Solidity smart contracts, a Python/FastAPI backend, and an AI orchestration layer (Stephanie.ai).

**Ticker symbol:** NBPT
**ENS root identity:** `nobleport.eth`
**License:** Proprietary (UNLICENSED)

## Repository Structure

```
nobleport.etf/
├── src/
│   ├── components/          # React (TSX) UI components
│   │   ├── NavigateNewburyport.tsx       # Local business directory UI
│   │   ├── StephanieAINetworkHub.tsx     # AI orchestration dashboard
│   │   └── NoblePortSSIArchitecture.tsx  # SSI/DID identity dashboard
│   ├── data/
│   │   └── newburyport-directory.ts      # Business directory data
│   ├── lib/
│   │   ├── nemoclaw/        # Execution policy enforcement framework
│   │   │   ├── index.ts     # Central exports
│   │   │   ├── types.ts     # All type definitions
│   │   │   ├── policy.ts    # Core policy engine (mode/approval/role logic)
│   │   │   ├── validation.ts # Proposal validation wall
│   │   │   ├── signer-gateway.ts  # Chain/contract/selector allowlists
│   │   │   ├── proposal.ts  # Proposal lifecycle manager
│   │   │   ├── circuit-breaker.ts # Circuit breakers & kill switches
│   │   │   ├── audit.ts     # Audit trail & reconciliation
│   │   │   └── events.ts    # Event processing & idempotency
│   │   ├── ensDidResolver.ts      # ENS-based DID resolution
│   │   ├── stephanieAI.ts         # Stephanie.ai orchestration core
│   │   └── newburyportDirectory.ts # Directory utilities
├── contracts/
│   ├── HumanApprovalGateway.sol   # Human-in-the-loop decision gateway
│   └── MassachusettsBuildingPermits.sol  # Building permit management
├── backend/                 # Python/FastAPI backend
│   ├── main.py              # FastAPI app entry point
│   ├── api/                 # REST API route handlers
│   │   ├── health.py
│   │   ├── leads.py
│   │   ├── projects.py
│   │   ├── schedules.py
│   │   ├── invoices.py
│   │   ├── buildertrend.py  # Buildertrend integration endpoints
│   │   ├── sync.py          # Data sync endpoints
│   │   ├── bridge.py        # NoblePort ETF bridge API
│   │   └── schemas.py       # Pydantic request/response schemas
│   ├── config/
│   │   ├── settings.py      # Pydantic-based app configuration
│   │   └── database.py      # SQLAlchemy async database setup
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── project.py
│   │   ├── invoice.py
│   │   ├── lead.py
│   │   ├── schedule.py
│   │   ├── daily_log.py
│   │   ├── media.py
│   │   └── selection.py
│   ├── services/
│   │   ├── nobleport_bridge.py  # ETF bridge service (on-chain integration)
│   │   └── sync_engine.py       # Buildertrend data sync engine
│   ├── integrations/
│   │   └── buildertrend_client.py  # Buildertrend API client
│   ├── deploy/              # Deployment configuration
│   │   ├── setup.sh
│   │   ├── nobleport-backend.service  # systemd unit
│   │   └── nginx-nobleport.conf
│   └── requirements.txt     # Python dependencies
├── mcp.config.json          # Stephanie.ai MCP server configuration
├── package.json             # Node.js dependencies & scripts
└── README.md                # Project documentation
```

## Tech Stack

### Frontend
- **Framework:** Next.js 14 with React 18
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3.4
- **Components:** React functional components with `'use client'` directive

### Backend
- **Framework:** FastAPI (Python)
- **Database:** SQLAlchemy 2.0 async with SQLite (aiosqlite) or PostgreSQL
- **Validation:** Pydantic 2 / pydantic-settings
- **HTTP client:** httpx / aiohttp (for Buildertrend integration)
- **Task queue:** Celery with Redis
- **Web3:** web3.py 7.6 for on-chain interactions
- **Server:** Uvicorn, deployed behind Nginx

### Smart Contracts
- **Language:** Solidity ^0.8.20
- **Dependencies:** OpenZeppelin (AccessControl, ReentrancyGuard, Pausable, Counters)

### Identity
- **ENS:** did:ens method for Decentralized Identifiers
- **Libraries:** did-resolver, ens-did-resolver, ethers v6

## Build & Run Commands

### Frontend (Next.js)
```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint on src/
npm run type-check   # TypeScript type checking (tsc --noEmit)
```

### Backend (Python)
```bash
pip install -r backend/requirements.txt   # Install Python dependencies
python -m backend.main                    # Run via module
# Or with uvicorn directly:
uvicorn backend.main:app --host 0.0.0.0 --port 8400 --reload
```

Backend API docs available at `/api/docs` (Swagger) and `/api/redoc`.

## Key Architecture Concepts

### Nemoclaw Execution Policy (src/lib/nemoclaw/)
A deterministic policy engine controlling what actions can execute and under what conditions. Key concepts:

- **Operating Modes:** ReadOnly, Advisory, ControlledExecution, DegradedSafe
- **Action Classes:** A (Informational) through E (Final RWA) with increasing risk
- **Approval Thresholds:** Tiered by USD exposure (<$5K, $5K-$25K, $25K-$100K, >$100K)
- **Separation of Duties:** Creator, approver, and signer must be different people
- **Signer Gateway:** Allowlists for chains (Ethereum mainnet, Arbitrum, Base), contracts, and function selectors
- **Circuit Breakers:** Auto-halt on oracle inconsistency, slippage breach, RPC failures

### HumanApprovalGateway (contracts/HumanApprovalGateway.sol)
Enforces mandatory human approval for all legal, medical, and financial decisions. No bypass mechanism exists. Key flow:
1. `proposeDecision()` - Submit decision for review
2. `submitHumanApproval()` - Credentialed humans approve/reject with justification
3. `executeDecision()` - Execute only after quorum + 1-hour cool-down

### Stephanie.ai (src/lib/stephanieAI.ts)
Central AI orchestration hub connecting 13 LLM platforms via MCP. Routes tasks to optimal platforms based on capabilities (e.g., compliance review -> Claude, market analysis -> Grok).

### NoblePort Bridge (backend/services/nobleport_bridge.py)
Connects construction project data to on-chain representations. Prepares data for permit tokenization and invoice approval via smart contracts.

## Configuration

### Environment Variables
All backend settings use `NOBLEPORT_` prefix (see `backend/config/settings.py`). Key variables:
- `NOBLEPORT_DATABASE_URL` - Database connection string
- `NOBLEPORT_BUILDERTREND_API_KEY` / `NOBLEPORT_BUILDERTREND_API_SECRET` - Buildertrend credentials
- `NOBLEPORT_NOBLEPORT_RPC_URL` - Ethereum RPC endpoint
- AI platform keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. (see README)
- `NEXT_PUBLIC_INFURA_ID` or `NEXT_PUBLIC_ALCHEMY_KEY` - Ethereum provider for ENS

### MCP Configuration
`mcp.config.json` defines Stephanie.ai's connections to AI platforms and NoblePort modules. Each module has an ENS identity (e.g., `portfolio.nobleport.eth`) and DID.

## Coding Conventions

### TypeScript
- Strict typing with exported interfaces and enums
- Barrel exports via `index.ts` files (see `src/lib/nemoclaw/index.ts`)
- Constants use `UPPER_SNAKE_CASE` and `as const`
- ReadonlySet/ReadonlyMap for immutable configuration
- Comprehensive JSDoc with section references (e.g., `@see §3`)

### Python
- Async throughout (async def, AsyncSession, aiosqlite)
- Pydantic models for settings and API schemas
- SQLAlchemy 2.0 async patterns with `select()` queries
- Enum-based status fields (ProjectStatus, InvoiceStatus, TaskStatus)
- Type hints on all function signatures

### Solidity
- OpenZeppelin base contracts for standard patterns
- Explicit NatSpec documentation (`@notice`, `@dev`, `@param`)
- Role-based access control with `bytes32` role constants
- Custom modifiers for state validation

## Critical Invariants

1. **Human-in-the-loop is mandatory** - All legal, medical, and financial decisions must pass through HumanApprovalGateway. There is no bypass.
2. **Separation of duties** - The same person cannot create, approve, and sign an action (Nemoclaw policy).
3. **Signer gateway rejects model-originated requests** - AI/LLM output cannot directly trigger signing operations.
4. **Fail closed** - Nemoclaw policy defaults to denial when mode is insufficient or validation fails.
5. **Minimum review period** - 1-hour cool-down after quorum is reached before execution.
6. **Decision expiry** - Decisions expire after 30 days without execution.

## API Routes (Backend)

All routes prefixed with `/api`:
- `GET /api/health` - Health check
- `/api/leads` - Lead management
- `/api/projects` - Construction project CRUD
- `/api/schedules` - Schedule/task management
- `/api/invoices` - Invoice management
- `/api/buildertrend` - Buildertrend integration
- `/api/sync` - Data synchronization triggers
- `/api/bridge` - NoblePort ETF bridge (portfolio summary, asset reports, permit/invoice preparation)

## Git Workflow

- Primary branch: `main`
- Feature branches use pattern: `claude/<feature-description>-<hash>`
- Commits should be descriptive and reference the feature being added
- Push with: `git push -u origin <branch-name>`
