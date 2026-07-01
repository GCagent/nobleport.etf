# NoblePort Workspace Skill Library

A tiered library of **Agent Skills** for NoblePort Construction. Each skill is a
self-contained folder with a `SKILL.md` (Replit / Claude Agent Skill format:
YAML frontmatter + operating instructions). Skills are model-invokable: the
`description` field tells the assistant *when* to reach for the skill, and the
body tells it *how* to operate.

These skills are the human/assistant-facing operating procedures that sit on top
of the NoblePort OS backend (the FastAPI agent mesh under `backend/`). Where a
skill has a live system counterpart, it names the real endpoint, model, and mesh
agent so the skill drives the actual platform rather than improvising.

## Governance posture (applies to every skill)

NoblePort OS is **advisory by default; a human authorizes.** Every skill inherits
the same Truth-Layer discipline used across the codebase
(`backend/learning/knowledge_domains.py`, `contracts/HumanApprovalGateway.sol`):

- **No fabricated authority.** Skills draft and recommend; they do not assert
  credentials. Code, structural, and financial outputs are drafts requiring the
  named licensed reviewer (CSL/HIC contractor, PE, financial/legal) before they
  bind anything.
- **Human approval gates** on money movement, permit submission, and contract
  execution — never bypassed by a skill.
- **No invented facts.** Where a field, code value, or engineering figure is
  unknown, the skill surfaces it as a gap to verify — it does not guess.

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
| 06 | [Executive Support](06-executive-support/SKILL.md) | Executive orchestration & briefing | `StephanieAgent`, `/api/ops-brief` |
| 07 | [Sales Router](07-sales-router/SKILL.md) | Lead management & conversion | `/api/leads`, `route_intake` |
| 08 | [Trust Pipeline](08-trust-pipeline/SKILL.md) | Customer relationship management | `/api/trust` |
| 09 | [Change Orders](09-change-orders/SKILL.md) | Scope control & audit trail | `/api/change-orders` |
| 10 | [Payment Node](10-payment-node/SKILL.md) | Financial controls (HIC-compliant) | `/api/payments` (human-gated) |

> `06-executive-support` was formerly `06-stephanie-executive` (named by function,
> not by the agent that powers it). The old path remains as a redirect stub.

### Tier 3 — Growth Engine
Tier-3 skills with maturing sub-domains are split into sub-skills; the top-level
`SKILL.md` is an index that routes to them.

| # | Skill | Purpose | System counterpart |
|---|-------|---------|--------------------|
| 11 | [Content Engine](11-content-engine/SKILL.md) *(index)* | Projects → marketing assets | `JourneyAgent`, `/api/journey` |
| 11a | [· Blog & Case Studies](11-content-engine/blog/SKILL.md) | Long-form written proof | Journey `blog_post`/`case_study` |
| 11b | [· Video & Reels](11-content-engine/video/SKILL.md) | Short-form video scripts | Journey `instagram_reel` |
| 11c | [· SEO](11-content-engine/seo/SKILL.md) | Owned-channel & local SEO | Journey `portfolio_entry`/GBP |
| 12 | [Real Estate Development](12-real-estate-development/SKILL.md) *(index)* | Feasibility & development | `/api/projects`, realty lib |
| 12a | [· Acquisition](12-real-estate-development/acquisition/SKILL.md) | Sourcing & valuation | realty lib |
| 12b | [· Financing](12-real-estate-development/financing/SKILL.md) | Pro forma & returns | knowledge (finance-gated) |
| 12c | [· Entitlement](12-real-estate-development/entitlement/SKILL.md) | Zoning, ADU, permit path | `PermitStreamAgent` |
| 13 | [NobleNest](13-noblenest/SKILL.md) | Homeowner platform | maintenance / customer layer |
| 14 | [Recruiting](14-recruiting/SKILL.md) | Hiring & subcontractor onboarding | recruiting channel |
| 15 | [SOP Authoring](15-sop/SKILL.md) | Author SOPs (the SOPs live in [`/docs/sops/`](../docs/sops/)) | cross-cutting |

> **Skills vs. SOPs.** Skills define *competencies*; the SOPs that apply them live
> in [`/docs/sops/`](../docs/sops/), not in `/skills/`. `15-sop` is the competency
> for *authoring* SOPs.

## First five to deploy

If standing NoblePort up from scratch, deploy these first — together they cover
~80% of daily operational workload: **Estimator · Project Manager · Building
Code · Structural Review · Executive Support.**

## Directory structure

```
skills/
├── README.md                     ← this index
├── 01-estimator/SKILL.md
├── 02-permitstream/SKILL.md
├── 03-project-manager/SKILL.md
├── 04-building-code/SKILL.md
├── 05-structural-review/SKILL.md
├── 06-executive-support/SKILL.md ← renamed (was 06-stephanie-executive)
├── 06-stephanie-executive/SKILL.md ← redirect stub (backward compat)
├── 07-sales-router/SKILL.md
├── 08-trust-pipeline/SKILL.md
├── 09-change-orders/SKILL.md
├── 10-payment-node/SKILL.md
├── 11-content-engine/            ← index + sub-skills
│   ├── SKILL.md
│   ├── blog/SKILL.md
│   ├── video/SKILL.md
│   └── seo/SKILL.md
├── 12-real-estate-development/   ← index + sub-skills
│   ├── SKILL.md
│   ├── acquisition/SKILL.md
│   ├── financing/SKILL.md
│   └── entitlement/SKILL.md
├── 13-noblenest/SKILL.md
├── 14-recruiting/SKILL.md
└── 15-sop/SKILL.md               ← SOP *authoring* competency

docs/sops/                        ← the SOPs themselves (applied skills)
├── pmp-schedule-review.md
├── change-order-approval.md
└── vendor-payment-flow.md
```

## Skill contract

Every `SKILL.md` follows the same shape:

```
---
name: <slug>
description: <when to use — third person, trigger-oriented>
---
# <Skill name>
> Tier · Owner role · Powered by (real system) · Last reviewed   (metadata header)
## Purpose · When to use · When NOT to use
## Inputs · Workflow · Outputs
## System integration   (real endpoints / models / agents)
## Related Skills        (Input ← / Output → / Dependency ⋈ handoffs)
## Guardrails           (compliance + human-approval gates)
## Success criteria
```

## 🔑 Skill Update Protocol

1. Edit a skill only in its tier-appropriate folder (a Tier 1 skill never lives
   under Tier 3).
2. Keep the **Related Skills** handoffs current when a hand-off changes.
3. SOPs go in [`/docs/sops/`](../docs/sops/) — never in `/skills/`.
4. Ownership metadata uses **roles**, not fabricated individuals; assign a real
   named owner when known. Governance-critical skills name the final authority.
5. A PR touching skills should confirm:
   - [ ] Correct tier/folder
   - [ ] `Related Skills` section present and accurate
   - [ ] SOP content (if any) placed under `/docs/sops/`
   - [ ] No fabricated owners, emails, dates, or code/engineering values
