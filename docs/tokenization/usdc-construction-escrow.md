# Human-Approved USDC Construction Escrow

**Status:** Engineering implemented ahead of deployment. Testnet target.
**Contract:** [`contracts/NoblePortConstructionEscrow.sol`](../../contracts/NoblePortConstructionEscrow.sol)
**Classification:** Construction-only. Subordinate to the human approval chain.
**Not legal advice. Not an investment representation.**

---

## 1. The governance distinction this is built against

The general architecture for a USDC-enabled application is directionally
correct. For NoblePort specifically, the on-chain payment layer is built to a
narrower mandate than a generic "smart-contract escrow" pitch implies.

**Appropriate for NoblePort today, and what this contract serves:**

- Payment collection, invoice settlement, deposit tracking
- Approval-gated payment workflows
- Escrow-style milestone releases **with human approval**
- Audit logging and reconciliation

**Explicitly out of scope — not verified, not coded for:**

- Autonomous AI settlement decisions
- AI-triggered fund releases without human approval
- Production smart-contract escrow handling client funds **on mainnet** (this is
  testnet-target until audited and cleared)
- On-chain construction *financing* products
- Investment, security, equity, or tokenized-ownership structures (that is the
  counsel-gated [ERC-1400 layer](./erc1400-nbpt-usdc.md), a different regime)

The NoblePort Payment Node is classified **P0-HARDENED / STAGING** and
**construction-only**. This blockchain payment layer is **subordinate to the
approval chain** — it holds funds and records authorizations; it does not decide.

---

## 2. The four layers

### Layer 1 — Contract execution
A simple, reviewable escrow. Per-milestone tranches with four states
(`PENDING → FUNDED → RELEASED | REFUNDED`). The money-moving surface is just:

| Action | Function | Who | Gate |
|--------|----------|-----|------|
| Fund a tranche | `fundMilestone` / `fundMilestoneWithAuthorization` | Homeowner / relayer | Project not cancelled |
| Release to contractor | `releaseMilestone` | NoblePort | **Full human gate (Layer 2) + EXECUTED FINANCIAL gateway decision** |
| Refund to homeowner | `refundMilestone` | NoblePort + homeowner consent, or governance | Dual control |

**No AI authority. No autonomous release.** There is no timelock that pays out
on its own, and there is no role an automated agent can hold that moves funds.

### Layer 2 — The human approval gate
Before any release, three independent on-chain keys plus the off-chain gateway
decision must all be present:

```
  Homeowner Approval                  (the payer signs off)
+ NoblePort Approval                  (NOBLEPORT_APPROVER_ROLE)
+ Milestone Verification              (MILESTONE_VERIFIER_ROLE / inspector)
+ EXECUTED FINANCIAL gateway decision (HumanApprovalGateway, licensed quorum)
───────────────────────────────────────────────
= Release Authorized
```

Each key is idempotent and individually revocable while the tranche is still in
escrow (a defect found after sign-off but before release blocks the payout).
This mirrors the existing off-chain flow:

```
Lead Intake → Estimate → Contract → Payment Node → Production → Closeout
```

The gateway decision is verified **live at release time** (`domain == FINANCIAL
&& status == EXECUTED`), not trusted from storage — the same
[`HumanApprovalGateway`](../../contracts/HumanApprovalGateway.sol) the ERC-1400
layer already routes money-movement through.

### Layer 3 — USDC authorization
Two funding paths:

- **`fundMilestone`** — standard ERC-20 `approve` + pull. Simple, familiar.
- **`fundMilestoneWithAuthorization`** — EIP-3009 signed authorization.

For the EIP-3009 path we use USDC's **`receiveWithAuthorization`**, not plain
`transferWithAuthorization`. The advantages the architecture wants —
**no persistent allowance, a clean one-time authorization, a cleaner audit
trail, better homeowner UX** — all hold, and `receiveWithAuthorization`
additionally closes the front-running window by requiring `msg.sender == to`, so
the signed authorization can *only* fund this escrow. The homeowner signs once
per deposit; NoblePort or any relayer submits it.

```
Invoice Generated
      ↓
Homeowner Signs Authorization   (EIP-3009, one-time, no standing allowance)
      ↓
Authorization Submitted → tranche FUNDED
      ↓
Human Approval Gate (Layer 2)
      ↓
USDC Released to Contractor
```

