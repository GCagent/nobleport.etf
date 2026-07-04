# NoblePort Load Testing (k6)

Addresses **audit issue #5**: the load target must be characterized at distinct
tiers, not extrapolated from a small ramp.

## Why tiers, not a single ramp

A "1000+ req/sec" claim is not proven by a 20→50 VU test. These configs measure
**250 → 500 → 1000 concurrent users** as separate scenarios, each with its own
latency budget, so the report shows the *degradation curve* and the point at
which SLOs break — rather than averaging a healthy tier with a failing one.

## Files

| File            | Purpose                                                        |
|-----------------|----------------------------------------------------------------|
| `k6_smoke.js`   | 30s / 5 VU rig check. Run first. **Not** RC1 evidence.         |
| `k6_tiered.js`  | The RC1 load harness: 250 / 500 / 1000 user tiers, staggered.  |

## Running

Install k6 (<https://k6.io/docs/get-started/installation/>), then run against a
**deployed** environment (never the dev server):

```bash
# Smoke first
BASE_URL=https://api.nobleport.example k6 run k6_smoke.js

# Full tiered run (≈9 min: three 2m hold windows + ramps)
BASE_URL=https://api.nobleport.example \
  k6 run --summary-export=../evidence/results/k6_tiered.json k6_tiered.js

# A single tier
BASE_URL=https://api.nobleport.example k6 run --env TIER=t1000 k6_tiered.js
```

## Pass/fail budgets (in `k6_tiered.js`)

| Tier | Concurrent users | p95 latency budget | Error budget |
|------|------------------|--------------------|--------------|
| t250 | 250              | < 400 ms           | < 1%         |
| t500 | 500              | < 800 ms           | < 1%         |
| t1000| 1000             | < 1500 ms          | < 1%         |

A tier that breaches its threshold fails the run (non-zero exit), so this can
gate a release in CI/CD against a staging deployment.

## Scope guardrail

The harness hits **read-only** endpoints only. Load testing must never create
real Stripe charges or mutate the revenue ledger — the payment/webhook **write**
paths are proven by the pytest suite (`test_payment_verification.py`,
`test_webhook_security.py`) and the Stripe sandbox artifact, not by load.

## Evidence status

The **report** produced here is the `load_report` RC1 artifact. Until this is run
against a real environment and the JSON summary is captured under
`evidence/results/`, the artifact is **PENDING** in the truth label — the harness
existing is not the same as the load being proven.
