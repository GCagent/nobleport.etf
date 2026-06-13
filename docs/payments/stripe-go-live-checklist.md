# Stripe Construction Payment Node — Go-Live Checklist

**Scope:** the construction-deposit payment node only
(`backend/services/stripe_service.py`, `backend/api/payments.py`,
`backend/models/payment.py`). The NBPT / KUZO / liquidity layer is explicitly
**out of scope** and must stay walled off — see
[`payment-token-separation.md`](./payment-token-separation.md).

**Status:** the flow is the right shape — Checkout → signature-verified webhook
→ durable ledger → deposit gate → dashboard. This checklist is the gate between
"runs the test matrix" and "takes a real customer deposit."

> Not legal advice. Customer construction deposits are consumer funds protected
> under **MA c.142A**; treat the controls below as fiduciary, not optional.

---

## P0 — hard blockers (do not flip `STRIPE_MODE=live` until all are ✅)

- [ ] **Rotate the previously hardcoded key.** A prior code review found a
      secret committed to the repo. Rotate it in the Stripe Dashboard
      (Developers → API keys → roll) and confirm the old key is **revoked**, not
      just unused. Purge it from history if it was ever committed. No `sk_live_…`
      value ever lands in the repo — it lives only in server-side secrets.
- [ ] **Stand up the durable Postgres ledger _before_ real money.** The SQLite
      file (`sqlite+aiosqlite:///./nobleport.db`) is fine for the test matrix,
      never for a real deposit. Set `NOBLEPORT_POSTGRES_URL` /
      `NOBLEPORT_DATABASE_URL` to Postgres/Supabase and run the migration
      (`alembic upgrade head`). The live pre-flight (`settings.py`) refuses to
      boot in live mode against SQLite.
- [ ] **Live account approval.** Stripe account fully activated for live charges
      (business profile, bank account, identity verification complete).
- [ ] **Live webhook endpoint registered.** Point Stripe at the production
      `POST /api/v1/payments/webhook/stripe`, subscribe to
      `checkout.session.completed`, `payment_intent.succeeded`,
      `payment_intent.payment_failed`, `charge.refunded`,
      `charge.dispute.created`, and set `NOBLEPORT_STRIPE_WEBHOOK_SECRET` from
      that endpoint's signing secret.
- [ ] **Test-transaction matrix green** (see below).
- [ ] **Mercury reconciliation** confirmed: a test payout lands and reconciles
      against the Mercury operating account before customer money flows.

---

## Configuration gate (enforced in code)

`backend/config/settings.py` will **refuse to start** in live mode unless every
control holds — this is the runtime half of P0, so a half-configured stack
cannot silently go live:

| Setting | Test mode | Live mode requirement |
|---|---|---|
| `NOBLEPORT_STRIPE_MODE` | `test` (default) | `live` |
| `NOBLEPORT_STRIPE_SECRET_KEY` | any / unset | must start with `sk_live_`, not a placeholder |
| `NOBLEPORT_STRIPE_WEBHOOK_SECRET` | optional | **required** |
| `NOBLEPORT_DATABASE_URL` / `POSTGRES_URL` | SQLite ok | **Postgres required** |
| `NOBLEPORT_STRIPE_SUCCESS_URL` / `CANCEL_URL` | localhost ok | **https required** |

In live mode the webhook handler (`api/payments.py`) is **fail-closed**: a
missing secret or missing `Stripe-Signature` header is a hard `400`, never a
silent pass.

---

## Webhook hardening (already implemented)

- [x] **Raw body verification.** Stripe signs the exact bytes it sent; the
      handler verifies against `await request.body()` (raw), never a
      re-serialized object.
- [x] **HMAC-SHA256** over `t.payload` compared with `hmac.compare_digest`.
- [x] **Replay protection.** Events whose signed timestamp is outside
      `NOBLEPORT_STRIPE_WEBHOOK_TOLERANCE_SECONDS` (default 300s) are rejected.
- [x] **Live mode requires a signature** — unsigned webhooks cannot move money.

---

## Test-transaction matrix (run in `test` mode with Stripe test cards)

| Scenario | Card / action | Expected result |
|---|---|---|
| Deposit success | `4242 4242 4242 4242` | `Payment.PAID`, `deposit_gate_passed=True`, job `SCHEDULED` |
| Deposit gate math | deposit ≥ required | gate passes only at/over threshold |
| Progress before deposit | progress checkout, no deposit | rejected: "Deposit must be paid before progress payments" |
| Card declined | `4000 0000 0000 0002` | `Payment.FAILED`, gate stays closed |
| 3DS required | `4000 0025 0000 3155` | completes only after auth |
| Refund | refund a paid charge | `Payment.REFUNDED`, `job.total_paid` reduced |
| Dispute | trigger `charge.dispute.created` | `Payment.DISPUTED` |
| Forged signature | wrong secret | `400 Invalid webhook signature` |
| Replayed event | valid sig, stale timestamp | rejected (outside tolerance) |
| Duplicate delivery | resend same event | idempotent — no double credit |
| Change order | approved CO checkout | CO `amount_paid` / `fully_paid` updated |

---

## Cutover sequence

1. All P0 boxes ✅; isolation + webhook tests green in CI
   (`.github/workflows/payment-node-guard.yml`).
2. Rotate key → set live secrets in the server secret store only.
3. Migrate to Postgres; verify `alembic upgrade head`.
4. Register live webhook; set webhook secret.
5. Set `NOBLEPORT_STRIPE_MODE=live`; confirm the service boots (pre-flight passes).
6. One real low-value deposit end-to-end; reconcile against Mercury.
7. Monitor the first live deposits; keep refund/dispute paths watched.

---

## Rollback

- Set `NOBLEPORT_STRIPE_MODE=test` and redeploy to stop taking live charges.
- Disable the live webhook endpoint in the Stripe Dashboard.
- Live key rotation remains available as a break-glass at any time.
