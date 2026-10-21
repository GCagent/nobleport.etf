# NBPT Launch Review

**Date:** 2026-06-21
**Reviewer:** Launch readiness pass (`claude/nbpt-launch-review-lf0nx3`)
**Subject:** NoblePort / NBPT launch surface — Next.js dashboard (`src/`) + FastAPI backend (`backend/`)

---

## 0. Scope & method

The shared **NBPT Launch Site** is an external Manus deployment that cannot be
inspected from a URL alone, so this review evaluates the **canonical repository**
in this repo — which is the source of truth the launch site is meant to reflect.
Findings are drawn directly from the code and docs (file paths cited inline), not
from the rendered site. Any claim a deployed marketing page makes that is *not*
backed by the code below should be treated as unsupported until evidence is
attached.

Two honesty axes are used throughout, matching the project's own framework
(`backend/verification/truth_label.py`):

- **Design maturity** — how complete the architecture/code is. Does *not* imply
  it runs.
- **Runtime evidence** — how much behaviour is *proven* by collected artifacts.

---

## 1. Headline verdict

| Axis | Result | Source |
|---|---|---|
| Design maturity (avg) | **89%** | `truth_label.py` → DESIGN_MATURITY |
| Runtime evidence — fresh checkout | **0 / 8 (0%)** | evidence index is gitignored; reports 0% until the suite is run |
| Runtime evidence — after running the offline suite | **6 / 8 (75%)** | `bash backend/verification/run_verification.sh` (verified 2026-06-21) |
| Platform status | **STAGED · PARTIAL-EVIDENCE** | truth label output after run |
| Deployment verified | **NO** | 2 remaining artifacts are live-only (k6 load, Stripe sandbox) |
| Production certified | **NO** | truth label output |

> **Verified this pass:** I installed `backend/requirements.txt` and ran
> `run_verification.sh`. All six offline-runnable gating checks pass —
> `build_typecheck`, `health_endpoint`, `route_contract` (16), `migration_roundtrip`
> (2), `payment_verification` (4), `webhook_security` (8) — plus the `object_storage`
> honesty tripwire (NOT_APPLICABLE, green). The label moves from `BLOCKED`/0% to
> `STAGED · PARTIAL-EVIDENCE`/75%. The only two artifacts still `PENDING` require a
> live deployment + real Stripe test keys (`k6` tiered load report, Stripe sandbox
> payment/webhook capture) and cannot be produced offline. Note: evidence artifacts
> are deliberately gitignored (`the checks are the source of truth, not these
> snapshots`), so this 75% is reproduced by re-running the suite, not committed.

**The platform is architecturally strong and STAGED — and the codebase is, almost
everywhere, rigorously honest about that.** The Operational Truth Matrix
(`backend/config/operational_truth.py`), the evidence-gated truth label, and the
tokenization docs are exemplary: they refuse to let staged work read as live.

**There is one critical exception that is also the project's front door: the
root `README.md`.** It presents NBPT as a *live, SEC-registered securities
offering* with no caveat — directly contradicting the project's own canonical
status. This is the #1 launch blocker. Everything else is gap-closing.

**Launch-readiness completion score: 78 / 100** — strong design, zero runtime
evidence, and one high-severity truthfulness defect at the front door that must
be fixed before any external/investor exposure.

---

## 2. Revenue spine alignment

Canonical spine: `Lead → Intake → Estimate → Permit → Build → Invoice → Closeout`
(`backend/config/revenue_spine.py`, `backend/core/revenue_loop.py`). Mapped to
the eight launch-criteria stages:

