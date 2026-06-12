# NoblePort Sales OS v2.1 — Progressive Revenue Execution Layer

**Source spec:** NoblePort Sales Simulation v2.0 (truth-review upgrade) +
v2.1 roadmap (`GCagent/nobleport` issue #20, "Progressive Revenue Execution
Layer").
**Status:** `SIMULATED` Truth-Layer tag · data provenance `SIMULATED | BLENDED | ACTUAL`.
**Decision authority:** Human Review Required.
**Purpose:** Training, forecasting, and resource allocation — *not* hiring or
termination decisions.

This turns the v2.0 sales spec from a document into a working, deterministic
engine. v1 ranked salespeople on close rate alone, which rewards a high volume
of small jobs over the gross profit that actually grows a design-build company.
v2.0 replaces that single metric with a weighted index, ranks the service lines
by strategic value, and routes the most *profitable* leads — not merely the most
leads — to top performers. Every simulation output carries the `SIMULATED`
Truth-Layer tag; the same engines run unchanged on real data once it exists.

---

## What was built

| Spec section | Code | What it does |
|--------------|------|--------------|
| Weighted GPPI | `backend/sales/gppi.py` | Six-KPI weighted index (40/25/15/10/5/5), cohort-relative min-max normalization, 0–100 score, ranked leaderboard |
| Revenue Hierarchy | `backend/sales/hierarchy.py` | 13 service lines across 4 strategic tiers (ADU → bathroom), strategic weights, lead-feeder flags |
| 80/20 Operating Rule | `backend/sales/lead_routing.py` | Premium vs. standard lead grading, profitable-lead routing to the top 20% by GPPI |
| Sales Simulation | `backend/sales/simulation.py` | Seeded, deterministic team + lead board; `SIMULATED` tag; data-readiness gate |
| Dashboard v1 | `backend/sales/dashboard.py` | Lead/sales/financial metric catalog + aggregation; market breakdown |
| API | `backend/api/sales.py` | `/api/sales/{hierarchy,metrics,leaderboard,routing,simulation,dashboard}` |
| Mission Control UI | `src/app/dashboard/sales/page.tsx` | GPPI leaderboard, weighting, hierarchy, routing, market metrics, readiness gate |
| Tests | `backend/tests/test_sales.py` | 40 tests asserting the model's hard guarantees |

### v2.1 — Progressive Revenue Execution Layer

| Roadmap item | Code | What it does |
|--------------|------|--------------|
| Truth layer `SIMULATED \| BLENDED \| ACTUAL` | `backend/sales/provenance.py` | Data-provenance gate, **capture-first** (count-gated, not calendar-gated) |
| Close-rate growth loop | `backend/sales/close_rate.py` | Projects from NoblePort's real ~6.25%–12.5% baseline via compounding levers, capped at a realistic ceiling |
| Human-gated governance | `backend/sales/governance.py` | AUTO vs HUMAN per sales action, reusing LIVE/STAGED/BLOCKED tags; $25k budget gate; fail-closed |
| Collaboration layer | `backend/sales/collaboration.py` | Stephanie / PermitStream / GCagent / Cyborg handoff map |
| Tax-aware enrichment | `backend/sales/enrichment.py` | Advisory-only, CPA-review-required real-estate talking points (guardrails in code) |
| Revenue War Board UI | `src/app/dashboard/sales/page.tsx` | Provenance progression, capture gate, close-rate loop, governance, collaboration |

---

## The GPPI weighting

| KPI | Weight | Notes |
|-----|--------|-------|
| Gross Profit Generated | 40% | The heaviest signal — dominates ranking |
| Revenue Generated | 25% | |
| Average Job Size | 15% | Rewards Tier-1 work over feeder volume |
| Close Rate | 10% | Demoted from v1's sole metric |
| Lead Response Time | 5% | **Inverted** — faster is better |
| Customer Satisfaction | 5% | 0–5 CSAT |

Scoring is **cohort-relative**: each KPI column is min-max normalized across the
reps being ranked, weighted, and scaled to 0–100. The index answers "who is
performing best right now?" rather than asserting an absolute. A single-rep
cohort normalizes to a neutral 1.0 on every axis (nobody is penalized for being
the only data point). Weights are asserted to sum to 1.0 at import.

> A salesperson closing **2 bathrooms at $15,000** is not out-performing one
> closing **1 ADU at $325,000.** GPPI encodes exactly that — see
> `test_high_gross_profit_rep_outranks_high_volume_rep`.

---

## Revenue hierarchy

| Tier | Posture | Lines |
|------|---------|-------|
| 1 | Scale aggressively | ADUs, Additions, Design-Build, Investor Redevelopment, Property Acquisition |
| 2 | Grow | Roofing, Exterior Restoration, Whole House Renovations |
| 3 | Maintain | Kitchens, Bathrooms |
| 4 | Lead feeders | Maintenance Memberships, Painting, Property Services |

Lower-ticket lines are not "bad" — they are feeders that pull homeowners into
larger Tier-1 projects. Strategic weight runs Tier 1 → 1.0, Tier 2 → 0.75,
Tier 3 → 0.5, Tier 4 → 0.3.

---

## The 80/20 operating rule

Old rule: *top 20 agents get the most leads.* New rule: **top 20 agents get the
most profitable leads.** A lead is graded **premium** if its service line is
Tier 1, or its profitability score (strategic weight + premium qualifiers such
as waterfront, historic, estate, investor portfolio) clears the threshold.
Premium leads round-robin across the top 20% of the GPPI leaderboard; standard
leads (bathrooms, painting, maintenance, small roofing) go to developing staff,
who build their numbers on them. Routing is deterministic and auditable.

---

## The hard guarantees (enforced, not described)

1. **Gross profit, not volume, wins.** A perfect close rate on tiny jobs loses
   to large gross profit. (`test_close_rate_alone_does_not_win`)
2. **Premium leads route to top performers.** Every premium lead lands with a
   top-20% rep. (`test_premium_leads_route_to_top_performers`)
3. **Deterministic.** Same seed → identical team, leaderboard, and routing.
   (`test_simulation_is_deterministic`)
4. **Truth-tagged.** Every simulation carries `SIMULATED`, label
   "SIMULATED MODEL OUTPUT", and "needed next: ACTUAL NOBLEPORT SALES DATASET".
   (`test_simulation_is_tagged_simulated`)
5. **Decision authority is human.** The engine informs resource allocation; it
   never decides hiring or termination.

---

## Data provenance — capture-first (v2.1)

The v2.1 truth layer classifies the **provenance of the data** behind every
output, and promotion is **capture-first**: the model earns its label by
recording real funnel data, not by waiting on the calendar.

| Provenance | Gate | Meaning |
|------------|------|---------|
| `SIMULATED` | default | No real data, or real data below the BLENDED bar |
| `BLENDED` | ≥ 40 captured opportunities **and** ≥ 1 completion | Real + synthetic |
| `ACTUAL` | ≥ 12 months **and** ≥ 200 opportunities **and** ≥ 30 completions | NoblePort-specific |

> **Twelve months of an empty CRM is still `SIMULATED`.** Time alone never
> promotes the model — see `test_capture_first_time_alone_does_not_promote`.

Once NoblePort captures opportunities → appointments → estimates → contracts →
deposits → completed projects, the AI forecasts win probability, project size,
margin, referral, and change-order probability on its own Essex County / NH
Seacoast market. The GPPI and routing engines run unchanged on that real data;
only the inputs change.

## Close-rate growth loop (v2.1)

NoblePort's measured baseline is ~6.25%–12.5%. The loop projects improvement by
compounding operating levers — each owned by a system — capped at a realistic
0.45 design-build ceiling:

| Lever | Owner | Lift |
|-------|-------|------|
| Sub-hour lead response | Stephanie.ai | +18% |
| 80/20 profitable-lead routing | Sales OS | +15% |
| Disciplined multi-touch follow-up | Sales OS | +12% |
| 48-hour estimate turnaround | GCagent.ai | +10% |
| GPPI-driven rep coaching | Sales OS | +8% |
| Permit/compliance proof at proposal | PermitStream.ai | +6% |

The honest ceiling matters as much as the levers: no process turns 10% into 90%.

## Human-gated sales governance (v2.1)

The OS automates routing and scoring; anything touching a customer's money or a
person's standing is **HUMAN**-gated and staged for sign-off. A $25k budget gate
demotes otherwise-autonomous actions, and unknown actions fail closed to
`BLOCKED`.

- **AUTO (LIVE):** route lead, score reps, suggest follow-up, draft proposal
- **HUMAN (STAGED):** reassign lead, apply discount, send proposal, approve
  contract, override GPPI rank, tax advisory

## Collaboration layer (v2.1)

The Sales OS hands off across the revenue spine to Stephanie.ai (intake),
PermitStream.ai (permit feasibility), GCagent.ai (proposal/build), and Cyborg.ai
(governance/audit). Proposal-send, contract-approval, and discount-override
handoffs are human-gated; every routing/scoring decision is mirrored to Cyborg
for the audit chain.

## Tax-aware enrichment — advisory only (v2.1)

A *future* capability shipped now as an explicit, guard-railed stub: for
investor/acquisition/estate deals the OS can surface tax-aware **questions to
take to a CPA** (1031 exchange, cost segregation, basis classification,
opportunity zones). Every output is `advisory_only` + `cpa_review_required` and
routed through the human gate — the guardrails live in code so this can never
quietly become unreviewed tax advice.

---

## Sales Dashboard v1 — captured metrics

**Lead:** Source · Town · Project Type · Lead Value · Response Time
**Sales:** Appointment Set · Estimate Delivered · Follow-Up Count · Contract Signed · Deposit Received
**Financial:** Revenue · Gross Profit · Gross Margin % · Average Job Size · Lifetime Client Value
**Markets:** Newburyport · Ipswich · Manchester-by-the-Sea · Essex · Marblehead · Portsmouth · Rye · New Castle

Capturing all of these per opportunity is the precondition for the
NoblePort-specific model. The metric catalog lives in `backend/sales/dashboard.py`
so the dashboard and the GPPI/routing engines collect against the exact same
fields the simulation uses.

---

## API surface

| Endpoint | Returns |
|----------|---------|
| `GET /api/sales/hierarchy` | The 13 service lines across 4 tiers |
| `GET /api/sales/metrics` | The v1 dashboard metric catalog |
| `GET /api/sales/leaderboard` | GPPI leaderboard for a SIMULATED team |
| `GET /api/sales/routing` | 80/20 profitable-lead routing plan |
| `GET /api/sales/simulation` | Full snapshot: leaderboard + routing + readiness |
| `GET /api/sales/dashboard` | Aggregated Revenue War Board payload |
| `GET /api/sales/close-rate` | Close-rate growth loop from the ~6.25%–12.5% baseline |
| `GET /api/sales/governance` | Human-gated sales authority matrix |
| `GET /api/sales/governance/classify` | Classify one action (AUTO/HUMAN + tag) |
| `GET /api/sales/collaboration` | Agent handoff map |
| `GET /api/sales/enrichment` | CPA-gated tax-aware talking points (advisory only) |

Snapshot endpoints accept `team_size`, `lead_count`, `months_of_real_data`,
`captured_opportunities`, `captured_completions`, and `seed`; all are read-only.
The Truth-Layer action tag stays `SIMULATED`; the data-provenance label is
computed from the captured-data counts.
