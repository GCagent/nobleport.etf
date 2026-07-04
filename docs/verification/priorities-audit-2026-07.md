# Priorities Audit — July 2026

Evidence-based reconciliation of the stated 10-initiative priority list
against what actually exists in the codebase. Every claim below was
verified directly against source files in this repository (and the other
repos in the GCagent org where noted), following the same honest-state
philosophy as the verification framework (`docs/verification/`).

## What was verified

- **Test suite**: `python -m pytest backend/` — **190 passed, 0 failed**.
- **Secrets scan**: all 11 org repos scanned for live API keys, private
  keys, committed `.env` files (including full git history of the five
  active repos). **No real secrets found** — only documented placeholders
  (`sk_live_...`, `sk_test_REPLACE_WITH_YOUR_KEY`). The Solana address in
  `nobleport-ecosystem/SOLANA_KEY_VERIFICATION.md` is a public key only.
- **Dependency install**: `pip install -r backend/requirements.txt` was
  broken — `httpx-mock==0.14.0` does not exist on PyPI. Fixed in this
  commit (replaced with `pytest-httpx==0.35.0`).

## Priority-by-priority findings

### 1. Revenue Spine — cannot be "live validated" yet

The spine model (`backend/config/revenue_spine.py`), stage gates, and
DB-backed CRUD for leads, estimates, jobs, invoices, change orders, and
payments are real and tested. However:

- `backend/services/hubspot_sync.py` **builds HubSpot API payloads but
  never sends them** — there is no HTTP client in the module and no
  HubSpot SDK in `requirements.txt`. Outbound sync is a payload factory.
- `backend/services/stripe_service.py` handles webhook signature
  verification and builds checkout descriptors, but **never calls the
  Stripe API** (the `stripe` package is pinned in requirements but not
  imported by the service).

**Blocker for Priority 1:** a live end-to-end HubSpot → Invoice test is
impossible until an outbound HTTP transport is added to both services.
That is the single highest-leverage engineering task on the list.

### 2. Command Board / 22-project dataset — not in any repo

No repository contains the 22 project records, any Airtable reference,
or anything named "Command Board". If that dataset exists, it lives
entirely outside version control (Airtable/HubSpot/spreadsheet).
**Verification against source documents cannot happen from code until
the dataset (or a sync of it) is landed somewhere inspectable.**
Recommended: export the 22 records to a versioned fixture
(`backend/data/` or a seed migration) so rollups become testable.

### 3. Stephanie voice — partially real

ElevenLabs TTS is genuinely called in
`-gcagent-ai-core/clawdbot_orchestrator.py`. **LiveKit appears in no
repo** (no SDK, no config, no code) despite being claimed as the WebRTC
transport. The dashboard voice page renders static copy.

### 4–6. CRM / PM / Financial controls — API surface exists, data flows don't

`backend/api/` exposes jobs, projects, schedules, change orders,
invoices, payments, proposals, ops-brief — all DB-backed. What's missing
is the same thing as Priority 1: no outbound integration transport, and
no seeded real-project data to reconcile against.

### Dashboard KPIs — were misclassified as LIVE

The frontend (`src/lib/dashboard/api.ts`) serves **100% deterministic
mock fixtures** — every `fetch*` function returns `mock.ts` data. The
backend `/dashboard/*` endpoints (`backend/api/dashboard.py`) also
return fixtures. The KPI chain is fixture → fixture end to end.

Per the guiding principle ("every KPI backed by verified source data"),
this commit downgrades three `OPERATIONAL_TRUTH` entries:

| Feature | Was | Now | Evidence |
|---|---|---|---|
| `dashboard_kpis` | LIVE | STAGED | frontend + backend both serve fixtures |
| `voice_intake` | LIVE | STAGED | LiveKit absent from all repos |
| `crew_task_routing` | LIVE | STAGED | langgraph absent from all repos |

`lead_pipeline` stays LIVE but its description no longer claims "CRM
sync" (that is the separate, correctly-STAGED `hubspot_sync` entry).

### 9. Security — in-repo posture is clean

No hardcoded credentials, no committed key material, no `.env` files in
git history. A secrets-manager abstraction exists
(`backend/core/secrets/`). Credential rotation and MFA/passkey checks
are external-account actions and remain open.

### 10. Production launch — blocker confirmed

The 🔴 Blocked status is correct. Concretely: launch is blocked on
(a) outbound HubSpot/Stripe transport, (b) real dashboard data, and
(c) the 22-project dataset being landed and reconciled.

## Recommended sprint order (revised, dependency-driven)

1. **Land the 22-project dataset in-repo** (seed fixture or migration) —
   unblocks Command Board verification and financial reconciliation.
2. **Add outbound HTTP transport** to `hubspot_sync.py` and
   `stripe_service.py` (httpx is already a dependency) — unblocks the
   live end-to-end revenue-spine test.
3. **Wire `backend/api/dashboard.py` to real DB queries** (jobs,
   estimates, invoices tables already exist), then flip the frontend
   swap-point in `src/lib/dashboard/api.ts` — KPIs become truthful.
4. Voice: integrate LiveKit or drop it from the architecture claims;
   ElevenLabs TTS is the only proven piece today.
5. Only after 1–3: freeze v1.0 for pilot.
