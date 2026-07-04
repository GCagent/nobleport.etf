# RC1 Evidence Manifest

This is the checklist that gates the NoblePort backend from **STAGED** to
**RC1 (Production Candidate)**. Each artifact is either provable offline (run it
here, now) or requires a live deployment + real vendor credentials (collected
against a real environment). Nothing here is hand-asserted — the truth label
(`python -m backend.verification.truth_label`) computes status mechanically from
`evidence_index.json`, which is written by `run_verification.sh`.

> **Principle:** architecture quality ≠ runtime evidence. A green design review
> never upgrades an artifact below. Only a collected, passing artifact does.

## The 10 artifacts

| # | Artifact (`key`)            | Gating | Offline | How to collect |
|---|-----------------------------|:------:|:-------:|----------------|
| 1 | `build_typecheck`           |  ✅    |  ✅     | `python -c "import backend.main"` + `npm run typecheck` |
| 2 | `migration_roundtrip`       |  ✅    |  ✅     | `pytest backend/verification/tests/test_migration_rollback.py` |
| 3 | `route_contract`            |  ✅    |  ✅     | `pytest backend/verification/tests/test_route_contract.py` |
| 4 | `health_endpoint`           |  ✅    |  ✅     | `verify_deployment.sh` / runner health check |
| 5 | `payment_verification`      |  ✅    |  ✅     | `pytest backend/verification/tests/test_payment_verification.py` |
| 6 | `webhook_security`          |  ✅    |  ✅     | `pytest backend/verification/tests/test_webhook_security.py` |
| 7 | `load_report`               |  ✅    |  ❌     | `k6 run load/k6_tiered.js` vs deployed env (250/500/1000) |
| 8 | `stripe_sandbox`            |  ✅    |  ❌     | Stripe **test mode** payment + webhook event capture |
| 9 | `object_storage`            |  —     |  ✅     | `pytest .../test_object_storage.py` (honesty tripwire; N/A in this build) |
| 10| `worker_logs`               |  —     |  ❌     | APScheduler/Celery execution logs from the deployment |

Gating = must be COLLECTED + passing for RC1. `object_storage` and `worker_logs`
are non-gating in this build (no storage backend exists; worker logs are
operational, not correctness, evidence).

## Current state

Run the suite to (re)compute:

```bash
backend/verification/run_verification.sh
```

As of the framework landing, the **6 offline gating artifacts pass with real
execution evidence** (route contract, payments, webhook security, migration
roundtrip, health, build/import). The two **live-only gating artifacts**
(`load_report`, `stripe_sandbox`) are **PENDING** — they cannot be honestly
produced without a deployed environment and Stripe test keys.

Therefore the platform's honest label is:

```
STATUS:               STAGED
CLASSIFICATION:       PARTIAL-EVIDENCE
EVIDENCE LEVEL:       PARTIAL  (6/8 gating proven)
DEPLOYMENT VERIFIED:  NO
PRODUCTION CERTIFIED: NO
```

## What upgrades this to RC1

Collect the two remaining gating artifacts against a real deployment:

1. **`load_report`** — `k6_tiered.js` against staging, all tiers within budget,
   summary JSON saved to `results/k6_tiered.json`.
2. **`stripe_sandbox`** — a Stripe test-mode deposit checkout that fires a real
   `checkout.session.completed` webhook, the signature passes, the deposit gate
   flips, and the event log is saved to `results/`.

When both are COLLECTED and passing, `truth_label` flips to:

```
STATUS:               RC1
CLASSIFICATION:       PRODUCTION-CANDIDATE
EVIDENCE LEVEL:       FULL
```

## Notes

- `results/` and `evidence_index.json` are **generated** (git-ignored). They are
  reproduced by re-running the suite; they are not the source of truth, the
  checks are.
- This is the same evidence-gated standard applied to the NoblePort Payment
  Node, NoblePort eSign, GCagent Control Spine, PermitStream, and Stephanie.ai
  systems.
