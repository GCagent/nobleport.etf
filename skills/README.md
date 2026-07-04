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

## First five to deploy

If standing NoblePort up from scratch, deploy these first — together they cover
~80% of daily operational workload: **Estimator · Project Manager · Building
Code · Structural Review · Stephanie Executive.**

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