### Layer 4 — Construction escrow logic
Milestones map straight onto NoblePort's contract payment schedules. A typical
new-build draw schedule:

| Milestone | % |
|-----------|---|
| Permit Deposit | 10% |
| Foundation | 25% |
| Framing | 25% |
| Dry-In | 25% |
| Finish | 10% |
| Final Inspection (holdback) | 5% |

Each milestone is one escrow tranche, funded and released independently.

#### Worked example — 95 Clipper Way

A five-payment schedule (total **$80,000** at 6-decimal USDC base units):

| Tranche | Amount | USDC base units |
|---------|--------|-----------------|
| Payment #1 | $23,750 | `23750000000` |
| Payment #2 | $23,750 | `23750000000` |
| Payment #3 | $23,750 | `23750000000` |
| Payment #4 | $23,750 | `23750000000` |
| Payment #5 | $4,750 | `4750000000` |

`createProject(ref, homeowner, contractor, labels, amounts)` with those five
amounts produces five tranches; each runs the full Layer-2 gate before release.

---

## 3. Recommended network

USDC issued by **Circle**, deployed on **Base** for NoblePort:

- Low fees, large ecosystem, strong USDC support, easy wallet onboarding
- Matches the existing NoblePort wallet stack (Base is the primary chain — see
  [`docs/wallet-integration.md`](../wallet-integration.md))
- Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

**Noble** (Cosmos-native USDC, enterprise settlement) remains a credible second
rail for treasury-grade settlement and interoperability, but Base is the
shortest path to a working homeowner-facing flow today.

---

## 4. Rollout — what to build first

**Phase 1 — USDC invoice payment (human-approved).**
USDC invoice payment → human approval required → Payment Node ledger entry →
receipt generation. This is the lowest-risk, highest-utility starting point.

**Phase 2 — Milestone escrow (dual approval).**
Milestone escrow → dual approval → USDC release. The contract here implements
this with the three-key + gateway gate.

**Phase 3 — Specialized escrows.**
Permit-deposit escrow, construction-draw escrow, final-inspection holdback
escrow — all expressed as milestone tranches over the same contract.

**Deliberately deferred until verified production governance, audited contracts,
and a complete human-approval framework exist:** AI-controlled escrow release.
For NoblePort's current stage, a human-approved USDC escrow tied into the
existing Payment Node and eSign workflow is the safest and most practical path.

---

## 5. Roles

| Role | Responsibility |
|------|----------------|
| `GOVERNANCE_ADMIN_ROLE` | Gateway config, pause/unpause, project cancel, governance refunds, stray-token rescue. Wire to a multisig. |
| `NOBLEPORT_APPROVER_ROLE` | Create projects, NoblePort sign-off key, execute releases/refunds. |
| `MILESTONE_VERIFIER_ROLE` | Independent milestone verification (site inspector / PM). |
| `PAUSER_ROLE` | Emergency pause. |
| *(no role)* — homeowner | Sets their own approval key; receives refunds. Identified per-project, not by a global role. |

The constructor grants every role to the deployer/admin; split them to dedicated
signers immediately after deployment.

---

## 6. What is explicitly NOT done here

- **No mainnet deployment.** No addresses, no real client USDC moved.
- **No AI / automation release path.** No role an agent can hold moves funds; no
  time-based auto-release.
- **No financing, investment, or ownership instrument.** This is a payment
  escrow, not a security. The securities layer is separate and counsel-gated.
- **No independent audit yet.** Required before mainnet (see registry promotion
  rules).

---

## 7. Pre-go-live checklist

- [ ] Independent smart-contract security audit completed.
- [ ] Roles split from the deployer to dedicated multisig / signer addresses.
- [ ] `HumanApprovalGateway` deployed and wired; FINANCIAL quorum operational.
- [ ] Testnet dry-run on Base Sepolia: fund → three-key gate → release, and a
      release correctly **reverts** when any key or the gateway decision is missing.
- [ ] Payment Node ledger reconciliation against on-chain `MilestoneReleased` /
      `MilestoneRefunded` events.
- [ ] Refund (dispute) path exercised end-to-end.