| # | Launch stage | Status | Evidence in repo |
|---|---|---|---|
| 1 | **Lead Intake** | ✅ Built | `/api/leads`, voice intake (LiveKit/ElevenLabs) marked LIVE in operational_truth; Revenue layer "Lead Command Center" |
| 2 | **Estimate Engine** | ✅ Built | `/api/estimates`, Bid Engine; `estimate_generation` LIVE |
| 3 | **Proposal Generator** | ✅ Built | `backend/services/proposal_engine.py`, `backend/api/proposals.py`, `src/lib/nemoclaw/proposal.ts`, roofing/proposals page |
| 4 | **eSign Integration** | 🟡 Scaffold | Internal e-sign in the proposal flow — `ProposalStatus.SIGNED`, `signer_name`, `signed_at`, signed proposal locked (`backend/tests/test_proposals.py`). Matches canonical "eSign v2 (backend scaffold)." Not a Docusign-grade external signing ceremony yet. |
| 5 | **Payment Node** | 🟡 Staging | `/api/payments`, `treasury_workflows` STAGED, Stripe service + deposit gate. Matches canonical "Payment Node (staging)." |
| 6 | **Project Operations** | ✅ Built | `/api/jobs`, GCagent; scheduling, daily logs, production tracking |
| 7 | **Closeout Bundle Generator** | 🟡 Pipeline-ready | CLOSEOUT stage + gates exist (`warranty_docs_delivered`, `punch_list_complete`), but **no dedicated bundle-assembly generator** found. Matches canonical "pipeline-ready." |
| 8 | **Warranty Portal** | 🔴 Not built | Only a `warranty_docs_delivered` gate exists; no customer-facing warranty portal surface. NobleNest (customer layer) is defined but unbuilt. |

**Spine verdict:** 6 of 8 functional, 2 partial, 1 absent (Warranty Portal). The
spine is coherent end-to-end as a design; the back end of the spine (closeout →
warranty) is the thinnest.

---

## 3. Executive dashboard

Routes present under `src/app/dashboard/`: home, `revenue`, `jobs`, `executive`,
`agents`, `compliance`, `voice`, `audit`, `roofing` (+`/proposals`), `wallet`,
`permits`, `realty`, `settings`.

| Launch tile | Present? | Notes |
|---|---|---|
| Leads | ✅ | Revenue pipeline funnel + Lead Command Center |
| Active Projects | ✅ | North Star metric + jobs board |
| Contract Value | ✅ | Backlog / contract value metrics |
| Pipeline Value | ✅ | Pipeline funnel (`PipelineFunnel`) |
| Collections | ✅ | Cash Position panel (AR/AP, deposits, payables) |
| Permit Status | ✅ | PermitStream layer + `/dashboard/permits` |
| Production Schedule | ✅ | Upcoming milestones / jobs |
| Closeout Status | 🟡 | Spine stage exists; no dedicated closeout dashboard tile |

**Important caveat for launch:** the dashboard renders from **mock/demo data**
(`src/lib/dashboard/mock.ts` via `fetchOverview`) — e.g. "In Production: 23,
$11.24M," hard-coded operator-brief bullets (NP-225 Salisbury, etc.). This is
fine for a STAGED demo, but the launch site must **not** present these numbers as
live business metrics. Label the dashboard "illustrative / sample data" until
wired to the live backend.

---

## 4. Branding

All five brands + the operator layer are represented in
`src/lib/services/` and the NP-OS manifest:

- **NoblePort Systems** — `nobleport-systems.ts` (the OS layer) ✅
- **NoblePort Construction** — covered by GCagent / project operations ✅
- **NoblePort Roofing & Restoration** — `nobleport-roofing-restoration.ts` + roofing dashboard ✅
- **NoblePort Design & Build** — `nobleport-design-build.ts` ✅
- **Stephanie.ai operator layer** — Executive layer, **advisory-only authority**
  enforced (`STEPHANIE_AUTHORITY`: cannot release payments, submit permits, or
  execute contracts) ✅

Branding is consistent and — notably — Stephanie's authority limits are encoded,
not just described. Good.

---

## 5. Canonical status check (the truthfulness audit)

The user's canonical list says only these may be presented as staged/testable
today: Payment Node (staging), eSign v2 (backend scaffold), Handyman Engine
(staged), Stephanie.ai Orchestrator (staged architecture), Closeout Bundle
Generator (pipeline-ready). And nothing may claim, without evidence: production
deployment, audited blockchain infrastructure, live token issuance, active
securities offering, or verified pilot performance.

**Where the codebase honours this (strongly):**

- `operational_truth.py` classifies `erc1400_tokenization`, `dao_governance`,
  and `ssi_identity` as **INTERNAL_R&D** — not live.
- `docs/tokenization/erc1400-nbpt-usdc.md` is exemplary: *"Engineering built
  ahead of legal clearance. Testnet-only,"* the **`liveOfferingCleared` "Cooley
  gate" defaults to `false`**, and it states plainly that a construction/broker
  license confers **zero** authority to issue securities and that *"a securities
  offering is not a 90-day engineering sprint."*
