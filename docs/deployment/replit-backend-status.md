# NoblePort Replit Backend v1.0 — Deployment Truth Label

**Status:** STAGED → READY FOR DEPLOYMENT TESTING
**Production Status:** NOT YET VERIFIED LIVE
**Reviewed:** 2026-06-12
**Source:** `replit-backend/` (built from the architecture review of `nobleport-replit-backend.zip`)

## Truth Status

| Component | Status |
|---|---|
| Backend structure (Express) | ✅ Present |
| React frontend / SPA build dir | ✅ Present |
| Stripe integration | ✅ Present |
| PayPal integration | ✅ Present |
| MongoDB models (Invoice, Transaction, User) | ✅ Present |
| Replit configuration | ✅ Present |
| Live deployment verified | ❌ Not Verified |
| Live Stripe processing | ❌ Not Verified |
| Live PayPal processing | ❌ Not Verified |
| Production database verified | ❌ Not Verified |
| Enterprise hardening complete | 🟡 Partial |

## Architecture facts (verified in code)

- `server/index.js` mounts the Stripe webhook with `express.raw()` **before**
  `express.json()` so signature verification works against the raw body.
- API routes (`/api/auth`, `/api/stripe`, `/api/paypal`, `/api/health`) load
  **before** the SPA catch-all.
- Helmet and CORS enabled; Winston centralized logging with a separate
  append-only `logs/audit.log` for payment and auth events.
- Construction-only payment controls: approved category allowlist +
  `MAX_PAYMENT_USD` cap enforced before any charge is created.
- Admin authorization: JWT roles, admin-only account creation after the
  bootstrap admin.
- Node 18+ deployment target via `.replit` config.

## Production gates still required

| Gate | Status |
|---|---|
| Stripe live keys configured | 🟡 Open |
| Stripe webhook secret configured | 🟡 Open |
| MongoDB production connection verified | 🟡 Open |
| PayPal endpoints tested | 🟡 Open |
| Replit deployment verified | 🟡 Open |
| Load testing completed | 🟡 Open |
| Backup strategy documented | 🟡 Open |
| Admin authorization reviewed | 🟡 Open |
| Audit logging validated | 🟡 Open |
| Construction-only payment controls verified | 🟡 Open |

Per the NoblePort truth rule (no unverified claims), this package must not be
labeled LIVE until every gate is verified against the running deployment.
