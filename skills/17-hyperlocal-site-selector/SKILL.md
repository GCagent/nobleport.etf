---
name: hyperlocal-site-selector
description: Use for NoblePort hyperlocal site selection in Amesbury/Newburyport and Essex County / Seacoast NH — screening underutilized parcels and producing an acquisition screen covering zoning/use compatibility, lot geometry, utilities, access, flood/environmental exposure, comparable development, and permitting complexity. Use when identifying or scoring a parcel before feasibility.
---

# Hyperlocal Site Selector Skill

## Purpose
Identify a candidate parcel and produce an acquisition screen that is honest
about what is known versus what still must be verified at the municipality.

Stephanie identifies. She does not acquire.

## When to use
- A market (Amesbury / Newburyport / Essex County / Seacoast NH) needs a
  hyperlocal infill/ADU site screen.
- An underutilized parcel is being considered and needs a go/no-go screen
  before money is spent on feasibility.
- SITE-NNN must be opened on the nano chain.

## When NOT to use
- Full cost/value model → **18-nano-feasibility**.
- Entitlement verification matrix → **19-entitlement-navigator**.
- Authorizing a purchase — human only.

## Inputs
- Market / municipality, program hint (units, ADUs), any known parcel id,
  address, or lot geometry.
- Assessor, zoning map, FEMA/flood, utility, and comparable-development
  sources — or an explicit `hypothetical: true` flag.

## Workflow
1. **Identify** the candidate (underutilized, infill-capable, program fit).
2. **Screen** seven surfaces, each PASS / RISK / VERIFY:
   - Zoning / use compatibility
   - Lot geometry (area, frontage, setbacks, coverage headroom)
   - Utilities (water, sewer/septic, electric, gas, capacity)
   - Access (curb cut, fire apparatus, legal frontage)
   - Flood / environmental exposure
   - Comparable development (nearby infill, ADUs, sales)
   - Permitting complexity (AHJ path, overlays, conservation)
3. **Issue SITE-NNN** with status **STAGED**. Advance to feasibility only
   *subject to verified parcel and municipal data*.
4. **Hand off** to **18-nano-feasibility**. Do not skip entitlement.

## Outputs
- Acquisition screen (seven surfaces + evidence gaps)
- SITE-NNN identifier and stage (`STAGED`)
- Explicit list of facts that must be pulled from current municipal sources
  before the screen is treated as live

## System integration
- Module: `nano.site_selector` (STAGED, LOW) — `StephanieAgent`.
- First step of workflow `nano_infill_chain`.
- Downstream: **16-nano-ecosystem-chain**, **18-nano-feasibility**.
- Parcel parse overlap: `intake.property_parser`, **12-real-estate-development**.

## Guardrails
- A hypothetical screen is a workflow demonstration, not a live parcel or
  zoning determination. Never imply the parcel is identified, owned, or
  zoned for the program unless the source is cited.
- VERIFY items are blockers to treating the site as live, not footnotes.

## Success criteria
- SITE-NNN exists with a seven-surface screen and named evidence gaps.
- Status is STAGED until parcel and municipal data are verified.
- No language that Stephanie (or the skill) authorized acquisition.
