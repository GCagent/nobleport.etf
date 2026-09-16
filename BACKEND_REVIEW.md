# NoblePort Backend — Architecture & Security Review (Re-run)

_Reviewer: automated backend review · Date: 2026-06-14 · Branch:
`claude/nobleport-backend-review-dh856w`_

## 0. Important correction to the prior review

The earlier review describes a **Node.js / Express + MongoDB + Socket.IO**
package (the `nobleport-replit-backend(1).zip` upload). **That is not the code
in this repository.** The backend in this repo is a **Python / FastAPI 0.115**
application (`backend/`, `version="2.0.0"`) backed by **async SQLAlchemy 2.0 /
Alembic**, Postgres-first (`asyncpg`/`psycopg2`) with a SQLite dev fallback.
There is no Express, Mongo, PayPal, or Socket.IO here.

That matters because **most of the modules the prior review listed as "missing"
already exist in this codebase.** This re-run is graded against the actual
source tree, so the findings are materially different.

| Dimension | Prior review (zip) | This repo (actual) |
|---|---|---|
| Stack | Express / Mongo | FastAPI / SQLAlchemy / Postgres |
| Architecture score | 8.0 / 10 | **7.5 / 10** (strong domain model, one critical security gap) |
| Production readiness | Staging / pilot | **Internal pilot only** — blocked on auth |
| Security posture | Moderate | **Low until API auth is added** |

---

## 1. What this backend actually is

A construction-fintech "NoblePort OS" API gateway. The revenue spine is
`Lead → Intake → Estimate → Permit → Build → Invoice → Closeout`, with an
agent mesh (Stephanie.ai intake/governance, GCagent execution, PermitStream,
Cyborg, AuditBeacon) wired in `backend/main.py`.

Mounted routers (`backend/main.py`): health, leads, projects, schedules,
invoices, buildertrend, sync, bridge, estimates, jobs, payments, change-orders,
revenue, dashboard, trust, ops-brief, governance.

Domain models (`backend/models/`): lead, estimate, job, project, schedule,
change_order, payment, invoice, permit, inspection, daily_log, maintenance,
media, selection, trust_record.

---

## 2. The prior review's "missing" list — already present here

| Prior "missing" item | Status in this repo | Evidence |
|---|---|---|
| Immutable Audit Ledger (event_hash / prev_hash / chain) | **Present** | `agents/audit_beacon.py`, `core/proof_of_trust.py`, `models/trust_record.py` (`record_hash`, `prev_hash`, genesis `0*64`, SHA-256 chain) |
| Change Order (AWO) Ledger | **Present** | `models/change_order.py` (`change_order_number`, `approved_by`, `approved_at`, `total_amount`, deposit fields), `api/change_orders.py` |
| Project Ledger (tie payment → job/CO/invoice) | **Present** | `models/job.py` financials; `payment.job_id` / `payment.change_order_id` FKs |
| Deposit Gate / MA HIC deposit cap | **Present** | `Job.deposit_gate_passed`, `stripe_default_deposit_percent = 30.0` (≤ MA 33%), enforced in `stripe_service._handle_checkout_completed` |
| Human-in-the-loop approvals | **Present** | governance gate dispositions `EXECUTE / STAGE / ESCALATE`, fail-closed; `contracts/HumanApprovalGateway.sol` |
| Lead Command / Estimate Board / Production Board | **Present** | `api/leads.py`, `api/estimates.py`, `api/jobs.py`, `api/schedules.py` |
| PermitStream | **Present** | `agents/permit_stream.py`, `contracts/MassachusettsBuildingPermits.sol` |
| PM / GC / Stephanie agents | **Present** | `agents/` mesh + `gcagent/` package |
| ERC-1400 compliance layer | **Present** | `contracts/NBPTSecurityToken1400.sol` |
| Postgres ledger (vs SQLite) | **Present** | `requirements.txt` asyncpg/psycopg2; `settings.postgres_url` |
| Stripe webhook signature verification | **Present** | `stripe_service.verify_webhook_signature` (HMAC-SHA256, `hmac.compare_digest`) |

The "authority matrix / RBAC" item is **partially** present: the governance
layer (`governance/authority_matrix.py`, `stephanie_gate.py`) maps
*action types* and truth-tags to dispositions and is fail-closed. It is **not**
user-role RBAC (no CEO/Controller/PM/Auditor identity check) — see gap #6.

---

## 3. Genuine gaps (the real re-run findings)

### P0 — Critical

