# NoblePort App Audit Framework

A **per-app truth scorecard** for every NoblePort surface. Where the
[Verification Framework](./verification-framework.md) answers *"is the whole
backend a production candidate?"*, this answers the governance question the
audit raised:

> As NoblePort grows, credibility is one of its biggest assets. Every time a
> dashboard overstates what is live, it creates risk with customers, partners,
> investors, and municipalities.

So for every app we show externally, the framework produces an **objective truth
score** instead of marketing language.

Implemented in
[`backend/verification/app_audit.py`](../../backend/verification/app_audit.py),
gated by [`tests/test_app_audit.py`](../../backend/verification/tests/test_app_audit.py).

## The one rule (again)

This framework inherits the package's single discipline:

> **Build maturity and runtime evidence are different axes and are never
> conflated.** A 95%-built UI proves nothing about what is *live*.

Each app reports two independent things:

| Axis | What it is | Can it move the evidence label? |
|------|-----------|---------------------------------|
| **Six dimension scores** (0–100%) | How much is *built* | **No** |
| **Evidence Level** | How much is *verified* | This **is** the label |

## Evidence categories (the gate)

| Badge | Level | Standard |
|-------|-------|----------|
| 🟢 | **Verified Live** | Confirmed by on-chain data, APIs, production databases, or real customer activity. |
| 🟡 | **Staging** | Built and functional in a test environment; not yet production-verified. |
| 🔵 | **Prototype** | UI or workflow demonstration with placeholder or simulated data. |
| 🔴 | **Planned** | Architecture or roadmap only; not yet implemented. |

These map onto the four statuses already enforced per-feature by
[`operational_truth.py`](../../backend/config/operational_truth.py):
`LIVE → Verified Live`, `STAGED → Staging`, `MODELED → Prototype`,
`INTERNAL_R&D → Planned`.

## The six scored dimensions

For each app, scored 0–100% as **build maturity** (conservative, hand-set):

- Frontend / UI
- Backend / API
- Database
- AI Integration
- Security
- Production Readiness

Plus the **Evidence Level** above. The mean of the six is reported as a
build-maturity average — a *design* number that, by construction, can never
change the evidence label.

## The honesty gate — mechanically enforced

The load-bearing guarantee, checked by `check_consistency()` and gated in CI by
the test suite (and the CLI exit code):

1. **An app may be labelled 🟢 Verified Live only if it is backed by ≥1
   capability that `operational_truth.py` independently classifies LIVE.** No
   dimension score — not even a flawless 100% frontend — can buy a Verified Live
   label. (This is the per-app twin of the truth_label rule that "design
   maturity can never move STATUS.")
2. Every named backing feature must actually *exist* in `operational_truth` and
   actually be *LIVE* there. Naming a STAGED feature as LIVE backing is a
   violation.
3. An evidence level may not exceed the ceiling its operational-truth features
   earn at the top of the scale. (A built UI legitimately earns 🔵 Prototype even
   over a 🔴 Planned backend — that is what "UI/workflow demo with simulated
   data" *means* — so only Verified Live / Staging are gated here.)
4. Scores stay in 0–100, and **Production Readiness for any non-Verified-Live app
   stays ≤ 60** — "built" is not "production-proven."

`test_high_scores_cannot_buy_verified_live` proves rule 1 directly: an app with
100% across every dimension but no LIVE backing is rejected as dishonest, and the
CLI exits non-zero.

## Running it

```bash
python -m backend.verification.app_audit            # full scorecard
python -m backend.verification.app_audit --json     # machine-readable (CI)
python -m backend.verification.app_audit --app "Stephanie.ai"
```

The CLI **exits non-zero if any app overstates its evidence level**, so it can
gate CI just like `truth_label`.

```
==========================================================================
  NOBLEPORT APP AUDIT — TRUTH SCORECARD
==========================================================================

  Evidence Level is the GATE (🟢 Verified Live · 🟡 Staging · 🔵 Prototype · 🔴 Planned).
  Dimension scores are build maturity only — they never promote the label.
  ...
  TOTALS:  🟢 3   🟡 2   🔵 4   🔴 1   (of 10 apps)
  HONESTY CHECK:  PASS — no app overstates its evidence level.
==========================================================================
```

## Current scorecard

| App | Evidence | FE | BE | DB | AI | Sec | Prod | Backed by LIVE |
|-----|----------|----|----|----|----|-----|------|----------------|
| Stephanie.ai | 🟢 Verified Live | 90 | 85 | 80 | 88 | 78 | 80 | voice_intake, lead_pipeline, estimate_generation |
| GCagent.ai | 🟢 Verified Live | 75 | 82 | 80 | 80 | 76 | 72 | crew_task_routing |
| Mission Control | 🟢 Verified Live | 95 | 80 | 78 | 60 | 75 | 80 | dashboard_kpis |
| NoblePort Payment Node | 🟡 Staging | 80 | 85 | 82 | 40 | 88 | 60 | — (human-gated) |
| PermitStream.ai | 🟡 Staging | 78 | 75 | 76 | 65 | 70 | 55 | — |
| Cyborg.ai Compliance Engine | 🔵 Prototype | 55 | 60 | 55 | 70 | 80 | 35 | — |
| Agent Mesh Orchestrator | 🔵 Prototype | 50 | 65 | 55 | 75 | 65 | 35 | — |
| NobleNest | 🔵 Prototype | 70 | 45 | 50 | 50 | 55 | 35 | — |
| Web3 / Tokenization Dashboard | 🔵 Prototype | 95 | 25 | 30 | 30 | 50 | 40 | — (0% chain verified) |
| ERC-1400 Tokenization & SSI Identity | 🔴 Planned | 20 | 30 | 20 | 10 | 60 | 15 | — |

> Scores are conservative build-maturity estimates and are meant to be revised as
> evidence is collected. The **evidence levels** are the disciplined part: they
> cannot drift above what `operational_truth` independently verifies.

### The Web3 dashboard example

The audit gave the Web3 dashboard a specific scoring — *UI ~95%, backend
evidence ~25%, live blockchain verification 0%, production readiness ~40%,
overall Prototype with simulated/unverified metrics*. The framework reproduces
that anchor exactly (`test_web3_dashboard_matches_audit_example`): a polished 95%
UI **does not** move it off 🔵 Prototype, because no on-chain read or write is
confirmed and no `operational_truth` capability behind it is LIVE.

## How an app earns a higher evidence level

Identical to the platform RC1 path: collect real evidence, don't assert it.

- **🔵 → 🟡 (Prototype → Staging):** replace simulated inputs with a real
  test-environment integration; the capability becomes `STAGED` in
  `operational_truth`.
- **🟡 → 🟢 (Staging → Verified Live):** prove it in production — the capability
  is reclassified `LIVE` in `operational_truth` (backed by the production
  evidence the [verification framework](./verification-framework.md) requires),
  and the app then names it under `backing_live_features`. Only then does the
  honesty gate permit the 🟢 label.
