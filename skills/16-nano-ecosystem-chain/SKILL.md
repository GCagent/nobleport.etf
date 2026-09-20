---
name: nano-ecosystem-chain
description: Use to run the NoblePort Nano Ecosystem chain for infill/ADU development — hyperlocal site selection through feasibility, entitlement, design, construction sequencing, loan draws, risk stress, property ops, and the five-harness control plane. Use for Amesbury/Newburyport (and Essex County / Seacoast NH) infill programs, and whenever a project must become a reusable evidence graph instead of PDFs and spreadsheets.
---

# Nano Ecosystem Chain Skill

## Purpose
Run one infill/ADU project through the full nano-ecosystem chain so the record
is a connected evidence graph: parcel → entitlement → drawings → estimate →
subcontractors → schedule → inspections → draws → closeout → tenants →
maintenance → asset performance.

Stephanie coordinates. Humans authorize. Nothing is labeled permitted,
acquired, or funded without source evidence and a named gate.

## When to use
- An infill, ADU, or small multifamily program needs the end-to-end chain.
- A parcel in Amesbury / Newburyport / Essex County / Seacoast NH is being
  screened, modeled, or advanced through due diligence.
- The question is "what is the project state?" — five-harness, not a vibe.
- After closeout, the asset must stay on the same graph (ops + performance).

## When NOT to use
- Single-trade residential jobs (roof, deck, bath) → **01-estimator** /
  **03-project-manager** / **07-sales-router**.
- Isolated permit intelligence → **02-permitstream**. Isolated feasibility
  without the chain → **12-real-estate-development**.
- Authorizing acquisition, filing, or releasing funds — this skill stages;
  humans authorize.

## Inputs
- Market / municipality, program (e.g. 6-unit infill + 2 ADUs), parcel
  identifier if known.
- `hypothetical: true` unless parcel, zoning, and market evidence are
  verified from current municipal/assessor sources.
- Cost, value, and financing assumptions — every figure labeled and sourced.

## Workflow
1. **Hyperlocal Site Selector** (**17**) — acquisition screen; SITE-NNN
   advances to feasibility only, subject to verified parcel/municipal data.
2. **Nano-Feasibility** (**18**) — cost stack, completed value, spread,
   overrun sensitivity. Stephanie does **not** authorize acquisition.
3. **Entitlement Navigator** (**19**) — verification matrix. Nothing is
   labeled "permitted" until source evidence supports it.
4. **Generative Design** (**20**) — three concepts (max yield, lower-cost,
   balanced yield/community fit). Selected concept feeds sequencing.
5. **Construction Sequence Optimizer** (**21**) — preconstruction through
   CO/closeout; supplier, inspection, weather, and long-lead items on the
   critical path.
6. **Capital + risk layer** — **22-loan-draw-manager** (HIGH, human gate)
   in parallel with **23-risk-stress-tester** (cost, schedule, rate,
   absorption, permitting). Draws are DRAFT until a human approves.
7. **Property Management Copilot** (**24**) — after closeout: maintenance,
   vendors, operating cost, recurring-problem detection.
8. **Ecosystem Orchestrator** (this skill) — stitch the evidence graph.
9. **Five-Harness** (**25**) — Execution · Governance · Security/Compliance ·
   Observability/Evidence · Testing/Release. Overall state is honest.

Worked demonstration (hypothetical, not a live parcel determination):
`skills/nano-ecosystem/EXAMPLE-amesbury-newburyport-infill.md`.

## Outputs
- Chain run record (SITE-id, stage, gates, evidence completeness)
- Staged acquisition screen, feasibility model, entitlement matrix
- Design alternatives, construction sequence, draft draw package
- Stress-test scenarios, ops handoff, evidence graph
- Five-harness control-plane report

## System integration
- Workflow: `nano_infill_chain` in
  `nobleport-systems/orchestrator/nobleport/workflows/definitions.py`.
- Modules: `nano.*` cluster in `nobleport-systems/orchestrator/nobleport/modules.py`.
- Agent: `StephanieAgent` (chain) + `PermitStreamAgent` (`nano.entitlement`).
- Start: `POST /api/workflows/nano_infill_chain/start`.
- Draw step (`nano.draw_manager`) is HIGH-risk — engine suspends for human
  approval. STAGED modules always simulate.
- Cross-skills: **17–25** (stages), **02 / 04 / 12** (entitlement/feasibility),
  **03 / 10 / 13** (sequence / draws / ops), **06** (executive rollup).

## Guardrails
- **Hypothetical until verified.** A demonstration run is not a live
  zoning, valuation, or acquisition determination. Label it.
- **Stephanie does not authorize acquisition, filings, or fund release.**
  The chain advances due diligence; humans authorize irreversible steps.
- **No fabricated authority.** Nothing is "permitted" without source
  evidence. Unknown parcel/zoning/market facts are gaps, not guesses.
- Overall project state defaults to **STAGED — DUE DILIGENCE REQUIRED**
  until Testing/Release is verified against a real parcel.

## Success criteria
- Every stage writes to the same project graph; nothing dies in a PDF.
- Acquisition is never marked authorized by the agent.
- Draw packages are DRAFT / HUMAN APPROVAL REQUIRED, with evidence % and
  exceptions that HOLD affected amounts.
- Five-harness reports all five dimensions; overall state is not "LIVE"
  on hypothetical inputs.
