# NoblePort OS — Distributed State & Computation Engine (v3 PROPOSAL)

**Status: PROPOSAL.** The "v3.0-Alpha" framing in the source report describes
a *target* architecture. The shipped backend today is Python/FastAPI +
SQLAlchemy (Postgres/SQLite) + Celery/Redis + Stripe (`backend/requirements.txt`).
There is no C++ code, no Temporal cluster, no Supabase, and no gRPC anywhere
in this repository. This document preserves the proposal's genuinely useful
content — the bottleneck map, Unix runbooks, and production-promotion gates —
with each element labeled real or proposed.

**Date:** 2026-06-13 · **Source:** operator-provided architecture report
(AI-assisted; "Principal Infrastructure Architect & COO" is a narrative
byline — NoblePort Networks has no such officer of record).

---

## 1. What exists vs. what is proposed

| Element | Status | Reality |
|---------|--------|---------|
| Python 3.11 / FastAPI ASGI core | **REAL** | `backend/main.py` + routers; the daemon layer of the diagram is the shipped app |
| Celery + Redis background workers | **REAL** | In requirements and crew-routing deps; the natural home for the proposal's async work |
| Postgres state layer | **REAL** | SQLAlchemy/asyncpg (the report says "Supabase" — not used; treat as Postgres) |
| Stripe gateway | **REAL** (STAGED) | `backend/api/payments.py`; Mercury exists as MCP tooling, not a backend integration |
| C++20 calculation core (`lib_roof_mesh.so`, `lib_critical_path.so`) | **PROPOSED** | No C/C++ source or build tooling in repo |
| Unix shared-memory IPC graft (`shm_open` + zero-copy views) | **PROPOSED** | Pattern is sound for measured hot paths; premature today (see review) |
| Temporal.io distributed state workers | **PROPOSED** | Not a dependency; Celery covers current workflow needs |
| Arbitrum/Solana RPC ledger nodes | **PROPOSED** | 0 contracts deployed; RPC hosts currently blocked by sandbox egress (see wallet lab) |
| "NoblePort Mobile v2.7" | **NARRATIVE** | NoblePort Mobile is `planned` in the app registry with no code — it has no version number |

## 2. Engineering review of the proposed graft

The shm/zero-copy approach is a legitimate technique for bypassing GIL and
serialization overhead — *after* a profiler shows those are the bottleneck.
Adopt only with evidence. Specific notes on the sample code:

- The "3D roof mesh" kernel is **illustrative only**: the loop computes a
  mangled 2-D shoelace fragment (ignores `z` entirely, overlapping triples,
  no triangulation), so it must not be treated as a working takeoff
  algorithm. A real implementation needs a triangulated mesh and per-triangle
  cross products.
- `__attribute__((packed))` on the point struct will misalign doubles and
  hurt the very performance the graft exists for; align and pad instead.
- The FastAPI endpoint takes `shm_name` from the request — an injection
  surface into `/dev/shm`. Shared-memory names must be generated server-side,
  never client-supplied.
- Sequencing: roofing takeoffs at current volume are estimator-driven
  (`src/lib/roofing/proposals.ts` rates). LiDAR-scale compute is a
  Design-Build/Roofing growth feature, not a present bottleneck.

## 3. Bottleneck map (adopted, with honest module names)

| Layer | Module | Bottleneck | Impact | Mitigation |
|-------|--------|-----------|--------|------------|
| Data & core logic | Backend Postgres | Concurrent row locks under synchronized mobile syncs | Latency on field updates (once NoblePort Mobile exists) | Redis cache for active field logs; batch via Celery workers — **deps already present** |
| AI & orchestration | Stephanie.ai / GC Agent / PM Agent | LLM token latency; state across nested multi-agent workflows | Slow automated ops briefs | Semantic caching; split monolithic flows into parallel async tasks behind the existing orchestrator |
| External integrations | PermitStream scraping | Unstructured municipal portals; regional rate limits | Extraction fails on older town databases | Self-healing retry loops; headless-browser worker pool, isolated from the app thread |
| Financial & Web3 | Payment Node / ERC-1400 (source-only) | Reconciliation between Stripe/Mercury webhooks and (future) chain events | Ledger-state divergence | Stateless listener daemons; webhook clearance = fiat truth (see §5.3) |

## 4. Unix production runbooks (adopted)

Useful as-is for any host running the backend; targets referencing
not-yet-real services (Temporal, permitstream daemon) apply once those exist.

**A. FastAPI worker saturation / fd exhaustion**
```bash
sysctl fs.file-nr
lsof -i :8000
strace -p <pid> -c
sudo sysctl -w net.core.somaxconn=4096
# /etc/security/limits.conf: nobleport_user soft/hard nofile 65535
```

**B. Memory bloat in long-running ingest daemons**
```bash
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -n 5
pmap -x <pid> | tail -n 10
# systemd [Service]: MemoryAccounting=true, MemoryMax=2G, Restart=on-failure
```

**C. Cross-language IPC latency (if/when the C++ graft ships)**
```bash
pidstat -w -I -p <pid> 1 5
valgrind --tool=memcheck --leak-check=full python3 main.py
ls -la /dev/shm/
```

## 5. STAGED → LIVE promotion gates (adopted as policy)

These three engineering gates become the technical bar for promoting a
module in the Operational Truth Matrix. Promotion also still requires the
matrix's own evidence bar — a gate passed is necessary, not sufficient.

1. **Ingestion isolation (PermitStream):** scraping decoupled from the app
   thread into containerized workers; raw harvests land in a staging schema
   and are normalized before touching production tables.
2. **Async notification boundary (Stephanie.ai / agents):** long-running
   agent tasks publish state to a broker (Celery/Redis today); clients get
   WebSocket updates — no synchronous blocking on LLM latency.
3. **Transaction finality rules (Payment Node / Deposit Gate):** Stripe and
   Mercury webhook clearance is the definitive truth for fiat settlement.
   The Deposit Gate registers settled fiat **before** any downstream
   ERC-1400 state changes — consistent with the dual-token spec's
   explorer-checkable supply discipline and the BLOCKED status of
   autonomous payment approval.
