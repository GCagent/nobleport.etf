# NoblePort Construction Compliance OS

> Enforceable construction operations, not theory.
> A compliance OS — not a feature list. Stephanie.ai operates as
> **advisor and documenter**, never as authorizer.

## Table of contents

- [Positioning](#positioning)
- [Core layers](#core-layers)
  - [Layer 1 — Jobsite safety + human override (hard rule layer)](#layer-1--jobsite-safety--human-override-hard-rule-layer)
  - [Layer 2 — PermitStream compliance checklist (workflow)](#layer-2--permitstream-compliance-checklist-workflow)
  - [Layer 3 — Contract / vendor clauses (liability backstop)](#layer-3--contract--vendor-clauses-liability-backstop)
  - [Layer 4 — Project audit trail (forensic backbone)](#layer-4--project-audit-trail-forensic-backbone)
  - [Layer 5 — What we don't lead with (de-risk)](#layer-5--what-we-dont-lead-with-de-risk)
- [Immediate product — AI Site Compliance Checklist](#immediate-product--ai-site-compliance-checklist)
- [Why this wins](#why-this-wins)
- [Next steps to build](#next-steps-to-build)
- [Open asks](#open-asks)

---

## Positioning

NoblePort sells **compliance as a service with an AI assistant**, not an AI
oracle. The product is defensible, insurable, and court-ready because every
recommendation is logged, every decision has a human signature, and every
vendor signs a liability rider.

Stephanie.ai's role is fixed across all layers:

- **Advises** — pulls citations, flags gaps, summarizes prior outcomes.
- **Documents** — writes the immutable record of what was recommended,
  decided, and signed.
- **Never authorizes** — no execution, no certification, no submission.

---

## Core layers

### Layer 1 — Jobsite safety + human override (hard rule layer)

**The constitution.** Non-negotiable. Encoded directly in Stephanie's
operating prompt and enforced by the runtime.

- No AI-controlled equipment movement, task assignment, site access, or
  schedule change without a human stop authority always present.
- Human override is **physical** (button) or **logged verbal command** with
  latency **< 2 seconds**.

#### Implementation rules

| # | Rule |
|---|------|
| 1 | AI may **suggest** crane swing paths; human signals **execute**. |
| 2 | AI may **flag** unsafe worker proximity; human **decides** stop or continue. |
| 3 | AI may **optimize** daily task sequencing; site super **approves** the final board. |
| 4 | Every AI safety alert generates a timestamped override log (who stopped what, why). |
| 5 | Weekly override review meeting; all stops analyzed for false positives / false negatives. |

#### Stephanie.ai role

Documents override events, flags repeat patterns, suggests retraining.
Never overrides on its own.

---

### Layer 2 — PermitStream compliance checklist (workflow)

Turn rules into a **pre-submittal permit review engine** — not an authorizer.

| Step | AI action | Human action |
|------|-----------|--------------|
| Code citation | Pulls relevant IBC / OSHA / local clauses | Verifies correct edition and jurisdiction |
| Assumptions scan | Flags missing data (soil report, wind load, egress) | Adds or rejects assumptions |
| Missing docs | Lists incomplete submittals | Signs off before permit submission |
| AHJ disclaimer | Attaches boilerplate: *"AI-generated review — authority having jurisdiction must validate"* | Includes in final packet |

#### Stephanie.ai role

Compares current plans to prior approved permits (same AHJ), flags common
rejection reasons. Cannot submit or certify.

---

### Layer 3 — Contract / vendor clauses (liability backstop)

Every AI vendor serving NoblePort signs **Appendix C — AI Compliance Rider**.

#### Mandatory clauses

1. **Liability** — vendor liable for direct damages from AI errors in
   safety, estimates, or code interpretation.
2. **Model limits disclosure** — written list of what the AI **cannot** do
   (e.g., "does not understand local amendments to fire code").
3. **Audit logs** — 24/7 read-only access to all AI recommendations
   affecting scope, price, schedule, safety, permits, or structure.
4. **No AI escape hatch** — explicit waiver of the *"AI made the decision"*
   defense in any dispute.
5. **Recall rights** — NoblePort can force a model rollback if compliance
   failures exceed an agreed threshold.

#### Stephanie.ai role

Tracks vendor compliance status, flags expiring certificates, generates
quarterly vendor audit reports.

---

### Layer 4 — Project audit trail (forensic backbone)

Log every AI recommendation that touches:

- **Scope** — material takeoff changes, spec deviations
- **Price** — estimate adjustments, change order triggers
- **Schedule** — critical path shifts, weather rescheduling
- **Safety** — override events, near-miss predictions
- **Permits** — code citations, missing doc flags
- **Structural** — load calc suggestions, beam/column changes

#### Log format (immutable; blockchain recommended)

```
[Timestamp] [Project ID] [AI Model Version] [Recommendation]
[Human Action: Accepted | Modified | Rejected] [Sign-off Initials]
```

#### Stephanie.ai role

Maintains the searchable log, generates weekly compliance summaries,
alerts when unreviewed AI recommendations accumulate.

---

### Layer 5 — What we don't lead with (de-risk)

Excluded from Phase 1 — outside counsel must review before any of these
ship:

- Tenant screening
- Mortgage or rental pricing
- Lending decisions
- Fair-housing analytics
- Worker productivity scoring

These belong to Phase 2.

---

## Immediate product — AI Site Compliance Checklist

A daily PDF + dashboard for site superintendents and PMs. Stephanie.ai
assists; humans certify.

### 1. Daily site safety review

- Any AI equipment control active today? *(list devices)*
- Human stop authority physically verified? *(initial)*
- Override log reviewed from previous day? *(count stops)*
- No AI task assignment without super approval? *(sign)*

### 2. Permit / document gap scan

- AI scan run against latest approved permits?
- Missing documents flagged? *(# flags)*
- Code citations verified by PM?
- AHJ disclaimer attached to all AI-generated permit notes?

### 3. AWO / scope-change risk flag

- Any AI recommendation that changes material quantity > 5%?
- Any AI schedule shift affecting critical path?
- Human decision recorded for each *(accept / modify / reject)*?

### 4. Engineer-required decision flag

- AI suggested a structural load change? → Engineer stamped?
- AI flagged a foundation condition? → Geotech review?
- AI optimized rebar spacing? → SE approval on file?

### 5. Human sign-off log (final page)

- Site superintendent signature
- Project manager signature
- Safety officer signature *(if safety flags present)*
- Date / time

### 6. PDF closeout packet

- Auto-generated weekly, attached to project record.
- Retained for **10 years** (or statute of limitations + 2).

---

## Why this wins

| Competitor approach | NoblePort OS |
|---|---|
| Theory | Enforceable logs + human sign-off |
| AI as black box | Stephanie as advisor, never authorizer |
| No vendor liability | Contract clauses + audit rights |
| Permits as afterthought | Pre-submittal compliance workflow |
| Broad "AI compliance" | Construction-specific hard rules |

---

## Next steps to build

1. **Hardcode Layer 1** — stop-authority protocol into Stephanie's
   constitution *(already aligned)*.
2. **Build PermitStream checklist** — web form + AI backend, 30-day sprint.
3. **Draft Appendix C** — use the four mandatory clauses above, route to
   counsel for review.
4. **Launch the daily checklist** at 3 pilot sites; capture override logs
   from day one.
5. **Closeout-packet generator** — PDF with all signatures plus the AI
   audit trail.

---

## Open asks

Pick one to draft next:

- Exact language for **Appendix C** (vendor AI liability clause).
- The **daily checklist** as a fillable PDF template.
