---
name: entitlement-navigator
description: Use for NoblePort entitlement verification on infill/ADU projects — building a matrix of dimensional requirements, density, parking, ADU eligibility, utilities, fire access, stormwater, conservation/flood issues, and required municipal approvals. Use after feasibility and before design is treated as buildable. Nothing is labeled permitted until source evidence supports it.
---

# Entitlement Navigator Skill

## Purpose
Produce a verification matrix for the entitlement path. Advisory only.
The AHJ decides. This skill maps what must be true, what is evidenced,
and what is still VERIFY.

## When to use
- A SITE-NNN that survived feasibility needs an entitlement path.
- ADU eligibility, density, parking, or dimensional fit is in question.
- A design concept must not outrun what the municipality will accept.

## When NOT to use
- Submitting a permit package (human-gated; **02-permitstream**).
- Interpreting a construction detail against 780 CMR → **04-building-code**.
- Declaring the project "permitted" or "by-right" without citations.

## Inputs
- SITE-NNN, municipality/AHJ, program (units, ADUs), lot geometry.
- Zoning bylaw / ordinance, overlay maps, ADU statute, flood/conservation
  layers — or explicit VERIFY gaps if sources are not in hand.

## Workflow
1. **Open the matrix** — one row per surface:
   - Dimensional requirements (setbacks, height, coverage, frontage)
   - Density / unit count
   - Parking
   - ADU eligibility (state law + local adoption/amendment)
   - Utilities (especially sewer/septic capacity)
   - Fire access
   - Stormwater
   - Conservation / flood
   - Required municipal approvals (building, zoning, conservation, planning,
     Board of Health, historic, etc.)
2. **Score each row** EVIDENCED / UNVERIFIED / CONFLICT. Cite the source
   or mark VERIFY against the current adopting authority.
3. **Refuse the word "permitted"** until a cited approval or a cited
   by-right path with current source evidence exists.
4. **List the municipal package** the AHJ will expect.
5. **Hand off** surviving assumptions to **20-generative-design**.

## Outputs
- Entitlement verification matrix (surface → status → source/gap)
- Required-approvals list
- Open VERIFY items that block treating the scheme as entitled

## System integration
- Module: `nano.entitlement` (STAGED, MEDIUM) — `PermitStreamAgent`.
- Related: **02-permitstream**, **04-building-code**, `permits.checklist`,
  `compliance.regulation_matcher`, `realestate.due_diligence`.
- Workflow `nano_infill_chain` between feasibility and design.

## Guardrails
- **Nothing gets labeled "permitted" until source evidence supports it.**
- Do not fabricate dimensional values, density caps, parking ratios, or
  ADU rules from memory — mark VERIFY against the current bylaw/AHJ.
- Output is a verification matrix, not an AHJ determination.

## Success criteria
- Every matrix row has a status and either a citation or a VERIFY gap.
- The word "permitted" does not appear without a cited source.
- Design is not allowed to assume away an UNVERIFIED row.
