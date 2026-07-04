# Priorities Validation — July 2026

Grounding pass for the 10-priority optimization board. Every claim below is
backed by code, tests, or an explicit "cannot verify from this repo" — per the
guiding principle that nothing is production truth until it is backed by
verified source data.

**What changed in this pass**

- Added `backend/tests/test_spine_end_to_end.py`: three end-to-end workflow
  tests that drive a job through the full revenue spine via the real HTTP API
  and services (Lead → Estimate → Proposal → e-sign → deposit gate → activation
  → project/daily log → invoice → payment → complete → GCagent closeout
  package). This satisfies the sprint item "complete three end-to-end workflow
  tests" at the level achievable without live credentials.
- Fixed `backend/requirements.txt`: the pinned `httpx-mock==0.14.0` does not
  exist on PyPI and broke `pip install -r` on a fresh environment.
- Full backend suite: **134 passed** (131 pre-existing + 3 new), ~3.5s.

## Priority-by-priority status (verified against this repo)

### 1. Revenue Spine — 🟡 Staged → code path now validated end to end

The full in-code path is proven by the new E2E tests:

- Contract math holds on the wire (subtotal → markup → total → deposit).
- The contract-readiness gate blocks both `send` and `accept` for unpriced or
  unscoped proposals (422).
- E-signing flips lead + estimate to WON, syncs signed pricing back onto the
  estimate, and creates the job in `PENDING_DEPOSIT`.
- The Stripe `checkout.session.completed` lifecycle handler enforces the
  deposit gate: short deposits do not pass; job activation is rejected (400)
  until the gate clears. The payments ledger enforces session-id uniqueness
  (webhook replay protection).
- GCagent's closeout package refuses to certify a job with unissued permits,
  unpassed inspections, open balances, or no photos — and certifies the
  golden path with all gates green.

**Still open for "live" status:** actual HubSpot and Stripe round-trips need
real credentials and belong to the staging environment, not this repo. Per
`backend/config/operational_truth.py`, `hubspot_sync` and `treasury_workflows`
are honestly marked STAGED.

**Gaps found (real, now documented in the test):**

- No API route sets `job.project_id` — the Job→Project link can only be made
  by direct DB write. This is the PLANNED Contract role (#5) in
  `backend/config/revenue_spine.py`.
- Permits, inspections, and media files have no public CRUD routes; they are
  agent/field-tooling concerns today. Closeout gates depend on them, so any
  live validation plan must include how those records get created.

### 2. Command Board / 22 project records — ⚠️ cannot verify from this repo

There is **no** Airtable schema, Command Board dataset, or 22-record job list
anywhere in this codebase (searched all repos in the session). That data
lives in external SaaS. Verifying it "against source documents" is a manual /
credentialed task; do not mark it validated on the strength of anything here.

### 3. Stephanie.ai Voice — 🟡 consistent with "In Progress"

`backend/agents/stephanie.py` implements intake routing and the ops brief;
`operational_truth.py` lists `voice_intake` (LiveKit + ElevenLabs) as LIVE.
The conversational layer connects through the AgentMesh orchestrator
(`backend/agents/orchestrator.py`), which routes only over the mesh's typed
tasks — i.e., verified data surfaces. No contrary evidence found.

### 4–5. Construction CRM / Project Management — 🟡 accurate

Leads, estimates, proposals, jobs, projects, daily logs, schedules, change
orders, invoices, and payments all have working API routes (exercised by the
E2E tests where they sit on the spine). Follow-up automation (dunning /
Collections, role #15) is PLANNED, not built — the honest backlog in
`revenue_spine.py` is: Contract, eSign, Collections, Vendor Intelligence,
Qualification.

### 6. Financial Controls — 🟡 partially enforced in code

Deposit gate, margin recalculation, invoice balance recalculation, and the
paid-payments ledger are real and now covered end to end. AR aging /
reconciliation against QuickBooks remains external.

### 7. GIS / Permit Intelligence — 🟡 matches "Research Complete"

`backend/agents/permit_stream.py` + permit/inspection models exist;
`permit_scraping` is STAGED with a Massachusetts geo-constraint. No municipal
GIS integration code exists yet.

### 8. AI Agent Framework — 🟡 matches "Architecture Complete"

Seven agent families are wired through `EVENT_ROUTING`; 15 of the 20 spine
roles are IMPLEMENTED, 1 PARTIAL, 4 PLANNED (enforced by tests in
`test_revenue_spine.py`).

### 9. Security — 🟡 needs human action

The code side is strong: secrets startup gate (`backend/core/secrets.py`,
fails production boot on missing/overdue secrets), command freeze
(`backend/config/command_freeze.py`) blocking autonomous contract generation,
permit submission, and payment disbursement, plus a webhook-security test
suite under `backend/verification/tests/`. Credential rotation, MFA/passkey
verification, and third-party API-key audits are account-level actions no
repo change can perform — they remain on the human checklist.

### 10. Production Launch — 🔴 correctly blocked

`operational_truth.py` and the verification evidence manifest keep the
LIVE/STAGED/MODELED boundary explicit. The block should hold until the
staging items above (live HubSpot/Stripe round-trip, external dataset
verification, credential rotation) are signed off by a human.

## Honest 7-day sprint restated

| Sprint item | State after this pass |
|---|---|
| Validate the 22-job dataset | External data — needs Airtable/HubSpot access, not repo work |
| Three end-to-end workflow tests | ✅ Done in code (`test_spine_end_to_end.py`); live-credential reruns still owed in staging |
| Stephanie voice → verified data | Wired through orchestrator; confirm LiveKit/ElevenLabs staging config |
| Proposal & change-order templates | Proposal HTML renderer exists (`proposal_engine.render_html`); CO template not verified |
| Staging security review | Code gates verified; credential rotation + MFA is a human task |
| Daily briefing + calendar test | `generate_ops_brief` wired; calendar is STAGED |
| Freeze v1.0 for pilot | Blocked on the rows above — correctly |
