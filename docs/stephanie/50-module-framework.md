# Stephanie.ai — 50-Module Execution Framework

**Modules:** `backend/stephanie/` (framework, catalog, orchestrator, impl) ·
API at `/api/modules` · UI at `/dashboard/modules`
**Tests:** `backend/tests/test_stephanie_modules.py`

The control register made the 50 modules *legible*; this framework makes them
*executable units* under Stephanie's orchestration — with the register's truth
enforced as runtime behavior, not dashboard decoration.

## The runtime rules (enforced, not described)

| Register state | Runtime behavior |
|----------------|------------------|
| `BLOCKED` / `LEGAL_HOLD` | Execution **refused**, fail-closed (`test_blocked_module_refuses_execution`) |
| `CLAIMED` | **Refused** — unverified claims never execute |
| Human-gated | Output produced as a **draft staged for approval**, never final |
| `DEMO` | Executes; output tagged `SIMULATED` |
| Unknown module | Refused, fail-closed |
| No handler | `NOT_EXECUTABLE` — the scaffold says so instead of pretending |

Every decision — including refusals — is appended to a sha256 hash-chained
decision log (`verify_log()` re-links the whole chain).

## Build states (measured, not asserted)

A module is **BOUND** when its declared implementation paths exist on disk
(checked against the filesystem, like the program manifest) and **EXECUTABLE**
when a Python handler is registered with the orchestrator. Current measured
state: **4 executable · 27 bound · 19 scaffold** of 50, with 11 human-gated.

Executable today:
- **Roofing Takeoff** (row 19) — real estimator math: pitch factor
  `sqrt(1+(rise/12)²)`, squares, waste by complexity, bundles, underlayment,
  ice & water (MA eaves code), ridge cap, drip edge. Pure and deterministic;
  prices nothing — pricing stays with the estimate engine and human approval.
- **Change Order Ledger** (row 8) — tamper-evident, append-only hash chain;
  approval requires a named human actor; net approved delta per job. The
  Postgres/Supabase migration remains the production gate; the chain semantics
  are storage-independent.
- **Sales Simulation Layer** (row 28) — bound to the GPPI engine; output
  always `SIMULATED`.
- **PermitStream zoning check** (row 14) — bound to the PermitStream agent's
  pure checklist logic.

Bound (artifacts exist, no runtime handler yet): Stephanie core, construction
intake/orchestration, scope & estimate, proposal generator, AWO flow, invoice
tracking, GCagent, KUZO layers, NBPT contracts, Cyborg, voice console, and
more — 27 in all. Scaffolds (19) are specs with no artifacts, labeled as such.

## LIVE tag discipline

An executed result carries the `LIVE` tag **only** for register-attested live
modules; everything else executes as `STAGED` at best, demos as `SIMULATED`.
The orchestrator cannot mint a LIVE claim the register didn't attest.
