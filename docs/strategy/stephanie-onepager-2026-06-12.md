# NoblePort / Stephanie.ai — Executive Snapshot (Updated)

**Date:** 2026-06-12 UTC
**Prepared by:** NoblePort engineering
**Final decision authority:** Michael F. O'Rourke, Managing Member
(per `backend/governance/authority_matrix.py` — Stephanie.ai is the
orchestration layer, holds no executive office, and may claim no credentials)

**Supersedes:** the 2026-06-08 narrative snapshot
([archived, retired](./archive/stephanie-onepager-narrative-2026-06-08-RETIRED.pdf)).
**Distribution status: NOT cleared for LP or investor distribution.** The
prior snapshot's "production-ready for LP distribution" label was incorrect —
see the retired-claims table below and the counsel gate at the end.

---

## Key metrics — measured, with sources

Every figure below is computed by code in this repository or counted from its
artifacts. Nothing is asserted from narrative.

| Metric | Value | Source |
|--------|-------|--------|
| Feature surfaces LIVE | **5** (voice intake, crew task routing, lead pipeline, estimate generation, dashboard KPIs) | `backend/config/operational_truth.py` |
| Feature surfaces STAGED | 7 (permit scraping, treasury, HubSpot sync, calendar, revenue operator, NVAPI gateway, ASR proxy) | same |
| Feature surfaces MODELED / INTERNAL R&D | 5 / 4 | same |
| Governance baseline: actions processed | 17 | `run_baseline()` over the scenario suite |
| Human-in-the-loop rate | **76.5%** | measured gate decisions |
| Autonomous execution rate | 23.5% (LIVE-tagged only) | measured gate decisions |
| Fail-closed events (unknown/blocked actions) | 3 | measured gate decisions |
| Audit coverage | **100%**, SHA-256 hash chain intact | `verify_chain()` |
| Attestation registry records | 67 across 9 categories | `backend/governance/attestation_registry.py` |
| Attestations independently VERIFIED | **0** (6 SELF_ASSERTED real-world licenses await documents) | attestation registry v1.0 |
| Smart contracts implemented (source in repo) | 3 (`HumanApprovalGateway`, `MassachusettsBuildingPermits`, `NBPTSecurityToken1400`) | `contracts/` |
| Smart contracts deployed on-chain | **0** | smart-contract registry |
| Tokenized parcels / TVL / token holders | **0 / $0 / 0** — no token or parcel is on any network | smart-contract registry |

## What Stephanie.ai actually is today

A governed construction-operations orchestration layer: LIVE homeowner voice
intake (LiveKit + ElevenLabs), crew/sub task routing, lead pipeline, and
estimates — wrapped in an enforced, fail-closed governance gate where every
action is classified (LIVE/STAGED/SIMULATED/BLOCKED), regulated actions
escalate to a licensed human, and every decision lands on a tamper-evident
audit chain. The Cyborg.ai surface now has its first runnable code (NVAPI
inference gateway with kill switch + Vault key custody; Nemotron ASR proxy),
both STAGED.

## Retired claims from the 2026-06-08 snapshot

These figures have **no evidence artifact anywhere in the codebase** and are
classified SIMULATED narrative. They must not appear in any investor-facing
material.

| Retired claim | Truth status | Tracked at |
|---------------|--------------|-----------|
| "IQ 131,004 / 305,432" | No such metric exists; not meaningful | — |
| "15.1B ops/sec; 621.78B CUDA peak; 88ms P95" | No benchmark harness or telemetry produces these | Operational Truth Matrix (`billion_task_systems`: INTERNAL_R&D) |
| "3,012 active nodes/validators" | SIMULATED — no validator set exists | `NP-ATT-ZKP-006` |
| "977,023+ zkSBT holders" | No SBT contract source exists, 0 deployed | `NP-ATT-ZKF-001`; smart-contract registry |
| "17,511 tokenized parcels; $154M TVL" | 0 contracts deployed; no token, no parcels, no TVL | smart-contract registry |
| "1B canary task batch (Aug 8, 2025)" | Simulation narrative, not deployment evidence | Operational Truth Matrix |
| "Author: Stephanie A. (CEO)" | Stephanie holds no office; L1 authority is Michael F. O'Rourke | `authority_matrix.py` (credential register: can_claim = False) |
| "Production-ready for LP distribution" | **Blocked** — securities materials are counsel-gated | `NBPTSecurityToken1400.liveOfferingCleared` (Cooley gate) |

## Next steps — tactical, honest

1. **Counsel first:** Reg D work and any LP-facing document go through
   securities counsel; nothing distributes before the Cooley gate clears.
2. **First VERIFIED attestations:** upload CSL/HIC/EPA/OSHA credentials and
   sign the `nobleport.eth` ownership challenge (per the
   [Attestation Registry path-to-VERIFIED](../governance/attestation-registry-v1.md)).
3. **First on-chain anchor:** deploy one implemented contract to a public
   testnet — turns "0 deployed" into an explorer-checkable fact.
4. **Wire Cyborg.ai:** connect the dashboard's compliance/kill-switch UI to
   the real gateway endpoints; replace mock data with measured telemetry.
5. **Compliance regression:** run it through the *real* governance gate and
   report measured numbers — the 5k-tx/<0.5% framing only counts if computed.

---

*Not legal advice. Not an investment representation. Every number above is
reproducible from this repository at the stated date.*
