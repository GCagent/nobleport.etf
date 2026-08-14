# NoblePort Smart Contract Architecture Map

This document is the canonical reference for what the NoblePort smart contract
stack actually is — separating shipped code from staged code from modeled
designs from aspirational targets.

External reviewers, counsel, and partners should read this before treating any
specific contract reference in marketing or whitepaper material as
operational reality.

## Status legend

| Label       | Meaning                                                                                              |
|-------------|------------------------------------------------------------------------------------------------------|
| LIVE        | Deployed to a public production network, addressable, and exercised by real traffic                  |
| STAGED      | Solidity source committed to this repo, not deployed to mainnet (or only on local/testnet)           |
| SIMULATED   | Described in design docs / whitepaper; no production-grade source in this repo                       |
| TARGET      | Aspirational roadmap item; no design or code yet, only intent                                        |

A contract being STAGED is **not** the same as it being operational.
Anything that says LIVE must be backed by a deployment address and an
on-chain transaction history.

## Repository state at a glance

Two `.sol` files exist on this branch:

- `contracts/HumanApprovalGateway.sol`
- `contracts/MassachusettsBuildingPermits.sol`

Everything else listed below is either SIMULATED in design materials or
TARGET on the roadmap. That gap is the single most important fact in this
document.

---

## 1. Construction Governance

| Contract             | Status     | Source                                | Notes                                                                 |
|----------------------|------------|---------------------------------------|----------------------------------------------------------------------|
| NPCAgreement.sol     | SIMULATED  | —                                     | AIA/HIC-aligned work-order enforcement, milestone tracking, payment coordination. Highest real-world commercial value in the stack — ties to licensed GC workflows, real projects, real disputes. |

Operational priority: this is the contract category with the strongest
real-world moat. Most Web3 projects cannot legitimately reach into licensed
contractor workflows. Build this before token mechanics.

---

## 2. Permit + Zoning

| Contract                          | Status   | Source                                          | Notes                                                                                       |
|-----------------------------------|----------|-------------------------------------------------|--------------------------------------------------------------------------------------------|
| MassachusettsBuildingPermits.sol  | STAGED   | `contracts/MassachusettsBuildingPermits.sol`    | Full 780 CMR permit lifecycle: municipalities, applications, inspections, fees, COs. ~1,250 LOC, OpenZeppelin AccessControl + Pausable + ReentrancyGuard. Not deployed. |
| PermitStream.ai                   | SIMULATED | —                                              | AI-augmented permit pipeline, oracle-fed jurisdictional rules                              |
| ZoningCourt.sol                   | SIMULATED | —                                              | Zoning dispute arbitration, DAO-linked permit decisions                                    |
| ZoneMintSEA.sol                   | SIMULATED | —                                              | Seattle-specific zoning overlay validator                                                  |

Strategic note: the differentiation potential here is real. The blocker is
jurisdictional accuracy — zoning overlays, edge cases, and manual-intervention
requirements remain unsolved by smart contracts alone. Treat municipal logic
as messy by default; design for human override, not pure automation.

---

## 3. Identity + Compliance

| Contract             | Status     | Source | Notes                                                                                       |
|----------------------|------------|--------|--------------------------------------------------------------------------------------------|
| SBTFactory.sol       | SIMULATED  | —      | Non-transferable soulbound credentials for contractors, investors, permit authorities      |
| zk-SBT Framework     | SIMULATED  | —      | Privacy-preserving credential proofs                                                       |
| SnapshotSyncModule   | SIMULATED  | —      | DAO permission sync against credential state                                               |

The non-transferable credential layer matters more than most participants
realize. AI/regulatory direction is moving toward identity-bound
accountability and audit trails. Build this in parallel with construction
governance, not after.

---

## 4. Treasury + DeFi

| Contract              | Status     | Source | Notes                                                                                        |
|-----------------------|------------|--------|---------------------------------------------------------------------------------------------|
| TreasuryBotV3.sol     | SIMULATED  | —      | Treasury allocation / yield routing                                                          |
| FiatRouter.sol        | SIMULATED  | —      | Stripe / Mercury → USDC settlement                                                          |
| BondStreamLinker.sol  | SIMULATED  | —      | Streaming bond yields                                                                        |
| NPETF.sol             | SIMULATED  | —      | ETF-style tokenized exposure                                                                 |

**Highest regulatory-risk category in the system.** ETF framing, yield
language, and tokenized investment exposure require outside securities
counsel before any code is shipped, let alone deployed. Do not pre-announce
addresses. Do not market projected APYs.

---

## 5. Token Contracts

| Contract            | Status     | Source | Notes                                                                                       |
|---------------------|------------|--------|--------------------------------------------------------------------------------------------|
| NBPT                | TARGET     | —      | Utility/governance token. No source committed. No public sale. No deployment.              |
| ERC-1400 Layer      | TARGET     | —      | Transfer restrictions, KYC/AML enforcement, partition management, forced transfer support  |

