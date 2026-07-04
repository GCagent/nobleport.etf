# NoblePort Master Smart Contract Registry v1

**Purpose:** One operator dashboard instead of scattered docs. Every contract
name that appears across NoblePort architecture artifacts, mapped to its *actual*
state — not its aspirational one.

**Date:** 2026-06-07
**Maintainer:** NoblePort engineering
**Not legal advice. Not an investment representation.**

---

## Status taxonomy

This registry uses one honest status word per contract. The bar for each is
deliberately strict, mirroring the repo's existing Operational Truth Matrix
(`backend/config/operational_truth.py`).

| Status | Means |
|--------|-------|
| **DEPLOYED** | A verified on-chain address exists. Requires a chain + address + explorer link as proof. |
| **IMPLEMENTED** | Solidity source exists in this repo, compiles, but is **not** deployed to any public network. |
| **DOCUMENTED** | Referenced in docs / dashboards / config, but **no contract source exists** in the repo. |
| **ROADMAP** | Spec or discussion item only. No source, no deployment. |
| **SIMULATION** | Exists only as a simulation report, metric, or narrative artifact. Not deployment evidence. |

> **Bottom line up front:** As of this date, **0 contracts are DEPLOYED** with
> verifiable on-chain proof. **4 are IMPLEMENTED** in this repo. The remaining
> named contracts are DOCUMENTED or ROADMAP. Simulation counts (5,000-tx
> compliance runs, validator counts, avatar governance events) are **not**
> deployment evidence and are tracked separately.

---

## Tier 1 — IMPLEMENTED (source in this repo, not deployed)

| Contract | Status | Chain | Owner | Purpose | Revenue link | Deployment proof | Risk |
|----------|--------|-------|-------|---------|--------------|------------------|------|
| `HumanApprovalGateway.sol` | IMPLEMENTED | none (testnet target) | Governance multisig (planned) | Mandatory human-in-the-loop approval for legal/medical/financial decisions | Indirect — gates all regulated flows | None (not deployed) | Low engineering risk; high importance. Needs audit before relied upon. |
| `MassachusettsBuildingPermits.sol` | IMPLEMENTED | none (testnet target) | State/municipality roles (planned) | On-chain MA 780 CMR permit lifecycle | Indirect — supports PermitStream | None | Medium — large surface; needs audit + real municipal integration to be more than a model. |
| `NBPTSecurityToken1400.sol` | IMPLEMENTED | none (testnet target) | Governance multisig (planned) | White-label ERC-1400 security token for NBPT, USDC-pegged subscription/redemption. Configurable per-asset (name/symbol/`tokenDetails` + `granularity`) for single-parcel land tokenization — see [land-parcel playbook](./erc1400-land-parcel-playbook.md). | **Direct if/when live** — token subscriptions/redemptions | None | **High regulatory risk.** Issuing a security. Hard-gated by `liveOfferingCleared` (Cooley gate) — no real money until counsel clears. See [erc1400-nbpt-usdc.md](./erc1400-nbpt-usdc.md). |
| `NoblePortConstructionEscrow.sol` | IMPLEMENTED | none (Base testnet target) | Governance multisig + NoblePort approvers (planned) | Human-approved USDC milestone escrow for construction draws (permit deposit, foundation, framing, dry-in, finish, holdback). Subordinate to the approval chain — three on-chain human keys (homeowner + NoblePort + verifier) **plus** an EXECUTED FINANCIAL `HumanApprovalGateway` decision per release. EIP-3009 (`receiveWithAuthorization`) funding. **No AI authority, no autonomous release.** | **Direct (construction)** — milestone payments | None | **Low securities risk** (payment escrow, not a financing/ownership instrument). Construction-only. Needs audit before mainnet. See [usdc-construction-escrow.md](./usdc-construction-escrow.md). |

---

## Tier 2 — DOCUMENTED (named in docs/config, no source in repo)

These appear in dashboards, mock data, config, or whitepapers. **No `.sol`
source exists for any of them in this repository.** Treat as architecture intent,
not built systems.

