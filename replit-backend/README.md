# NoblePort Replit Backend v1.0

**Status: STAGED → READY FOR DEPLOYMENT TESTING**
**Production Status: NOT YET VERIFIED LIVE**

Express payments backend for NoblePort Construction LLC: Stripe Checkout,
PayPal Orders, JWT auth, Socket.IO live dashboard, MongoDB persistence,
Winston logging with a separate audit trail, and Replit deployment config
(Node 18+).

## Structure

```
replit-backend/
├── .replit                  # Replit run/deploy configuration
├── .env.example             # Environment template
├── package.json             # Node 18 target
├── server/
│   ├── index.js             # Stripe webhook mounts BEFORE express.json();
│   │                        # API routes load BEFORE the SPA catch-all
│   ├── config/
│   │   ├── db.js            # MongoDB connection
│   │   └── paymentControls.js  # Construction-only category + amount cap
│   ├── middleware/auth.js   # JWT auth + admin authorization
│   ├── models/              # User, Invoice, Transaction
│   ├── routes/              # stripe, paypal, auth
│   └── utils/logger.js      # Winston + append-only audit log
└── client/dist/             # SPA build output (live dashboard)
```

## Run

```bash
cp .env.example .env   # fill in real values
npm install
npm start
# health check: GET /api/health
```

## Construction-only payment controls

Every charge is validated in `server/config/paymentControls.js` before it
reaches Stripe or PayPal: the invoice category must be an approved
construction service and the amount must be under `MAX_PAYMENT_USD`.

## Production gates (all must pass before "VERIFIED LIVE")

- [ ] Stripe live keys configured (`STRIPE_SECRET_KEY` = `sk_live_…`)
- [ ] Stripe webhook secret configured and signature verified end-to-end
- [ ] MongoDB production connection verified
- [ ] PayPal endpoints tested (`PAYPAL_ENV=live`)
- [ ] Replit deployment verified (health endpoint green from public URL)
- [ ] Load testing completed
- [ ] Backup strategy documented
- [ ] Admin authorization reviewed
- [ ] Audit logging validated (`logs/audit.log`)
- [ ] Construction-only payment controls verified

## Truth rule

Per the NoblePort brand standard: no unverified claims. This package is
not described as "live" or "production" until every gate above is checked
and verified against the running deployment.
