# NoblePort Systems Truth Registry

**Status:** Measured + declared inventory, enforced in code.
**Modules:** `backend/systems/` (truth buckets, registry) · API at `/api/systems`
**UI:** `/dashboard/systems` · **Tests:** `backend/tests/test_systems.py`

The registry answers one question honestly: **of everything NoblePort calls a
"system," what is actually live, and what is the evidence?** It exists because
self-declared status files and demo outputs kept being presented as production
capability — the registry makes that category error structurally impossible.

## Truth buckets

| Bucket | Meaning | Promotion gate |
|--------|---------|----------------|
| `VERIFIED` | Independently verified live production | Rolling re-verification |
| `STAGED` | Built + measurable on disk, not live | Deploy + independent live telemetry |
| `CLAIMED` | Self-declared status, no independent evidence | Third-party attestation / telemetry |
| `DEMO` | Simulation or demonstration output | Real production records, then verify |
| `PLANNED` | Roadmap / backlog | Build it (code + tests + docs → STAGED) |
| `BLOCKED` | Not permitted to operate (fail-closed) | Authority-matrix change + human signoff |
| `LEGAL_HOLD` | Gated on legal/compliance signoff | Written signoff from licensed counsel |
| `REFERENCE` | External artifact not yet ingested | Commit it to the repo, make it measurable |

## The hard rule (enforced, not described)

A node **cannot** be `VERIFIED` without a named verifier — the `SystemNode`
constructor raises (`test_verified_requires_named_verifier`). Conversely,
repo code-completeness earns `STAGED`, never `VERIFIED`: artifacts prove a
system is *built*, not that it is *live*
(`test_repo_code_complete_is_staged_never_verified`). The current honest
baseline is **0 verified systems**, and the registry says so in its
`hard_truth` field.

## 50-Module Honest Control Register (2026-06-11)

The operator's attested control register is ingested as a third evidence
source (`backend/systems/control_register.py`, source tag
`declared:control-register-2026-06-11`). Mapping rules, enforced by tests:

- **LIVE (unhedged)** → `VERIFIED`, with the operator register as the named,
  accountable verifier — human attestation, never system self-declaration.
  The 7 attested-live modules: Construction Intake (95%), Construction
  Orchestration, Scope & Estimate Engine, Proposal Generator, Manual Permit
  Fallback, KUZO Safe Swap read-only (92%), KUZO Dashboard (95%).
- **Composite statuses always take the more restrictive bucket** —
  `LIVE/STAGED` → STAGED, `STAGED/CLAIMED` → CLAIMED, `BLOCKED/STAGED` →
  BLOCKED, `HOLD/STAGED` → LEGAL_HOLD or BLOCKED per the governing reason
  (`test_composite_statuses_never_map_to_verified`).
- **TARGET** → PLANNED · **SIMULATED** → DEMO · money/regulated holds
  (RealEstateNFT, FiatRouter, TreasuryBotV3, swap execution) are human-gated.

The register's truth floor is carried in the payload verbatim: **0 external
live nodes are controlled from chat** — AI control covers coordination,
drafting, audit, build specs, and authorized connector actions only. Claimed
node metrics (3,012 validators, 88ms p95, 112 agents, the 20-row "Meet1000"
roster) are recorded as claims pending telemetry proof, and the register's
**bankable operating core** (12 revenue modules to harden first) is exposed
at `bankable_core`.

## Two evidence sources

1. **Measured (`measured:repo`)** — the 14 repo projects bridge in from the
   program-completion engine with their deliverable counts as evidence.
2. **Declared (`declared:<artifact>`)** — external systems classified by what
   their own artifacts support:
   - **EpochX mesh** → `CLAIMED`: its status file asserts "mesh launched,
     1,000 validators, agi_mode ON" — a self-declaration, not telemetry.
   - **Avatar fleet** → `DEMO`: the artifact itself states the 2,000,000
     avatar IDs were randomly generated for demonstration.
   - **NBPT token issuance** → `LEGAL_HOLD`: regulated security; requires
     counsel signoff and resolution of the open OpenZeppelin High finding.
   - **Live trading execution** → `BLOCKED`: execution-restricted lane.
   - **200-module workbook** → `REFERENCE`: produced in an external session;
     commit it (or a CSV export) to the repo and the registry can ingest it.

## Strongest real path

Execute in order, regulated layers last:

**Construction ops → estimating → payments → PM control → audit ledger →
regulated RWA/token layers only after written legal signoff.**
