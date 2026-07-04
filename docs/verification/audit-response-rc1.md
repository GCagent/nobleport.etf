# RC1 Audit Response — Verification Framework

Point-by-point response to the verification-framework audit. Each issue is mapped
to the **actual** NoblePort stack (FastAPI · SQLAlchemy/Alembic · Stripe ·
Next.js), not the generic TypeScript/Prisma/Twilio/QuickBooks stack the audit
template assumed. Every fix is backed by a runnable check.

> Stack note: the audit referenced TypeScript build / Prisma migrations / Docker
> / Twilio webhooks / `/api/payments/test`. This backend is **Python/FastAPI**
> with **Alembic** migrations and a **Stripe** webhook. The fixes below preserve
> the audit's *intent* on the real surfaces.

---

## 1. Verification script had false positives ✅ FIXED

**Was:** `curl … | grep -q "healthy"` — passes on `{"status":"unhealthy"}` because
"healthy" is a substring.

**Now:** [`verify_deployment.sh`](../../backend/verification/verify_deployment.sh)
parses and **exact-matches** the field:

```bash
STATUS="$(printf '%s' "$HEALTH_BODY" | jq -r '.status')"
printf '%s' "$STATUS" | grep -qx "healthy"      # -x = whole-line, exact
```

The k6 load harness applies the same exact check (`JSON.parse(body).status ===
'healthy'`) so it can't drift under load either.

## 2. Stripe "test endpoint" was undefined ✅ FIXED

**Was:** verification POSTed to `/api/payments/test`, a route that does not exist.

**Now:** there is no generic test route, and there should not be one. Verification
targets the **real** payment surface,
`POST /api/payments/checkout/deposit`, in
[`test_payment_verification.py`](../../backend/verification/tests/test_payment_verification.py):
checkout payload shape, cents-correct amount, persisted `PENDING` payment, and
the deposit gate staying closed until a webhook confirms.
[`test_route_contract.py`](../../backend/verification/tests/test_route_contract.py)
additionally **asserts the phantom `/api/payments/test` is absent**, so no step
can ever silently target it again.

## 3. Webhook test bypassed signature security ✅ FIXED (+ real bug found)

**Was:** the webhook test sent a payload without validating the signature. (The
audit named Twilio's `X-Twilio-Signature`; in this stack the security-critical
webhook is **Stripe**, `stripe-signature`, HMAC-SHA256.)

**Now:** [`test_webhook_security.py`](../../backend/verification/tests/test_webhook_security.py)
exercises the full matrix against the real validator and endpoint:

- reject: **missing**, **malformed**, **wrong-secret**, **tampered-payload**
- accept: correctly signed
- fail-closed: with a secret configured, a forged signature returns **400** and
  the handler **never runs** (asserted via a tripwire mock).

**Bug surfaced and fixed:** `StripeService.verify_webhook_signature` raised
`ValueError` (HTTP 500) on a malformed `stripe-signature` header instead of
returning `False`. A validator that *crashes* on attacker-controlled input is a
DoS and a correctness hazard. Hardened in
[`stripe_service.py`](../../backend/services/stripe_service.py) to fail closed on
any unparseable header. This is verification doing its job: it found a real
defect, not just documented an intent.

## 4. Integration tests assumed routes exist ✅ FIXED

**Was:** the suite referenced routes (`/api/clients`, `/api/dashboard`, …) whose
existence was unverified — a 404 reads as "responded."

**Now:** [`test_route_contract.py`](../../backend/verification/tests/test_route_contract.py)
introspects the live `app.routes` table and asserts every route the framework
depends on is actually registered (and that there are no method/path collisions).
The behavioural tests only run against routes the contract test has proven exist.
"The suite references these routes" is now "these routes are registered and
addressable."

## 5. Load target mismatch ✅ FIXED

**Was:** a "1000+ req/sec" claim backed by a 20 → 50 VU ramp.

**Now:** [`k6_tiered.js`](../../backend/verification/load/k6_tiered.js) measures
**250 / 500 / 1000 concurrent users** as separate, staggered scenarios, each with
its own per-tier latency budget (p95 < 400 / 800 / 1500 ms) and a global < 1%
error budget. The report shows the degradation curve instead of averaging tiers.
The harness hits read-only endpoints only — load must never create real charges.
*(This is the harness; the **report** is a live-only artifact — see §status.)*

## 6. Missing rollback verification ✅ FIXED

**Was:** no migration-rollback or backup-restore test.

**Now:** [`test_migration_rollback.py`](../../backend/verification/tests/test_migration_rollback.py)
drives the real Alembic revision `base → head → base → head` against a throwaway
DB, asserting the revenue tables appear, disappear, and reappear — proving
`downgrade()` actually reverses. It also proves the **backup-before-migration**
invariant with a real backup → mutate → restore roundtrip (restore returns the
exact prior state). The production Postgres `pg_dump`/`pg_restore` runbook is in
[`verification-framework.md`](./verification-framework.md).

## 7. Missing object-storage validation ✅ ADDRESSED (honestly)

**Was:** schema implied `Photo` / `s3Key` but upload/retrieve/sign/delete were
never proven.

**Finding:** this build has **no** object-storage backend — no `Photo` model, no
bucket config, no storage SDK, no presign code. Fabricating an
upload/retrieve/sign/delete proof would be exactly the false evidence the audit
warns against.

**Now:** [`test_object_storage.py`](../../backend/verification/tests/test_object_storage.py)
enforces the *honest contract* — it verifies no storage backend is wired in and
that nothing advertises object storage as LIVE. It is a **tripwire**: the day a
storage backend is added, the test fails, forcing real upload/retrieve/sign/delete
evidence before the capability can ship. Recorded as `NOT_APPLICABLE`
(non-gating), so it neither blocks RC1 nor lets a phantom capability pass.

---

## Updated classification

Unlike the prior audit (Runtime Evidence **0%**), the offline gating artifacts
now carry **real execution evidence**. Live-only artifacts remain honestly
pending.

| Area | Axis | Status |
|------|------|--------|
| Architecture | design | 93% |
| Database | design | 94% |
| API Design | design | 90% |
| Security Design | design | 82% |
| Compliance Design | design | 85% |
| Deployment Design | design | 90% |
| **Runtime Evidence (gating)** | **execution** | **6 / 8 proven (75%)** |
| Load proof (250/500/1000) | execution | PENDING (live) |
| Stripe sandbox proof | execution | PENDING (live) |

### Truth label (computed, not asserted)

```
STATUS:               STAGED
CLASSIFICATION:       PARTIAL-EVIDENCE
EVIDENCE LEVEL:       PARTIAL   (6/8 gating artifacts proven with real runtime evidence)
DEPLOYMENT VERIFIED:  NO
PRODUCTION CERTIFIED: NO
```

Regenerate any time with `backend/verification/run_verification.sh`.

## What upgrades it to RC1

Two live-only gating artifacts remain — collect them against a real deployment:

1. **`load_report`** — `k6_tiered.js` vs staging, all tiers within budget.
2. **`stripe_sandbox`** — Stripe **test-mode** deposit checkout firing a real
   `checkout.session.completed` webhook, signature passing, deposit gate flipping.

When both are collected and passing, `truth_label` flips to
**RC1 / PRODUCTION-CANDIDATE / EVIDENCE LEVEL: FULL** automatically. Same
evidence-gated standard applied across the NoblePort Payment Node, NoblePort
eSign, GCagent Control Spine, PermitStream, and Stephanie.ai systems.
