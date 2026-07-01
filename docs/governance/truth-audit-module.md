# Truth & Audit Module (TruthAuditor)

The TruthAuditor is the governance node that turns "we have a verification
framework" into "every avatar and briefing response is gated by it." It was
built on the machinery this repo already had — the evidence-gated
`truth_label`, the `truth_layer` tagging protocol, the `StephanieGate`, and the
`AuditBeacon` hash chain — rather than as a parallel surface that hand-asserts
scores.

## Core principle

A verdict is a mechanical function of **two independent axes**, and design
never upgrades the verdict:

| Axis | Source | What it means |
|------|--------|---------------|
| **Design maturity** | `truth_label.DESIGN_MATURITY` | Architecture completeness. **Not** proof it runs. |
| **Runtime evidence** | `truth_label.evaluate()` over the evidence index | Share of gating artifacts **proven** by collected artifacts. |

The single canonical Truth-Layer tag is derived, fail-closed:

- **BLOCKED** — a gating artifact actively FAILED verification. Withheld + escalated.
- **LIVE** — every gating artifact is COLLECTED + passing (100%).
- **STAGED** — partial or zero runtime evidence (design-only lands here, never LIVE).
- **SIMULATED** — an explicitly simulated/demo run that would otherwise be LIVE.

## Components

| Piece | File |
|-------|------|
| Verdict engine | `backend/verification/truth_auditor.py` |
| Mesh node | `backend/agents/truth_auditor.py` (`AgentFamily.TRUTH_AUDITOR`) |
| Pre-output filter | `backend/governance/pre_output_filter.py` |
| API | `backend/api/truth_auditor.py` → `/api/truth-audit/*` |
| Dashboard widget | `src/components/dashboard/TruthScoreCard.tsx` |
| Tests | `backend/verification/tests/test_truth_auditor.py` |

### 1. Wire — the verdict + node

```bash
python -m backend.verification.truth_auditor --target "Irwin Residence Dashboard"
```

Every number comes from the evidence index. The verdict carries a **real
SHA-256 integrity digest** over its canonical bytes, chained to a prior digest
(AuditBeacon-style). Ed25519 signing is a no-op until a key is provisioned and
is reported honestly as `unsigned` — it is never faked.

### 2. Run — current honest state

Against the collected offline evidence (`run_verification.sh`):

```
TRUTH-LAYER TAG:  STAGED
CLASSIFICATION:   PARTIAL-EVIDENCE
EVIDENCE LEVEL:   PARTIAL  (75%)
GATING PROVEN:    6/8
DESIGN MATURITY:  89%  (architecture axis only)
```

The two live-only gating artifacts (`load_report`, `stripe_sandbox`) remain
PENDING until collected against a real deployment — they are not fabricated.

### 3. Pre-output filter

Every avatar/briefing output is routed through `filter_output(text, tag)`:

- Untagged output is **rejected** (fail-closed) — never defaulted to LIVE.
- **BLOCKED** withholds the output and escalates to Michael.
- **STAGED / BLOCKED** attach the standard oversight notice.
- Text that reads as a claim over a registered credential (PE stamp,
  securities recommendation, legal opinion, appraisal) gets the specific
  "licensed reviewer required" caveat from the Credential Register.

```
POST /api/truth-audit/filter
{ "text": "...", "target": "Irwin Residence Dashboard", "auto_tag": true }
```

### 4. Dashboard widget

`TruthScoreCard` renders the verdict on the Compliance & Governance dashboard.
It keeps the two axes visually separate, shows the artifact ledger, the real
integrity digest, and the honest "unsigned" Ed25519 state. It **renders** a
verdict; it never computes or asserts one.

## Relationship to the original "Truth & Audit Module" brief

The intake brief asserted a completed audit run with fabricated scores
(92% / 18% / 0% …), fabricated SHA-256/Ed25519 evidence chains, and a
"15% production readiness" label — none of which corresponded to collected
evidence. This module is the honest realization: the scores are computed, the
digest is real, the signature is honestly absent, and a partial build labels
itself STAGED rather than inventing a number. That is exactly the failure mode
the framework exists to catch — applied, here, to itself.