Whitepaper language is correctly disciplined here: **not launched, metrics
are projections, no public sale.** Maintain that exact framing in every
external surface. Any deviation is a securities-law exposure.

---

## 6. Governance

| Layer                   | Status     | Source | Notes                                                                                       |
|-------------------------|------------|--------|--------------------------------------------------------------------------------------------|
| Snapshot + Aragon OSx   | SIMULATED  | —      | Off-chain discussion → weighted vote → IPFS anchor → on-chain execution → audit log         |
| HumanApprovalGateway    | STAGED     | `contracts/HumanApprovalGateway.sol` | Mandatory human-in-the-loop for LEGAL / MEDICAL / FINANCIAL decisions. ~900 LOC. Domain quorum, cool-down, escalation, automated-action blocker. Not deployed. |

Hybrid governance is the right pattern: off-chain coordination, on-chain
verification. Pure on-chain governance typically fails operationally at
this stage.

`HumanApprovalGateway` is one of the two contracts with actual source. It is
the architectural anchor for AI-law compliance — `blockAutomatedAction()`
permanently reverts, forcing every AI/automated agent through
`proposeDecision → submitHumanApproval → executeDecision`. This is the
correct fail-closed posture.

---

## 7. Infrastructure / Audit

| Contract              | Status     | Source | Notes                                                                                       |
|-----------------------|------------|--------|--------------------------------------------------------------------------------------------|
| AuditBeacon.sol       | SIMULATED  | —      | Event notarization, proof anchoring, audit integrity                                       |
| Oracle layers         | SIMULATED  | —      | Inputs for permitting, valuation, compliance                                               |
| Chainlink integration | TARGET     | —      | No adapter wired up yet                                                                    |

Foundational for municipal credibility and institutional onboarding. Cannot
be skipped if the goal is anything beyond a token project.

---

## 8. Real Estate

| Contract                 | Status     | Source | Notes                                                                                       |
|--------------------------|------------|--------|--------------------------------------------------------------------------------------------|
| RealEstateNFT.sol        | SIMULATED  | —      | Deed representation, title linkage, rent streaming                                          |
| RealEstateClosing.sol    | SIMULATED  | —      | Commission enforcement, closing flow                                                        |

The smart contract is not the hard part here. Enforceability, title
recognition, transfer law, and securities treatment are. Do not ship until
counsel confirms a specific jurisdiction is workable.

---

## 9. KUZO Safe Swap Layer

| Component                | Status     | Notes                                                                                       |
|--------------------------|------------|--------------------------------------------------------------------------------------------|
| Execution endpoint        | STAGED (fail-closed) | `POST /api/swap/execute` returns HTTP 403 by policy                                |
| Allowlist                 | SIMULATED  | Counterparty / token allowlist design only                                                  |
| Slippage + notional caps  | SIMULATED  | Documented parameters, not enforced in deployed code                                        |
| Replay protection         | SIMULATED  | Nonce/sig scheme described                                                                  |
| Immutable audit log       | SIMULATED  | Design specified, no production implementation                                              |
| Kill switch               | SIMULATED  | Design only                                                                                  |

Architecturally the most mature design section in the stack. The
fail-closed `403` posture during staging is correct institutional-grade
behavior — do not relax it without all of: allowlist live, caps enforced,
replay protection wired, audit log immutable, kill switch tested.

---

## 10. Project Certificates

| Contract                          | Status     | Source | Notes                                                                                       |
|-----------------------------------|------------|--------|--------------------------------------------------------------------------------------------|
| NoblePortProjectCertificate.sol   | TARGET     | —      | On-chain project completion certificate; minted on permit closeout, IPFS docs attached      |

Commercially viable if kept simple: project approved → inspections passed →
certificate minted → owner receives immutable project record. This is a
natural extension of `MassachusettsBuildingPermits.sol` and should be
sequenced after that contract is deployed and exercised, not before.

---

## Operational priority (read this if nothing else)

The real moat is not avatars, token speculation, or DAO branding. It is, in
order:

1. Construction workflow automation (NPCAgreement)
2. Permit intelligence (MassachusettsBuildingPermits + jurisdictional siblings)
3. Compliance enforcement (HumanApprovalGateway)
4. Payment + escrow orchestration (FiatRouter, TreasuryBotV3)
5. Immutable project records (NoblePortProjectCertificate, AuditBeacon)
6. Identity + audit systems (SBTFactory, zk-SBT)
7. AI-assisted operational execution (off-chain agents gated by HumanApprovalGateway)

The token layer only matters if the operational layer works first. Every
external communication should reflect that ordering.

## Document maintenance

When a contract moves between status tiers, update the relevant row in this
file in the same commit as the underlying change. A status promotion from
STAGED to LIVE requires:

- Deployment transaction hash
- Network and address
- Verification on the block explorer
- Link to the audit (if any)

Do not promote anything to LIVE on the basis of marketing copy.