**3.1 No authentication or authorization on any API route.**
There is no JWT, OAuth2, session, or API-key dependency wired to any router.
A grep for `Depends(...)` across `backend/api/` returns only `get_db` and
query-pagination dependencies — no security dependency anywhere. Every
endpoint is publicly callable with no identity, including money-moving and
state-changing ones:
- `POST /api/payments/checkout/deposit|progress|change-order`
- `POST /api/change-orders/...` (approve AWOs)
- `/api/revenue/...`, `/api/governance/...`, `/api/jobs/...`

This is the single blocking issue. The prior review called auth "lightweight";
in this repo it is **absent**. Fix: add FastAPI OAuth2/JWT bearer auth
(`python-jose` + `passlib[bcrypt]` are already in `requirements.txt` but
unused), a `get_current_user` dependency, and apply it at the router level for
every router except `health` and the Stripe webhook.

**3.2 `secret_key` defaults to a committed placeholder and is unused.**
`settings.secret_key = "nobleport-dev-secret-change-in-production"`. It is
never used to sign anything today (because there is no auth). Once auth lands,
it must be loaded from the environment and **fail-closed in production** if
still the default.

**3.3 Stripe webhook verification fails open.**
In `api/payments.py::stripe_webhook`, the signature is only checked
`if stripe_service.webhook_secret and signature`. If `webhook_secret` is unset,
events are processed unverified — and those events flip `deposit_gate_passed`
and recognize revenue. In production this must fail **closed**: reject when the
secret or signature is missing.

### P1 — High

**3.4 No inbound rate limiting.** The only limiter
(`integrations/buildertrend_client.py` token bucket) protects *outbound*
Buildertrend calls. The public FastAPI surface has none. Add `slowapi` (or an
API-gateway/WAF layer) on auth and payment routes.

**3.5 Two parallel audit-chain implementations; durability ambiguous.**
`core/proof_of_trust.py` persists a `TrustRecord` row (DB-backed, durable),
while `agents/audit_beacon.py` keeps its chain **in memory**
(`self._chain: list[...]`, comment: "production: persistent store"). An
in-memory chain is lost on restart and defeats the tamper-evidence guarantee.
Unify on the DB-backed path (or back the agent with `TrustRecord`) and verify
every money/approval event actually writes a row.

**3.6 CORS is permissive.** `allow_methods=["*"]`, `allow_headers=["*"]`,
`allow_credentials=True`. Origins are configurable (good), but with credentials
enabled the method/header wildcards should be narrowed to what the SPA needs.

### P2 — Medium

**3.7 Role-based authority is action-keyed, not identity-keyed.** Once 3.1
exists, map authenticated roles (CEO / Controller / PM / Sales / Client /
Auditor) onto the existing `Disposition` engine so approvals check *who* is
acting, not just *what* action it is.

**3.8 Multi-tenant isolation absent.** Models carry no `tenant_id` /
`organization_id`. Acceptable for a single-org NoblePort deployment; required
only if this becomes multi-org SaaS. Flagged, not blocking.

**3.9 Thin test coverage.** Only `tests/test_governance.py` (126 lines) exists.
The payment lifecycle, deposit-gate transitions, and audit-chain integrity —
the highest-risk paths — are untested. Add tests for
`stripe_service.handle_webhook_event` and chain `verify_chain_integrity`.

**3.10 Health version drift.** `main.py` reports `version="2.0.0"`;
`api/health.py` returns `"version": "1.0.0"`. Cosmetic, but fix for honest
monitoring.

---

## 4. Priority-ordered remediation

1. **Add API authentication (JWT/OAuth2) + apply at router level** — unblocks
   everything else. (P0)
2. **Make the Stripe webhook and `secret_key` fail-closed in production.** (P0)
3. **Add inbound rate limiting on auth/payment routes.** (P1)
4. **Unify the audit chain on durable `TrustRecord` storage; assert every
   payment/approval writes one.** (P1)
5. **Tighten CORS; add role→disposition RBAC; add payment/audit tests.** (P1–P2)

## 5. Bottom line

This is **not** the early-stage Express payment node the prior review
evaluated. It is a far more complete NoblePort OS backend that already ships the
audit ledger, change-order ledger, deposit gate, governance gate, and ERC-1400
layer the prior review asked for. Its score is held down by **one critical
gap**: the API has no authentication. Close P0 (auth + fail-closed webhook) and
this moves from "internal pilot only" to a defensible staging posture; close
P1 and it is a solid 9/10 construction-fintech backend.