- `docs/tokenization/erc1400-land-parcel-playbook.md`: *"Not launched.
  Testnet-only."*
- The truth label mechanically reports **0% runtime evidence / NOT production
  certified.**

**Where it violates this (critical):** the root **`README.md`**.

---

## 6. ⛔ Critical finding — README overclaims a live securities offering

`README.md` (the repository's front door, and almost certainly the narrative the
launch site borrows from) makes **unqualified** claims that map one-to-one onto
the user's "needs supporting evidence before being presented as fact" list:

| README claim | Line(s) | Canonical violation |
|---|---|---|
| "SEC-registered investment vehicle" | 21 | **Active securities offering** asserted as fact |
| "Registered investment company structure" / "Public offering registration" | 109, 116 | Active securities offering |
| "proprietary code … for a **registered** investment company" | 779 | Active securities offering |
| "Token 2022 Asset Backing," automated dividend distribution | 27, 43 | **Live token issuance** |
| "Daily NAV publication," "Authorized Participant Portal: ap.nobleport.etf" | 72, 770 | **Production deployment** asserted |
| "Annual audit requirements," "Auditor: [Big Four …]" | 112, 773 | **Audited infrastructure** implied |
| "$50+ billion AUM," fee/liquidity "advantages" stated as operational | 80–89 | **Verified pilot performance** implied |

None of these carry a status caveat. A reader (investor, regulator, journalist)
landing on this README would reasonably conclude NBPT is a **live, SEC-registered
ETF with a tokenized real-estate basket already trading** — which the project's
own Operational Truth Matrix says it is **not**. This is precisely the
unregistered-offering / misrepresentation exposure that
`erc1400-nbpt-usdc.md` was written to prevent. The README undoes that discipline
at the most visible point in the repo.

**This is the single must-fix item before any external launch.**

### Recommended remediation (README)
1. Add a status banner at the very top, mirroring the tokenization docs:
   *"STATUS: Pre-production / STAGED. Not an offer to sell securities. NBPT is
   not currently a registered investment company and no securities are being
   offered. Forward-looking architecture; subject to legal clearance
   (`liveOfferingCleared` gate)."*
2. Re-tense every "is/registered/SEC-registered" claim to the conditional
   ("designed to," "intended to," "subject to registration").
3. Remove or clearly placeholder the live-looking artifacts (AP portal URL,
   "Auditor: Big Four," daily NAV publication) until real.
4. Point the README at the Operational Truth Matrix and truth label so the front
   door inherits the same honesty standard as the rest of the repo.

---

## 7. Gap analysis & launch blockers

**P0 — must fix before external launch**
1. **README securities/production overclaims** (§6). Truthfulness defect.

**P1 — needed for a credible "staged, testable" launch**
2. **Runtime evidence — DONE for the offline tier (✅ 6/8, verified this pass).**
   `run_verification.sh` was run and all six offline-runnable gating artifacts pass,
   moving the label to `STAGED · PARTIAL-EVIDENCE`/75%. Remaining: the two live-only
   artifacts (`k6` tiered load report, Stripe sandbox payment/webhook) must be
   collected against a deployed environment with real Stripe test keys to reach
   RC1. Until then the platform is correctly STAGED, not production-certified.
3. **Dashboard mock-data labeling.** Mark the executive dashboard as
   illustrative until wired to live data, or gate demo numbers behind a "sample"
   flag.

**P2 — complete the spine**
4. **Closeout Bundle Generator** — build the actual bundle-assembly step (the
   stage/gates exist; the generator does not).
5. **Warranty Portal** — absent; build or explicitly mark "planned" on the launch
   site.
6. **eSign v2** — promote from internal scaffold to a real signing ceremony if
   the launch narrative implies binding e-signature.

---

## 8. Bottom line

NoblePort is a **well-architected, internally honest, STAGED platform** with a
coherent revenue spine and a genuinely strong truth-labeling discipline that most
pre-launch projects lack. The launch is **not blocked by the engineering** — it
is blocked by **one document (`README.md`) overclaiming a live securities
offering**, plus the absence of collected runtime evidence.

Fix the README to match the project's own Operational Truth Matrix, run the
offline verification suite to get off 0% evidence, and label demo data as demo
data. With those three moves, NBPT can launch honestly as exactly what it is: a
staged, testable construction-operations platform with a forward-looking
tokenization track that is explicitly **not yet** an offering.
