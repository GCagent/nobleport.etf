# zkSBT Lifecycle — Workflow Review & Corrected Spec (v1)

**Reviewed:** the "zkSBT Lifecycle in NoblePort RWA" diagram (operator-provided,
2026-06-13): Issuance, Verification, Revocation, and Harvey Workflow
Integration flows.
**Operator direction:** *human gate in all major decisions* — adopted as a
hard rule below.
**Status:** design spec. All four flows are **ROADMAP** — no zk circuits, SBT
contract, or Harvey integration exists in this repo. This document is the
design answer for attestation registry records `NP-ATT-ZKF-001/-003/-006/-007`.
**Not legal advice. Counsel-gated end to end (Cooley gate).**

---

## Review findings

### Design-breaking (must change)

1. **ERC-5114 cannot support revocation.** ERC-5114 ("Soulbound Badge")
   binds a badge to an *NFT*, not a wallet, and is deliberately immutable —
   no burn, no revocation, ever. The diagram's Wallet Opt-in step and entire
   Revocation Flow are incompatible with it. **Replace with ERC-5484**
   (consensual soulbound token): its mint-time consent matches Wallet
   Opt-in, and its declared `burnAuth` makes Burn/Blacklist real. KYC-backed
   credentials must be revocable; this is non-negotiable.

2. **No human appeared in any flow.** Stephanie.ai issued credentials,
   monitored, and decided revocation alone. Corrected below: every major
   decision routes through the decision gate
   (`backend/governance/stephanie_gate.py` → `HumanApprovalGateway` pattern)
   with a named human approver.

### Significant (corrected in the spec)

3. **IPFS/Arweave received credential material.** Arweave is permanent;
   anything derived from KYC PII stored there is unerasable. Rule:
   **only hash commitments, proofs, and revocation-registry entries are
   anchored — never PII or raw credentials.**
4. **Proof generation sat on the platform side.** The *holder* generates zk
   proofs in their wallet; the platform only verifies. Otherwise "KYC
   verified without disclosure" is false — the platform would see everything.
5. **Failure edges were incomplete.** Block Action branched only from
   Contract Checks; an invalid proof at Result had no fail path.
6. **Revocation ordering.** Notify/Audit floated before the decision.
7. **Harvey undefined.** A named actor absent from every NoblePort record.
   If Harvey is a legal-AI integration, its output is legal work product:
   `legal_opinion` is a **BLOCKED** action class in the authority matrix, so
   a licensed-attorney review step is mandatory before any Signature Gate.

---

## Corrected flows

**HITL rule (operator-mandated):** every step marked `⛔ HUMAN GATE` runs
through the decision gate, is approved by a named human, and lands on the
hash-chained audit ledger. Fail closed: no approval, no action.

### 1 · Issuance

```
User Onboard → KYC/AML Check (licensed provider) → Stephanie.ai prepares
credential DRAFT → ⛔ HUMAN GATE: issuance approval (compliance officer)
→ Wallet Opt-in (ERC-5484 consent) → Mint zkSBT (ERC-5484) → On-chain Issue
→ anchor COMMITMENT HASH ONLY to IPFS/Arweave
```

### 2 · Verification

```
Verifier request → holder's WALLET generates zk proof → platform verifies
proof + contract checks → Result:
   pass → Proceed (log to audit chain)
   fail → Block Action → Log Incident → escalate if repeated
```
No human gate needed on the happy path — verification is read-only. Block
Action escalations follow the standard gate.

### 3 · Revocation

```
Stephanie Monitor detects credential change → evidence package drafted
→ ⛔ HUMAN GATE: Revoke? (compliance officer; counsel if contested)
→ Burn (ERC-5484 burnAuth) + Blacklist entry → propagate to the SHARED
ALLOWLIST ROOT (both chains, per dual-token spec) → Audit Update (anchor
revocation-registry entry hash) → Notify User (with appeal path)
```

### 4 · Harvey workflow integration

```
Doc Access Gate (zkSBT check) → Review Gate (zkSBT re-check)
→ ⛔ HUMAN GATE: licensed-attorney review of any legal work product
→ Signature Gate: zkSBT FRESH re-verification + revocation-registry check
   (mandatory — credentials can be revoked mid-workflow) + HSM signing
→ Txn Complete → Immutable Log
```
Freshness policy: proofs carry an expiry; the Signature Gate never accepts
a cached verification.

## What stays from the original

The four-flow structure, Wallet Opt-in consent, Block Action + Log Incident
fail path, HSM at signing, immutable logging, and the monitor-driven
revocation trigger are all sound and retained.

## Build order (when this leaves ROADMAP)

1. ERC-5484 credential contract + revocation registry (testnet) — replaces
   the no-source `SBTFactory.sol` placeholder.
2. Wire issuance/revocation approvals through the existing decision gate —
   the gate and audit chain are already built and tested.
3. Holder-side proof tooling (circuit selection is its own design doc).
4. Harvey integration last — after the licensed-reviewer loop is defined.
