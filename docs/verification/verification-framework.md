# NoblePort Verification Framework

Evidence-gated production verification for the NoblePort backend
(FastAPI · SQLAlchemy/Alembic · Stripe · Next.js).

## The one rule

**Architecture quality and runtime evidence are different axes and are never
conflated.** A 90%-designed deployment package with zero collected artifacts is
**STAGED / PRE-PRODUCTION**, not a production candidate. This framework exists to
(1) run every check that can be run *now* and emit real evidence, and (2) mark
everything that needs a live environment as **PENDING** — never fabricating proof.

This mirrors the honesty already enforced per-feature by
[`backend/config/operational_truth.py`](../../backend/config/operational_truth.py)
(`LIVE / STAGED / MODELED / INTERNAL_R&D`), lifted to a whole-platform RC decision.

## Layout

```
backend/verification/
├── truth_label.py            # computes STATUS / CLASSIFICATION / EVIDENCE LEVEL
├── run_verification.sh       # runs offline checks, writes evidence index, prints label
├── verify_deployment.sh      # smoke-checks a RUNNING deployment (corrected health check)
├── tests/
│   ├── test_route_contract.py        # issue #4 — advertised routes really exist
│   ├── test_payment_verification.py  # issue #2 — real /checkout/deposit, deposit gate
│   ├── test_webhook_security.py      # issue #3 — Stripe signature reject/accept matrix
│   ├── test_migration_rollback.py    # issue #6 — upgrade/downgrade roundtrip + restore
│   └── test_object_storage.py        # issue #7 — honest "no storage backend" tripwire
├── load/
│   ├── k6_tiered.js          # issue #5 — 250 / 500 / 1000 concurrent-user tiers
│   ├── k6_smoke.js
│   └── README.md
└── evidence/
    ├── MANIFEST.md           # the 10 RC1 artifacts + how to collect each
    ├── results/              # (generated) per-check logs
    └── evidence_index.json   # (generated) machine-readable artifact state
```

## Running it

Offline suite (no deployment needed) — produces real evidence and the label:

```bash
backend/verification/run_verification.sh
```

Against a running instance:

```bash
BASE_URL=https://api.nobleport.example backend/verification/verify_deployment.sh
```

Just the label (from the last run's evidence index):

```bash
python -m backend.verification.truth_label          # human-readable
python -m backend.verification.truth_label --json    # machine-readable (CI)
```

`truth_label` exits non-zero if any **gating** artifact has actively FAILED, so
it can gate CI/CD.

## The production gate

A release is only labelled **RC1 (Production Candidate)** when **every gating
artifact is COLLECTED and passing**. The gating set:

| Artifact | Proven by |
|----------|-----------|
| `build_typecheck` | backend import + frontend typecheck |
| `migration_roundtrip` | Alembic upgrade → downgrade → upgrade |
| `route_contract` | every advertised route registered on the ASGI app |
| `health_endpoint` | exact `status == "healthy"` (no substring drift) |
| `payment_verification` | real `/api/payments/checkout/deposit` + deposit gate |
| `webhook_security` | Stripe signature reject/accept matrix, fail-closed |
| `load_report` | k6 tiered 250/500/1000 within budget *(live)* |
| `stripe_sandbox` | Stripe test-mode payment + webhook capture *(live)* |

Non-gating: `object_storage` (no backend in this build — honesty tripwire),
`worker_logs` (operational, not correctness).

## How the label is computed

```
EVIDENCE LEVEL  = share of GATING artifacts COLLECTED+passing
STATUS          = RC1        if 100% gating proven and none failed
                = STAGED     if 0 < gating < 100%   (PARTIAL-EVIDENCE)
                = STAGED     if 0% gating proven     (PRE-PRODUCTION)
                = BLOCKED     if any gating artifact FAILED
```

`DESIGN MATURITY` percentages are scored by hand and describe the architecture
axis **only**. They can never move the STATUS — that is governed solely by
collected evidence.

## Backup-before-migration (production)

The migration test proves the rollback path and the backup/restore *invariant*
on SQLite. The production procedure against Postgres:

```bash
# 1. Back up BEFORE any migration
pg_dump "$NOBLEPORT_DATABASE_URL" -Fc -f backup-pre-$(date +%Y%m%dT%H%M%S).dump

# 2. Apply
alembic -c backend/alembic.ini upgrade head

# 3. On failure, roll back the schema...
alembic -c backend/alembic.ini downgrade -1
# 3b. ...or restore the snapshot if data is affected
pg_restore --clean --if-exists -d "$NOBLEPORT_DATABASE_URL" backup-pre-*.dump
```

`test_migration_rollback.py` proves step 3 (`downgrade`) actually reverses the
schema and that a restore returns the exact prior state — the guarantees the
runbook depends on.

## What "PENDING" honestly means

`load_report` and `stripe_sandbox` are gating but require a deployed environment
and Stripe test keys. They are **not** marked collected by this framework until
someone runs them for real and drops the artifacts in `evidence/results/`. Until
then the platform is **STAGED**, by design. That is the point.