| Contract | Status | Purpose (as described) | Where referenced | Revenue link | Deployment proof | Risk |
|----------|--------|------------------------|------------------|--------------|------------------|------|
| `AuditBeacon.sol` | DOCUMENTED | Audit trail / notarization anchoring | Exists only as a **Python agent** (`backend/agents/audit_beacon.py`), not a contract | Indirect | None | Name collision risk — the agent is real, the *contract* is not. Clarify naming. |
| ERC-1400 NBPT "layer" (legacy refs) | DOCUMENTED→IMPLEMENTED | Security token, transfer restrictions, fixed 100M supply narrative | `backend/api/dashboard.py`, `src/lib/dashboard/mock.ts`, `src/app/dashboard/compliance/page.tsx` | Direct (future) | None | The narrative (incl. "100M fixed supply", "5,000-tx simulations") predates real source. Now superseded by `NBPTSecurityToken1400.sol`; reconcile dashboard copy to match the actual contract. |
| `NPCAgreement.sol` | DOCUMENTED | Construction governance / AIA/HIC workflow automation | Architecture docs | Direct (construction) | None | No source. Revenue-relevant — good candidate to build next. |
| `RealEstateNFT.sol` | DOCUMENTED | ERC-721 property module, title + rent streaming | Architecture docs | Direct (rent) | None | No source. Securities implications if fractionalized. |
| `RealEstateClosing.sol` | DOCUMENTED | Closing / commission enforcement | Architecture docs | Direct (commission) | None | No source. Touches real-estate licensing law. |
| `SBTFactory.sol` | DOCUMENTED | zk-SBT identity issuance, compliance gating | Architecture docs | Indirect | None | No source. Privacy/zk claims unverified. |
| `ZoneMintSEA.sol` | DOCUMENTED | Zoning NFT minting pipeline | Architecture docs | Indirect | None | No source. |
| `ZoningCourt.sol` | DOCUMENTED | Dispute resolution, VRF/randomized governance | Architecture docs | Indirect | None | No source. "AI arbitration" claims need legal review. |
| `NPETF.sol` | DOCUMENTED | Tokenized ETF engine, RE/equity-backed | Financial architecture docs | Direct (future) | None | No source. **Securities + 1940 Act exposure.** Counsel-gated like ERC-1400. |
| `TreasuryBotV3.sol` | DOCUMENTED | Treasury routing / yield automation | Architecture docs | Indirect | None | No source. Automated treasury = regulated-activity-adjacent; keep human-gated. |
| `FiatRouter.sol` | DOCUMENTED | Fiat → stablecoin routing (Stripe/Mercury refs) | Architecture docs | Direct | None | No source. **Money transmission / MSB exposure** — needs counsel. |
| `BondStreamLinker.sol` | DOCUMENTED | Bond NFT / yield streaming | Architecture docs | Direct (future) | None | No source. **Securities exposure** (yield instruments). |
| Snapshot governance integration | DOCUMENTED | DAO voting sync | Governance workflow docs | None | N/A (off-chain) | Off-chain tool, not a contract. |
| Aragon / DAO stack | DOCUMENTED | Governance framework, epoch governance | Architecture docs | None | None | Third-party framework; not custom-built here. |

---

## Tier 3 — ROADMAP (spec/discussion only)

From the "Smart Contracts for Trades & Construction" roadmap. **Not evidence of
deployed systems.** Construction-adjacent items are the most directly
revenue-relevant and least securities-entangled — likely the best place to build
real on-chain value first.

| Item | Status | Revenue relevance | Securities entanglement |
|------|--------|-------------------|-------------------------|
| TradeCred zk-SBT License Verification | ROADMAP | High (construction) | Low |
| Progress Payment Escrow | **IMPLEMENTED** → `NoblePortConstructionEscrow.sol` | High | Low |
| Milestone Release Escrow | **IMPLEMENTED** → `NoblePortConstructionEscrow.sol` | High | Low |
| Contractor Bonds | ROADMAP | Medium | Low–Medium |
| PermitStream Payment Logic | ROADMAP | High | Low |
| Supply Chain Tracking | ROADMAP | Medium | Low |
| Workforce Credential Verification | ROADMAP | Medium | Low |
| Dispute Resolution Contracts | ROADMAP | Medium | Medium |
| Tokenized Contractor Reputation | ROADMAP | Low–Medium | Low |
| Governance / Voting Layers | ROADMAP | Low | Low |

---

## Tier 4 — SIMULATION / NARRATIVE (not deployment proof)

Tracked explicitly so they are never read as on-chain capability:

- 5,000-transaction compliance simulations
- ERC-1400 transfer-restriction simulations
- DAO enforcement simulations
- Permit validation simulations
- Cross-chain compliance simulations
- Avatar governance events
- Large validator / deployment-metric counts

These are reports, architecture narratives, or test artifacts. None is equivalent
to a verified on-chain deployment. Avatar deployment artifacts and governance
reports, however extensive, are **not** proof of contract deployment.

---

## Scorecard

| Bucket | Count |
|--------|-------|
| DEPLOYED (verified on-chain) | **0** |
| IMPLEMENTED (source in repo) | **4** |
| DOCUMENTED (named, no source) | ~12 |
| ROADMAP (spec only) | 20+ |
| SIMULATION/narrative artifacts | several |

**Directly revenue-generating + low securities risk + buildable now:** the
construction-escrow / credentialing subset (Tier 3). **Highest revenue but
counsel-gated:** the token/finance layer (`NBPTSecurityToken1400`, `NPETF`,
`BondStreamLinker`, `FiatRouter`).

---

## How to promote a row

1. **DOCUMENTED → IMPLEMENTED:** write the `.sol`, unit tests, and an entry in
   `contracts/`. Update this table.
2. **IMPLEMENTED → DEPLOYED:** independent security audit → testnet deploy →
   (for securities/finance contracts) counsel clearance via the
   `HumanApprovalGateway` LEGAL gate → mainnet deploy. Record chain + address +
   explorer link in the **Deployment proof** column. No row may be marked
   DEPLOYED without that link.

A contract is only as real as its proof column. Keep this registry honest and it
doubles as the diligence artifact an auditor, counsel, or investor will ask for.
