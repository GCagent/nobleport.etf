# NoblePort Roofing & Restoration — Division Architecture

> Best-in-class roofing tools, connected into the NoblePort operating system so
> every lead, estimate, contract, photo, payment, warranty, and referral stays
> tied to a single **Project ID**.

This document is the human-readable companion to the **canonical roofing
registry**. The machine-readable source of truth lives in code and the two must
stay in lockstep:

| Surface | Location |
| --- | --- |
| Division registry (agents, tools, KPIs, phases, skills) | `src/lib/roofing/division.ts` (`roofingDivision`) |
| Estimator engine (measurement → takeoff) | `src/lib/roofing/estimator.ts` (`computeTakeoff`) |
| Fall protection program | `src/lib/roofing/fall-protection.ts` |
| Proposals / pricing | `src/lib/roofing/proposals.ts` |
| Service-line definition | `src/lib/services/nobleport-roofing-restoration.ts` |
| Dashboard — Division | `src/app/dashboard/roofing/division/page.tsx` |
| Dashboard — Estimator | `src/app/dashboard/roofing/estimator/page.tsx` |

---

## Principle: a vertical, not a silo

Roofing does **not** invent its own infrastructure. It runs as a specialized
vertical on the NoblePort Master Operating System (NP-OS) — the same Project
Record, CRM, Payment Node, PermitStream, GCagent, and Stephanie.ai orchestration
layer the other NoblePort lanes use. Every roofing agent maps to an NP-OS layer
(see `src/lib/nobleport-os/manifest.ts`).

Third-party tools — **Hover, EagleView, CompanyCam, Xactimate** — connect as
**data sources** into NP-OS layers. They never own the record. The Project
Record stays the system of record, so a lead measured in Hover, inspected in
CompanyCam, priced in the Bid Engine, and billed through the Payment Node is one
entity under one Project ID end to end.

Governance is inherited from NP-OS: agents draft and recommend within their lane;
**money movement, permit submission, and contract execution require human
authorization** at the governance gate. Agents that cross that gate are marked
`governed` in the registry.

---

## Agent mesh

Ten roofing agents, each on an NP-OS layer and delivered in a rollout phase:

| # | Agent | NP-OS layer | Phase | Gated |
| --- | --- | --- | --- | --- |
| 1 | Roofing Sales Agent | revenue | Revenue Engine | ✔ contract execution |
| 2 | Roofing Inspection Agent | field_operations | Revenue Engine | — |
| 3 | Roofing Estimating Agent | estimating | Revenue Engine | — |
| 4 | Insurance Claims Agent | estimating | Revenue Engine | — |
| 5 | Production Agent | project_operations | Operations | — |
| 6 | Permit Agent | permit | Operations | ✔ permit submission |
| 7 | Material Procurement Agent | accounting | Operations | — |
| 8 | Safety Compliance Agent | field_operations | Operations | — |
| 9 | Warranty Agent | customer | Client Experience | — |
| 10 | Referral & Membership Agent | customer | Client Experience | — |

The **Safety Compliance Agent** enforces the Fall Protection Program: no job is
`WORK_AUTHORIZED` until training, equipment, anchorage, and supervisor gates each
clear (`src/lib/roofing/fall-protection.ts`).

---

## Connected tools

| Tool | Category | Feeds layer | Role |
| --- | --- | --- | --- |
| Hover | measurement | estimating | 3D model + exterior measurements → estimator takeoff |
| EagleView | measurement | estimating | Aerial roof reports (squares, ridge, hip, valley) → takeoff |
| CompanyCam | inspection | field_operations | Geotagged, time-stamped jobsite photos on the Project ID |
| Xactimate | insurance | estimating | Carrier scope comparison + supplement reconciliation |

---

## The Roof Estimator

`computeTakeoff()` turns measurements (from a Hover model, EagleView report,
drone capture, or manual field measurement) into a deterministic material
takeoff and labor forecast. It is a **quantity engine** — it produces quantities
and a transparent derivation basis for each line, and stays independent of cost
assumptions so the takeoff is auditable on its own. Pricing/proposals consume
the quantities downstream.

**Inputs:** total roof-surface area, pitch, ridge / hip / valley / eave / rake
lengths, existing layers, penetrations, plus a tunable `EstimatorConfig`.

**Outputs:** squares, a pitch- and cut-derived waste factor, order quantities for
field shingles, starter, ridge cap, ice & water shield, synthetic underlayment,
drip edge, and penetration flashing — plus labor hours and crew-days.

---

## Margin-protection KPIs

Revenue per Square · Labor per Square · Close Rate · Lead Source ROI · Production
Efficiency · Warranty Callback Rate · Gross Margin · Material Variance.

---

## Rollout priority

1. **Revenue Engine** — lead intake, Hover integration, roof measurements,
   proposal generation, contract execution, deposit collection.
2. **Operations** — scheduling, material ordering, daily logs, production
   dashboard, photo documentation.
3. **Client Experience** — customer portal, warranty tracking, membership plans,
   referral automation.
4. **Executive Dashboard** — sales KPIs, production KPIs, margin tracking, crew
   performance, geographic opportunity mapping.

---

*Internal architecture asset. Estimator quantities and proposal figures are
estimates pending on-site verification, not firm bids. Safety content is
operational alignment, not a substitute for 29 CFR 1926 Subpart M or a
competent-person determination on site.*
