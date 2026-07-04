# Stephanie.ai Architecture v2 — Built Out, With Real Metrics

**Source spec:** Stephanie.ai Architecture Definition v2.0 (NoblePort Systems LLC,
2026-06-06). **Status:** STAGED / Human-Approved Execution.
**Final decision authority:** Michael F. O'Rourke.

This turns the v2 architecture document from a PDF into an **executable,
measured** governance layer. The numbers on this page are *computed by code from
actual processed actions* — not the "5,000-transaction simulation" style
narrative figures flagged earlier in the smart-contract registry. Feed the gate
production traffic and you get production metrics; feed it the scenario suite and
you get a reproducible baseline. Either way the figures are measured.

---

## What was built

| Spec section | Code | What it does |
|--------------|------|--------------|
| 04 — Truth-Layer Tagging | `backend/governance/truth_layer.py` | `LIVE / STAGED / SIMULATED / BLOCKED` enum, definitions, and `assert_tagged` (fails closed on missing/unknown tags) |
| 01/02/03/05 — Matrix, Lanes, Credentials | `backend/governance/authority_matrix.py` | The Authority Matrix (11 rows, verbatim), 12 NoblePort lanes, 7-entry credential register, and the escalation triggers (>$5,000, external stakeholder, architectural change, regulated action) |
| 05 — Escalation & Control Hierarchy | `backend/governance/stephanie_gate.py` | The 5-step decision gate (Detect → Classify → Authority → Execute/Escalate → Log), fail-closed, with a SHA-256 hash-chained audit ledger |
| Metrics | `backend/governance/metrics.py` | Aggregates real gate decisions into measured governance metrics |
| Reproducible baseline | `backend/governance/scenarios.py` | A coverage suite exercising every matrix row + trigger + fail-closed path |
| API | `backend/api/governance.py` | `/api/governance/{authority-matrix,credentials,classify,metrics}` |
| Tests | `backend/tests/test_governance.py` | 11 tests asserting the spec's hard guarantees |

---

## The hard guarantees (enforced, not described)

1. **Fail-closed.** An action type not in the Authority Matrix defaults to
   `BLOCKED` and escalates — never to `LIVE`. (`test_unknown_action_fails_closed`)
2. **Escalation triggers demote autonomy.** A normally-`LIVE` action carrying a
   >$5,000 amount, an external-stakeholder flag, or an architectural-change flag
   is held as `STAGED` for human approval. (`test_budget_trigger_demotes_live_to_staged`)
3. **Execution-restricted lanes** (NoblePort Capital, KUZO/Trading) block `LIVE`
   actions outright. (`test_execution_restricted_lane_blocks_live_action`)
4. **Regulated actions are blocked** — payment approval, legal opinions,
   securities trading, engineering certification all escalate to a licensed human.
5. **No credential claims.** All 7 credential-register entries are
   `can_claim = False`. (`test_credential_register_claims_nothing`)
6. **Tamper-evident audit.** Every decision is hash-chained; mutating any record
   breaks `verify_chain()`. (`test_audit_chain_is_tamper_evident`)

---

## Real metrics (reproducible baseline)

Run it yourself:

```bash
python -m backend.governance --json metrics.json
```

Measured output over the scenario suite (17 actions covering all 11 matrix rows,
3 escalation-trigger cases, 2 fail-closed cases, 1 lane-restriction case):

| Metric | Value | Meaning |
|--------|-------|---------|
| Actions processed | **17** | size of the reproducible coverage suite |
| LIVE / executed | **4** | autonomously executable, low-risk actions |
| STAGED (human-held) | **6** | drafts awaiting human sign-off |
| BLOCKED | **7** | escalated to Michael / licensed reviewer |
| Autonomous execution rate | **23.5%** | the minority — humans hold regulated authority |
| Human-in-the-loop rate | **76.5%** | share requiring human approval |
| Escalation rate | **64.7%** | share escalated by matrix or trigger |
| Fail-closed rate | **17.6%** | share defaulted to BLOCKED |
| Audit coverage | **100%** | every decision logged with a chain hash |
| Audit chain intact | **true** | hash chain verifies |

These are not targets or claims — they are what the gate actually did with the
suite, and they move automatically as the matrix or scenarios change.

> **Honest framing:** the baseline is a *coverage* suite, not production volume.
> It proves correct behavior across the documented surface and gives a stable
> number to track. Real-world metrics come from routing real actions through the
> same `StephanieGate` (e.g. via `POST /api/governance/classify`), at which point
> the same code reports genuine operational figures.

---

## How it maps to the rest of NoblePort

- The gate's fail-closed posture mirrors `backend/config/command_freeze.py` and
  the on-chain `HumanApprovalGateway.sol` — AI drafts/routes/flags; humans decide
  regulated, financial, legal, engineering, and licensing actions.
- `SIMULATED` here is the action-level analogue of the feature-level
  `MODELED / INTERNAL_R&D` states in `backend/config/operational_truth.py`.
- The audit ledger is the in-engine counterpart to the `AuditBeacon` agent's
  proof-of-trust chain; production should route gate decisions into AuditBeacon.

Stephanie.ai does not hold or claim professional licensure. All regulated
decisions require human review per applicable law.
