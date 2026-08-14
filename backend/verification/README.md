# NoblePort Verification Framework

Evidence-gated production verification. **Architecture quality ≠ runtime
evidence** — a well-designed package with no collected artifacts is STAGED, not a
production candidate.

```bash
# Run every offline check, write the evidence index, print the truth label
backend/verification/run_verification.sh

# Smoke-check a running deployment (corrected, exact-match health check)
BASE_URL=https://api.nobleport.example backend/verification/verify_deployment.sh

# Just the label (whole-backend RC1 decision)
python -m backend.verification.truth_label          # human
python -m backend.verification.truth_label --json    # CI

# Per-app truth scorecard (4 evidence tiers + 6 scored dimensions)
python -m backend.verification.app_audit            # human
python -m backend.verification.app_audit --json      # CI (exits non-zero if any app overstates)
```

| Audit issue | Fix | Check |
|-------------|-----|-------|
| #1 health false positive | exact `jq -r .status \| grep -x healthy` | `verify_deployment.sh` |
| #2 phantom `/api/payments/test` | target real `/checkout/deposit`; assert phantom absent | `tests/test_payment_verification.py`, `tests/test_route_contract.py` |
| #3 webhook bypassed signature | Stripe signature reject/accept matrix, fail-closed (+ real bug fixed) | `tests/test_webhook_security.py` |
| #4 tests assumed routes exist | introspect `app.routes`, assert registration | `tests/test_route_contract.py` |
| #5 load target mismatch | 250 / 500 / 1000 user tiers | `load/k6_tiered.js` |
| #6 no rollback verification | Alembic up→down→up + backup/restore roundtrip | `tests/test_migration_rollback.py` |
| #7 no object-storage proof | honest "no backend" tripwire | `tests/test_object_storage.py` |

Full methodology: [`docs/verification/verification-framework.md`](../../docs/verification/verification-framework.md)
· Point-by-point audit response: [`docs/verification/audit-response-rc1.md`](../../docs/verification/audit-response-rc1.md)
· Per-app audit framework: [`docs/verification/app-audit-framework.md`](../../docs/verification/app-audit-framework.md)
· The 10 RC1 artifacts: [`evidence/MANIFEST.md`](./evidence/MANIFEST.md)
