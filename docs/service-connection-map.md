# NoblePort Service Connection Map

> Every live node, every connection, every gate.
> Treasury: `0xc59e66BB2b6E19699F82A72a1569821cb1711504` (`nobleport.eth`)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS FRONTEND (:3000)                            │
│                                                                             │
│  /dashboard          → Overview KPIs, pipeline, cash position               │
│  /dashboard/revenue  → Revenue engine, invoices, rules                      │
│  /dashboard/jobs     → Active jobs, status, deposits                        │
│  /dashboard/permits  → PermitStream, inspections, forecast                  │
│  /dashboard/agents   → Stephanie, GCagent, Cyborg, AuditBeacon status      │
│  /dashboard/audit    → Audit chain, trust records, kill switches            │
│  /dashboard/compliance → Compliance alerts, governance gates                │
│  /dashboard/voice    → Stephanie voice console (WebSocket)                  │
│  /dashboard/wallet   → MetaMask/Coinbase, NBPT balance, treasury           │
│  /dashboard/realty   → Property analysis, 236 High Road pipeline            │
│  /dashboard/roofing  → Fall protection, roofing proposals                   │
│  /dashboard/orchestras → Multi-agent workflow conductor                     │
│  /dashboard/executive → Executive ops brief, strategic position             │
│  /dashboard/settings → System config, API keys, kill switches              │
│                                                                             │
│  API Routes (src/app/api/v1/dashboard/*)                                    │
│    → Proxy to FastAPI backend at NOBLEPORT_API_BASE                         │
│                                                                             │
│  Libraries:                                                                 │
│    src/lib/nemoclaw/     → Execution policy enforcement (TypeScript)        │
│    src/lib/nobleport-os/ → Master OS manifest + module registry             │
│    src/lib/orchestras/   → Score catalog + conductor API                    │
│    src/lib/wallet/       → wagmi config, NBPT token contract               │
│    src/lib/services/     → 5 business unit service configs                  │
│    src/lib/realty/       → Property analysis engine                         │
│    src/lib/roofing/      → Proposals + fall protection                      │
│    src/lib/dashboard/    → API client (live + mock fallback)                │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │ fetch() / WebSocket
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND (:8000)                                │
│                                                                             │
│  Core API Routers (22 registered):                                          │
│    /api/health          → Liveness + DB + component status                  │
│    /api/leads           → Lead intake, CRM pipeline                         │
│    /api/jobs            → Job lifecycle, deposit enforcement                │
│    /api/payments        → Stripe checkout, webhook, payment state           │
│    /api/invoices        → Invoice CRUD, payment tracking                    │
│    /api/estimates       → Estimating engine                                 │
│    /api/proposals       → Proposal generation + delivery                    │
│    /api/change-orders   → AWO (Approved Work Orders)                        │
│    /api/revenue         → Revenue engine, spine metrics                     │
│    /api/projects        → Project + permit tracking                         │
│    /api/schedules       → Scheduling engine                                 │
│    /api/buildertrend    → Buildertrend CRM sync                            │
│    /api/sync            → HubSpot + Buildertrend sync                      │
│    /api/bridge          → NoblePort Bridge (cross-service)                  │
│    /api/v1/dashboard    → Mission Control data aggregation                  │
│    /api/trust           → Proof of Trust records                            │
│    /api/governance      → Stephanie governance gates                        │
│    /api/learning        → Recursive learning engine                         │
│    /api/journey         → Journey agent (story engine)                      │
│    /api/np-os           → NP-OS master operating system                     │
│    /api/orchestras      → Multi-step workflow conductor                     │
│    /api/ops-brief       → Stephanie executive ops brief                     │
│                                                                             │
│  Services:                                                                  │
│    stripe_service.py    → Stripe Checkout + webhook verification            │
│    revenue_engine.py    → Revenue spine calculations                        │
│    proposal_engine.py   → Automated proposal generation                     │
│    sync_engine.py       → Buildertrend ↔ NoblePort sync                    │
│    hubspot_sync.py      → HubSpot CRM integration                          │
│    stephanie_revenue.py → Stephanie AI revenue analysis                     │
│    nobleport_bridge.py  → Cross-module data bridge                          │
│                                                                             │
│  Agent Mesh:                                                                │
│    stephanie.py         → AI intake, routing, ops brief                     │
│    gcagent.py           → Construction execution agent                      │
│    cyborg.py            → Security + governance agent                       │
│    permit_stream.py     → Building permit automation                        │
│    audit_beacon.py      → Operational memory + audit                        │
│    recursive_learning.py→ Learning loops + knowledge                        │
│    journey.py           → Customer journey orchestration                    │
│    orchestras.py        → Multi-agent score conductor                       │
│    orchestrator.py      → Agent mesh coordinator                            │
│                                                                             │
│  Models (20 SQLAlchemy entities):                                           │
│    Job, Lead, Payment, Invoice, Estimate, Proposal, Project,                │
│    Schedule, ChangeOrder, DailyLog, Inspection, Maintenance,                │
│    Media, Selection, Permit, JourneyAsset, LearningMemory,                  │
│    TrustRecord                                                              │
│                                                                             │
│  Governance:                                                                │
│    authority_matrix.py  → Permission boundaries                             │
│    stephanie_gate.py    → AI action approval gates                          │
│    truth_layer.py       → Fact verification                                 │
│    command_freeze.py    → Frozen config (immutable after deploy)             │
│                                                                             │
│  Core:                                                                      │
│    np_os.py             → Master operating system                           │
│    revenue_loop.py      → Revenue engine core logic                         │
│    proof_of_trust.py    → Trust record management                           │
│    secrets/             → Multi-tier secrets management                     │
│                                                                             │
│  Trading:                                                                   │
│    trading/bot.py       → OctaStackTrader crypto bot                        │
│    trading/strategy.py  → SuperTrend + ADX, EMA crossover                  │
│    trading/mcp_server.py→ MCP interface for AI access                       │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │ HTTP / gRPC (future)
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   RUST PAYMENT MICRO-SERVICES                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ common (library crate)                                              │    │
│  │  Types: PaymentMethod, PaymentStatus, ComplianceStatus, SwapStatus  │    │
│  │  AuditChain: SHA-256 hash chain, append/verify                      │    │
│  │  TreasuryConfig: pinned address + ENS + allowlist                   │    │
│  │  PaymentError: 13 compliance-gated error variants                   │    │
│  │  calculate_tokens(): package pricing + base rate                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │ payment-gateway:3001 │  │ token-manager:3002    │                        │
│  │                      │  │                       │                        │
│  │ Stripe:              │  │ Compliance Engine:    │                        │
│  │  HMAC-SHA256 webhook  │  │  KYC gate            │                        │
│  │  sig verification    │  │  Accredited >$10K     │                        │
│  │                      │  │  OFAC jurisdiction    │                        │
│  │ PayPal:              │  │  Transfer restriction │                        │
│  │  OAuth + cert verify │  │  ERC-1400 compat      │                        │
│  │                      │  │                       │                        │
│  │ MetaMask:            │  │ Token Ledger:         │                        │
│  │  chain_id == 1       │  │  credit (gated)       │                        │
│  │  treasury match      │  │  debit                │                        │
│  │  12 confirmations    │  │  balance query         │                        │
│  │  replay protection   │  │  transaction history   │                        │
│  │  5min price lock     │  │                       │                        │
│  │                      │  │ action_required in     │                        │
│  │ Uniswap:            │  │ every rejection        │                        │
│  │  QUOTE ONLY          │  └──────────────────────┘                        │
│  │  human approval gate │                                                   │
│  │  NO auto-execution   │  ┌──────────────────────┐                        │
│  └──────────────────────┘  │ blockchain-indexer    │                        │
│                             │ :3003                │                        │
│  ┌──────────────────────┐  │                       │                        │
│  │ websocket-server     │  │ Chain verification:   │                        │
│  │ :3004                │  │  10-step tx verify    │                        │
│  │                      │  │  ENS resolution       │                        │
│  │ broadcast::channel   │  │  Price oracle         │                        │
│  │ NotificationEvent    │  │  CoinGecko cache      │                        │
│  │ user_id filtering    │  │  Treasury allowlist   │                        │
│  │ 30s heartbeat        │  └──────────────────────┘                        │
│  └──────────────────────┘                                                   │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SMART CONTRACTS (Ethereum)                              │
│                                                                             │
│  NBPTSecurityToken1400.sol  → ERC-1400 security token (NBPT)               │
│  NoblePortConstructionEscrow.sol → USDC construction escrow                │
│  HumanApprovalGateway.sol   → On-chain approval with ENS identity          │
│  MassachusettsBuildingPermits.sol → Permit lifecycle + treasury             │
│                                                                             │
│  Treasury: 0xc59e66BB2b6E19699F82A72a1569821cb1711504                      │
│  ENS: nobleport.eth                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

## Connection Matrix

| Source → Target | Protocol | Status |
|----------------|----------|--------|
| Dashboard → Next.js API routes | fetch (same-origin) | LIVE (mock fallback) |
| Next.js API → FastAPI backend | fetch (proxy) | WIRED |
| Dashboard → WebSocket (voice) | ws:// | WIRED |
| Dashboard → Wallet (MetaMask) | wagmi/viem | WIRED |
| FastAPI → PostgreSQL | SQLAlchemy async | WIRED |
| FastAPI → Stripe API | stripe SDK | WIRED |
| FastAPI → HubSpot API | httpx | WIRED |
| FastAPI → Buildertrend API | httpx | WIRED |
| Rust payment-gateway → Stripe API | reqwest | BUILT (needs keys) |
| Rust payment-gateway → PayPal API | reqwest | BUILT (needs keys) |
| Rust payment-gateway → Ethereum RPC | reqwest JSON-RPC | BUILT (needs Infura) |
| Rust token-manager → compliance engine | in-process | BUILT |
| Rust blockchain-indexer → Ethereum RPC | reqwest JSON-RPC | BUILT (needs Infura) |
| Rust blockchain-indexer → CoinGecko | reqwest | BUILT |
| Rust websocket-server → broadcast | tokio::broadcast | BUILT |
| Rust → FastAPI (bridge) | HTTP | PLANNED |
| Smart contracts → Ethereum | on-chain | DEPLOYED (contracts exist) |
| GCagent → Agent mesh | in-process | WIRED |
| Nemoclaw → Policy engine | TypeScript lib | WIRED |
| NP-OS → Module registry | TypeScript lib | WIRED |
| Orchestras → Score conductor | Python + TypeScript | WIRED |

## Launch Gate Status

| Gate | Status | Blocker |
|------|--------|---------|
| Dashboard renders | PASS | — |
| FastAPI /health | PASS | needs running server |
| Stripe webhook sig verify | IMPLEMENTED | needs real webhook secret |
| PayPal webhook sig verify | IMPLEMENTED | needs real PayPal creds |
| KYC/accredited gate | IMPLEMENTED | needs real KYC provider |
| Uniswap quote-only | IMPLEMENTED | execution blocked by design |
| Chain ID enforcement | IMPLEMENTED | — |
| 12-block confirmations | IMPLEMENTED | — |
| Replay protection | IMPLEMENTED | — |
| Price lock (5min) | IMPLEMENTED | — |
| Treasury ENS resolution | IMPLEMENTED | needs Infura key |
| Audit chain integrity | IMPLEMENTED | needs persistent storage |
| Wallet connects | PASS | WalletConnect project ID needed |
| NBPT token balance | IMPLEMENTED | needs contract deployment |

## NOT Launch-Ready Until

- [ ] Real Stripe webhook secret in production
- [ ] Real PayPal OAuth credentials
- [ ] KYC provider integration (currently in-memory)
- [ ] Accredited investor verification service
- [ ] PostgreSQL in production (SQLite in dev)
- [ ] Audit chain flushed to durable storage
- [ ] Infura/Alchemy RPC endpoint for mainnet
- [ ] WalletConnect project ID
- [ ] End-to-end smoke test passes
- [ ] Governance team signs off on compliance gates
```
