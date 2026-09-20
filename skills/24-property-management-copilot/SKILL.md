---
name: property-management-copilot
description: Use for NoblePort post-closeout operations on nano-chain assets — maintenance, vendor coordination, operating-cost tracking, and recurring-problem detection after CO. Use once a project moves from construction into occupied or rent-ready operations, keeping the same evidence graph rather than starting a new spreadsheet.
---

# Smart Property Management Copilot Skill

## Purpose
After closeout, keep the asset on the same graph: maintenance, vendors,
operating cost, and recurring problems — so performance is evidence, not
anecdotes.

## When to use
- CO/closeout is complete (or imminent) and ops must start.
- A nano-chain asset needs maintenance plans, vendor routing, or OpEx
  tracking.
- Recurring failures (leaks, HVAC short-cycles, turnover damage) need
  detection across units.

## When NOT to use
- Homeowner-facing NobleNest reports for a single occupied home →
  **13-noblenest**.
- Construction punch/closeout still in progress → **03-project-manager**.
- Pricing a capital improvement → **01-estimator**.

## Inputs
- Asset record from the chain (parcel, units, drawings, closeout package).
- Systems inventory, vendors, leases/tenants (if any), work-order history,
  operating-cost ledger.

## Workflow
1. **Ingest closeout** — warranties, manuals, as-builts, remaining punch.
2. **Stand up maintenance** — unit- and system-level tasks with cadence.
3. **Coordinate vendors** — trade, SLA, insurance/COI, work-order routing.
4. **Track operating cost** — actuals vs. underwriting OpEx; flag drift.
5. **Detect recurring problems** — same unit, same system, same failure
   more than once in the window → escalate to capital vs. maintenance.
6. **Write back** to the evidence graph so **16** / **25** can show
  asset performance, not a disconnected PM tool.

## Outputs
- Maintenance plan and open work orders
- Vendor roster and COI status
- OpEx tracker vs. underwriting
- Recurring-problem register

## System integration
- Module: `nano.property_ops` (STAGED, MEDIUM) — `StephanieAgent`.
- Related: **13-noblenest** (homeowner view), **08-trust-pipeline**,
  `jobs.punch_list`, maintenance models in NP-OS.
- Workflow `nano_infill_chain` after draws / closeout.

## Guardrails
- Do not invent condition data; unknown systems are flagged for
  inspection.
- Tenant/PII stays on the operational record; public/marketing use still
  requires consent (**11-content-engine**).
- Recurring issues that look like construction defects route back to
  **09-change-orders** / warranty, not silent OpEx absorption.

## Success criteria
- Ops records attach to the same SITE-NNN / asset id as construction.
- OpEx has a variance vs. the underwriting assumption.
- Recurring problems have a count, a system, and an owner.
