# NoblePort Workspace Skill Library

A tiered library of **Agent Skills** for NoblePort Construction. Each skill is a
self-contained folder with a `SKILL.md` (Replit / Claude Agent Skill format:
YAML frontmatter + operating instructions). Skills are model-invokable: the
`description` field tells the assistant *when* to reach for the skill, and the
body tells it *how* to operate.

These skills are the human/assistant-facing operating procedures that sit on top
of the NoblePort OS backend (the FastAPI agent mesh under `backend/`) and the
nano-ecosystem platform core (`nobleport-systems/` in `GCagent/nobleport-ecosystem`).
Where a skill has a live system counterpart, it names the real endpoint, model,
and mesh agent so the skill drives the actual platform rather than improvising.

## Governance posture (applies to every skill)

NoblePort OS is **advisory by default; a human authorizes.** Every skill inherits
the same Truth-Layer discipline used across the codebase
(`backend/learning/knowledge_domains.py`, `contracts/HumanApprovalGateway.sol`):

- **No fabricated authority.** Skills draft and recommend; they do not assert
  credentials. Code, structural, and financial outputs are drafts requiring the
  named licensed reviewer (CSL/HIC contractor, PE, financial/legal) before they
  bind anything.
- **Human approval gates** on money movement, permit submission, contract
  execution, **acquisition**, and **construction-loan draws** — never bypassed
  by a skill. Stephanie does not authorize acquisition.
- **No invented facts.** Where a field, code value, or engineering figure is
  unknown, the skill surfaces it as a gap to verify — it does not guess.
- **Nothing is labeled “permitted”** until source evidence supports it.
- Hypothetical nano-chain runs are **STAGED — DUE DILIGENCE REQUIRED**, not live
  parcel/zoning determinations.

## Tiers

### Tier 1 — Core Construction Skills (highest ROI)
| # | Skill | Purpose | System counterpart |
|---|-------|---------|--------------------|
| 01 | [Estimator](01-estimator/SKILL.md) | Estimates, proposals, payment schedules | `/api/estimates`, `/api/change-orders` |
| 02 | [PermitStream](02-permitstream/SKILL.md) | Permit intelligence & lead scoring | `PermitStreamAgent`, `/api/projects` |
| 03 | [Project Manager](03-project-manager/SKILL.md) | Job execution, logs, scheduling | `GCAgent`, `/api/jobs`, `/api/schedules` |
| 04 | [Building Code](04-building-code/SKILL.md) | Code interpretation (IRC/IBC/780 CMR) | knowledge skill |
| 05 | [Structural Review](05-structural-review/SKILL.md) | Structural takeoffs & framing schedules | knowledge skill (PE-gated) |

### Tier 2 — NoblePort Operations
| # | Skill | Purpose | System counterpart |
|---|-------|---------|--------------------|
| 06 | [Stephanie Executive](06-stephanie-executive/SKILL.md) | Executive orchestration & briefing | `StephanieAgent`, `/api/ops-brief` |
| 07 | [Sales Router](07-sales-router/SKILL.md) | Lead management & conversion | `/api/leads`, `route_intake` |
| 08 | [Trust Pipeline](08-trust-pipeline/SKILL.md) | Customer relationship management | `/api/trust` |
| 09 | [Change Orders](09-change-orders/SKILL.md) | Scope control & audit trail | `/api/change-orders` |
| 10 | [Payment Node](10-payment-node/SKILL.md) | Financial controls (HIC-compliant) | `/api/payments` (human-gated) |

### Tier 3 — Growth Engine
| # | Skill | Purpose | System counterpart |
|---|-------|---------|--------------------|
| 11 | [Content Engine](11-content-engine/SKILL.md) | Projects → marketing assets | `JourneyAgent`, `/api/journey` |
| 12 | [Real Estate Development](12-real-estate-development/SKILL.md) | Feasibility & development analysis | `/api/projects`, realty lib |
| 13 | [NobleNest](13-noblenest/SKILL.md) | Homeowner platform | maintenance / customer layer |
| 14 | [Recruiting](14-recruiting/SKILL.md) | Hiring & subcontractor onboarding | recruiting channel |
| 15 | [SOP](15-sop/SKILL.md) | Standard operating procedures | cross-cutting |

### Tier 4 — Nano Ecosystem Chain (infill / ADU evidence graph)
The chain turns one project into a reusable evidence graph instead of PDFs,
emails, spreadsheets, and people’s heads. All `nano.*` modules are **STAGED**.
Worked demonstration (hypothetical Amesbury/Newburyport 6-unit + 2 ADU):
[EXAMPLE-amesbury-newburyport-infill.md](nano-ecosystem/EXAMPLE-amesbury-newburyport-infill.md).

| # | Skill | Purpose | System counterpart |
|---|-------|---------|--------------------|
| 16 | [Nano Ecosystem Chain](16-nano-ecosystem-chain/SKILL.md) | End-to-end orchestrator + evidence graph | `nano_infill_chain`, `nano.orchestrator` |
| 17 | [Hyperlocal Site Selector](17-hyperlocal-site-selector/SKILL.md) | Parcel acquisition screen (SITE-NNN) | `nano.site_selector` |
| 18 | [Nano-Feasibility](18-nano-feasibility/SKILL.md) | Cost/value model; no acquisition auth | `nano.feasibility` |
| 19 | [Entitlement Navigator](19-entitlement-navigator/SKILL.md) | Verification matrix; never “permitted” without evidence | `nano.entitlement` |
| 20 | [Generative Design](20-generative-design/SKILL.md) | Three concepts (yield / cost / fit) | `nano.generative_design` |
| 21 | [Construction Sequence](21-construction-sequence/SKILL.md) | Preconstruction → CO critical path | `nano.sequence_optimizer` |
| 22 | [Loan Draw Manager](22-loan-draw-manager/SKILL.md) | Evidence-backed draws (HIGH human gate) | `nano.draw_manager` |
| 23 | [Risk Stress Tester](23-risk-stress-tester/SKILL.md) | Cost / delay / rate / absorption / permitting | `nano.stress_tester` |
| 24 | [Property Management Copilot](24-property-management-copilot/SKILL.md) | Post-closeout ops on the same graph | `nano.property_ops` |
| 25 | [Five-Harness](25-five-harness/SKILL.md) | Execution · Governance · Security · Evidence · Testing | `nano.five_harness` |

Chain order: **17 → 18 → 19 → 20 → 21 → (22 ∥ 23) → 24 → 16/25**.

## First five to deploy

If standing NoblePort up from scratch, deploy these first — together they cover
~80% of daily operational workload: **Estimator · Project Manager · Building
Code · Structural Review · Stephanie Executive.**

The nano chain (Tier 4) is the development operating layer; deploy it when an
infill/ADU parcel is in diligence, not as a substitute for Tier 1.

## Skill contract

Every `SKILL.md` follows the same shape:

```
---
name: <slug>
description: <when to use — third person, trigger-oriented>
---
# <Skill name>
## Purpose · When to use · When NOT to use
## Inputs · Workflow · Outputs
## System integration   (real endpoints / models / agents)
## Guardrails           (compliance + human-approval gates)
## Success criteria
```
