# White-Label ERC-1400 for NBPT, Pegged to USDC

**Status:** Engineering built ahead of legal clearance. Testnet-only.
**Contract:** [`contracts/NBPTSecurityToken1400.sol`](../../contracts/NBPTSecurityToken1400.sol)
**Go-live gate:** `liveOfferingCleared` (defaults `false`) — the "Cooley gate."
**Not legal advice.** Counsel is the call.

---

## 1. The honest read this is built against

The technical description of ERC-1400 is accurate. It is a security-token
standard family (Polymath, 2018): modular, ERC-20-compatible, with partitions
(ERC-1410), transfer restrictions (ERC-1594), document hashes (ERC-1643), and a
controller / forced-transfer role (ERC-1644). For a compliantly tokenized real
estate interest, that family — or ERC-3643 — is the right tooling. The standard
is not the problem.

The *wrapper* around it is where care is required. Three things, named plainly,
that this implementation deliberately refuses to paper over:

1. **A construction or real-estate license confers zero authority to issue
   securities.** CSL, HIC, and broker licenses live in a different regulatory
   world from a securities offering. Tokenizing project equity or revenue shares
   *is* issuing a security. That requires a valid exemption or registration,
   accredited-investor verification meeting the SEC's "reasonable steps" bar, real
   disclosures, and — depending on the activity — a registered broker-dealer.
   Conflating a broker license with a securities offering is the single most
   dangerous move available here, so the code does not let licensing stand in for
   clearance.

2. **A securities offering is not a 90-day engineering sprint.** Building the
   engine early is fine. Raising real money from real people before the offering
   structure is cleared is the textbook unregistered-offering exposure. The
   legal/structuring timeline dwarfs the code timeline. The launch scorecard sits
   at HOLD pending written sign-off, and this contract is written so that HOLD
   cannot be coded around: no real value moves while `liveOfferingCleared` is
   `false`.

3. **The reference deployments prove the apparatus, not its absence.** Aspen Coin
   (St. Regis, Reg D 506(c) through a registered broker-dealer) and RealT all ran
   through full compliance and broker-dealer infrastructure. They demonstrate that
   tokenization works *with* the apparatus — they are not evidence that the
   apparatus is optional.

What is genuinely fine, and what this directory is: building the ERC-1400
engineering ahead of clearance, on testnet, with nothing live until counsel
clears it. Stephanie.ai (or any agent) "orchestrating the issuance/redemption
lifecycle" is regulated-activity-adjacent and stays under licensed human review —
encoded here via the `HumanApprovalGateway` reference on every money-moving path.

---

## 2. What is implemented

`NBPTSecurityToken1400.sol` implements a coherent, reviewable subset of the
ERC-1400 family plus a USDC subscription/redemption rail.

| Standard | Surface implemented |
|----------|---------------------|
| ERC-20 | `name`, `symbol`, `decimals` (18), `totalSupply`, `balanceOf`, `transfer`, `transferFrom`, `approve`, `allowance` — every transfer routes through the compliance check |
| ERC-1410 (partitions) | `balanceOfByPartition`, `partitionsOf`, `transferByPartition`, `operatorTransferByPartition`, operator authorization (global + per-partition) |
| ERC-1594 (restrictions) | `canTransfer` / `canTransferByPartition` (ERC-1066 status bytes), `issue` / `issueByPartition`, `redeem` / `redeemByPartition`, `isIssuable`, one-way `closeIssuance` |
| ERC-1643 (documents) | `setDocument`, `getDocument`, `getAllDocuments`, `removeDocument` (hash + URI for prospectus, subscription agreement, PPM, etc.) |
| ERC-1644 (controller) | `controllerTransfer`, `controllerRedeem` (forced transfer for court orders / key recovery), one-way `disableControllability` |

### White-label configuration

The token is white-label: a single deployment can be configured to a specific
issuer or asset (e.g. a land parcel) without changing code.

- `setTokenMetadata(name, symbol, tokenDetails)` (governance) — set the legal
  entity name, ticker, and an IPFS/URI `tokenDetails` pointer to the off-chain
  document set. Mirrors the ERC-1400 `_tokenDetails` convention.
- `granularity` + `setGranularity(unit)` (governance, pre-issuance only) — the
  smallest tradable unit (ERC-1410). Every issued/transferred/redeemed/subscribed
  amount must be an exact multiple. Defaults to `1` (fully divisible); settable
  only while `totalSupply == 0` so balances can never be stranded.

