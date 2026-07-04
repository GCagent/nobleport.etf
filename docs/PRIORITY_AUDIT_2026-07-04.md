# Priority Audit — Verified Against Repository State

**Date:** 2026-07-04
**Scope:** All 11 NoblePort/GCagent repositories, audited against the 10-priority
optimization list and 7-day sprint plan.
**Method:** Direct code inspection. Every claim below cites the file it was
verified against. Nothing here is taken from dashboards or status decks.

---

## Verdict by priority

### P1 — Revenue Spine (claimed: Staged) — CONFIRMED STAGED
- `backend/config/revenue_spine.py` defines the full canonical pipeline
  (Lead → Intake → Estimate → Permit → Build → Invoice → Closeout) with
  enforced/human gates per stage.
- `backend/services/hubspot_sync.py` is a real bidirectional sync
  implementation (outbound lead/deal/stage pushes, inbound webhook handlers,
  scheduled full sync) keyed off `settings.hubspot_access_token`.
- `backend/config/operational_truth.py` classifies `hubspot_sync`,
  `treasury_workflows`, and `calendar_scheduling` as STAGED — consistent.
- **Gap:** live validation requires credentials and a running environment;
  it cannot be closed from the repo. The code path is ready to test.

### P2 — Command Board (claimed: Pending Acceptance) — WORSE THAN CLAIMED
- The **22-project dataset does not exist in any repository**. No file in any
  of the 11 repos references it. If it exists, it lives only in an external
  system (HubSpot/spreadsheet). It cannot be "verified against source
  documents" until it is loaded into the Postgres models that already exist
  (`backend/models/job.py`, `estimate.py`, `lead.py`).
- The Mission Control frontend renders **100% mock fixtures**:
  `src/lib/dashboard/api.ts` routes every fetch to `src/lib/dashboard/mock.ts`.
- The backend dashboard router is **also hardcoded**:
  `backend/api/dashboard.py` `_kpis()` returns a static "$18.4M pipeline",
  "$1.27M deposits" etc.
- **Truth-matrix violation:** mock KPI tiles carry `deploymentStatus: 'LIVE'`
  and `operational_truth.py` lists `dashboard_kpis` as LIVE. By the repo's own
  definition this is simulated infrastructure labeled as live production
  capability. `dashboard_kpis` should be downgraded to STAGED (or MODELED)
  until it reads verified data.
- No Airtable integration exists anywhere in the codebase (zero matches).

### P3 — Stephanie.ai Voice (claimed: In Progress) — CONFIRMED, WITH ONE FLAG
- `backend/agents/stephanie.py` is substantive: DB-backed ops brief
  (stale leads, deposits due, permit blockers, receivables, inspections)
  via real SQLAlchemy queries — this is the "verified data only" path.
- ElevenLabs TTS wiring exists in `-gcagent-ai-core/clawdbot_orchestrator.py`
  (env-keyed, fails closed when the key is missing).
- The voice dashboard page (`src/app/dashboard/voice/page.tsx`) renders mock
  session/transcript data.
- **Flag:** `operational_truth.py` lists `voice_intake` as LIVE while the
  priority table says voice is In Progress. One of these is wrong; reconcile.

### P9 — Security (claimed: Needs Review) — REPO SCAN CLEAN
- No live credentials committed in any of the 11 repos. All `.env` files are
  `.env.example` with placeholders. The only key-prefix matches are
  documentation placeholders (`sk_live_...`).
- `SOLANA_KEY_VERIFICATION.md` contains only a public key (safe to publish).
- Credential rotation, MFA/passkey verification, and integration audits are
  external-account tasks — not verifiable from code, still open.

### Other priorities (P4–P8, P10)
- P4/P5 (CRM, PM workflows): intake/estimate/proposal service scaffolding
  exists (`proposal_engine.py`, `revenue_engine.py`); daily logs, change
  orders, and closeout packages have no dedicated models yet.
- P7 (GIS/Permits): `agents/permit_stream.py` exists; `permit_scraping` is
  STAGED (MA-only), `permit_forecast` is MODELED. Matches "research complete."
- P8 (Agent framework): agents exist (`stephanie`, `gcagent`, `cyborg`,
  `permit_stream`, `audit_beacon`, `orchestrator`) — architecture-complete
  claim is fair; mesh coordination is MODELED.
- P10 (Launch blocked): correct, and the mock-data findings above reinforce it.

### Repo hygiene
- `Mike` and `nobleport2` are empty repos; `Gcagent.ai` is a single README.
  Archive or populate them — 3 of 11 repos carry no content.
- Test coverage exists where it matters most: `backend/verification/tests/`
  covers webhook security, payment verification, migration rollback, and
  route contracts (15 test files in nobleport.etf).

---

## Corrected 7-day sprint (data-integrity order)

1. **Load the 22-job dataset into Postgres.** It is the prerequisite for
   sprint items 1, 2, 3, and 6, and it currently exists nowhere in version
   control. Export from the external source, seed via the existing models.
2. **Swap the dashboard from fixtures to DB reads.** Both swap points are
   already documented in-code: replace `_kpis()`-style bodies in
   `backend/api/dashboard.py` with queries, then point `src/lib/dashboard/api.ts`
   at `NEXT_PUBLIC_DASHBOARD_API_BASE`. Panels need no changes.
3. **Reconcile `operational_truth.py` with reality** (`dashboard_kpis` and
   `voice_intake` at minimum). The truth matrix only protects you if it is
   itself true.
4. Run the three live end-to-end workflow tests (HubSpot → invoice) against
   staging with real credentials — code path is ready.
5. Complete the external-account security review (rotation, MFA, key audit);
   the repo side is clean.
6. Freeze v1.0 only after items 1–4; the current build would freeze mock
   data into the pilot.