For a worked single-parcel configuration, see the
[land-parcel tokenization playbook](./erc1400-land-parcel-playbook.md).

### USDC peg

- `usdc` (immutable) + `usdcDecimals` recorded at deploy.
- `pegPriceUSDC`: USDC base units per `1e18` NBPT. Defaults to par (1 NBPT = 1
  USDC); governance can update it to track NAV.
- `subscribe(partition, usdcAmount, decisionId)`: pay USDC → receive newly issued
  NBPT.
- `redeemForUSDC(partition, tokens, decisionId)`: burn NBPT → receive USDC from
  the reserve.
- `depositReserve` / `withdrawReserve`: manage the USDC redemption reserve (e.g.
  funded from rental income / NAV).

---

## 3. How the compliance posture is enforced in code

### The Cooley gate (`liveOfferingCleared`)
Defaults to `false`. While `false`, **every real-money path reverts**:
`issue` / `issueByPartition`, `subscribe`, `redeemForUSDC`, and
`withdrawReserve`. The only way to set it `true` is
`setLiveOfferingClearance(true, decisionId, attestation)`, which requires:

- an **EXECUTED** `HumanApprovalGateway` **LEGAL** decision id (counsel's
  recorded sign-off), and
- a non-zero `attestation` hash of counsel's written clearance.

Governance can flip it back to `false` at any time (emergency HOLD) without those
references. There is no other enable path. Testnet dry-runs deploy with the gate
`false` and verify that operations correctly revert before any flip.

### Accreditation is verifier-attested, never self-asserted
`setAccreditation` is callable only by `ACCREDITATION_VERIFIER_ROLE`, and only
with an evidence hash and a future expiry. This is the on-chain anchor for the
Rule 506(c) "reasonable steps" record. A self-asserted accreditation claim — a
soulbound token an investor mints for themselves — does **not** satisfy that bar
and must not be wired into this function.

### Human-in-the-loop on money movement
`subscribe` and `redeemForUSDC` above `humanReviewThresholdUSDC` require a
referenced **EXECUTED FINANCIAL** `HumanApprovalGateway` decision. No automation
or AI agent can push investor money past that threshold unattended.

### Standard securities controls
- Per-investor `kycVerified`, `frozen`, `lockupUntil`.
- `accreditationRequired` toggle (Reg D 506(c) style).
- `defaultLockupPeriod` (Rule 144 style holding period) applied at issuance.
- Account-level freeze and controller forced-transfer for legal/regulatory
  directives.

---

## 4. Roles

| Role | Responsibility |
|------|----------------|
| `GOVERNANCE_ADMIN_ROLE` | Launch gate, peg price, gateway config, pause, one-way switches |
| `ISSUER_ROLE` | Issue tokens (only when live + recipient compliant) |
| `CONTROLLER_ROLE` | Forced transfer / redemption (court order, key recovery) |
| `KYC_OFFICER_ROLE` | KYC status, freezes, lock-ups |
| `ACCREDITATION_VERIFIER_ROLE` | Verifier-attested accreditation determinations |
| `DOCUMENT_MANAGER_ROLE` | Offering documents (ERC-1643) |

Wire `GOVERNANCE_ADMIN_ROLE` and `CONTROLLER_ROLE` to multisigs, and the legal
clearance flow to the existing `HumanApprovalGateway` LEGAL quorum.

---

## 5. What is explicitly NOT done here

- **No mainnet deployment.** No deployment addresses, no real USDC.
- **No offering.** No PPM, no subscription agreement, no Form D, no accredited
  verification vendor wired in.
- **No claim** that any license substitutes for securities counsel or a
  broker-dealer.

These are counsel-gated and out of engineering scope until the Cooley gate opens.

---

## 6. Pre-go-live checklist (counsel-owned, not engineering)

- [ ] Offering structure cleared in writing by securities counsel (Cooley).
- [ ] Exemption/registration path chosen (e.g. Reg D 506(c)) and filings prepared.
- [ ] Registered broker-dealer / transfer agent engaged where required.
- [ ] Accredited-investor verification vendor meeting "reasonable steps" integrated
      with `ACCREDITATION_VERIFIER_ROLE`.
- [ ] Disclosure documents finalized and registered via `setDocument`.
- [ ] Independent smart-contract security audit completed.
- [ ] `HumanApprovalGateway` LEGAL quorum executes the clearance decision.
- [ ] `setLiveOfferingClearance(true, decisionId, attestation)` called — only then
      does any real money move.
