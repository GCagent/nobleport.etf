# Land-Parcel Tokenization Playbook (ERC-1400, white-label)

**Status:** Engineering / configuration reference. **Not launched.** Testnet-only,
behind the Cooley gate (`liveOfferingCleared == false`).
**Contract:** [`contracts/NBPTSecurityToken1400.sol`](../../contracts/NBPTSecurityToken1400.sol)
**Not legal advice.** Counsel is the call. A construction or broker license is
**not** authority to issue a security — see
[erc1400-nbpt-usdc.md](./erc1400-nbpt-usdc.md) §1.

---

## What this is

Tokenizing a raw land parcel is the simplest case in the security-token family:
it is typically a single equity interest with voting rights, no operating
business, and a small, well-defined document set. This playbook maps the standard
ERC-1400 configuration decisions onto the **actual** white-label contract in this
repo, so a parcel can be wired up without inventing new code or new claims.

It is a configuration guide, not a go-live authorization. Every real-money path
stays hard-gated until counsel clears the offering. The point of doing this now is
to have a clean, reviewable parameter set ready *before* the legal timeline
completes — not to move money early.

---

## 1. Name, symbol, token details

White-label the deployment to the parcel's legal entity. The contract ships with
generic `NoblePort Security Token` / `NBPT` metadata and a governance-only setter:

```solidity
// GOVERNANCE_ADMIN_ROLE
setTokenMetadata(
    "123 Country Road LLC",   // name  — the legal entity that holds the parcel
    "LAND1",                  // symbol — short ticker
    "ipfs://<CID>/index.json" // tokenDetails — pointer to the off-chain doc set
);
```

- **`name`** ties the token to the title-holding entity, not a marketing name. One
  parcel = one LLC = one token keeps the chain of title clean.
- **`symbol`** is a short ticker (`LAND1`, `PARCEL2`, …).
- **`tokenDetails`** is an IPFS/URI pointer (the ERC-1400 `_tokenDetails`
  convention) to the off-chain document index: survey, title report, zoning
  certificate, recorded encumbrances, and the offering documents.

`tokenDetails` is *informational*. The legally binding documents must also be
**hash-anchored** so a holder can prove the contract referenced exactly that
version:

```solidity
// DOCUMENT_MANAGER_ROLE (ERC-1643)
setDocument("survey",       "ipfs://<CID>/survey.pdf",      keccak256(surveyBytes));
setDocument("title-report", "ipfs://<CID>/title.pdf",       keccak256(titleBytes));
setDocument("zoning-cert",  "ipfs://<CID>/zoning.pdf",      keccak256(zoningBytes));
setDocument("encumbrances", "ipfs://<CID>/encumbrances.pdf",keccak256(encBytes));
setDocument("ppm",          "ipfs://<CID>/ppm.pdf",         keccak256(ppmBytes));
setDocument("sub-agreement","ipfs://<CID>/subscription.pdf",keccak256(subBytes));
```

Store the files on IPFS (or equivalent immutable storage) so the URI and the hash
stay aligned.

---

## 2. Decimals and granularity

The contract fixes `decimals == 18` (standard ERC-20 ergonomics; changing it would
fork the math throughout). Instead of changing decimals, control the *smallest
tradable unit* with the new **`granularity`** parameter, which enforces that every
issued, transferred, redeemed, or subscribed amount is an exact multiple of the
unit. It can only be set while nothing has been issued, so existing balances can
never be stranded.

Model the parcel as **100 tokens = 100% ownership** (1 token = 1%) and pick the
finest fraction you want to allow:

| Intended minimum stake | `granularity` | Result |
|------------------------|--------------|--------|
| Whole 1% units only    | `1e18`       | 100 indivisible tokens; no fractions |
| 0.1% steps             | `1e15`       | 1000 steps across the parcel |
| Fully divisible (default) | `1`       | No unit floor (not recommended for land) |

```solidity
// GOVERNANCE_ADMIN_ROLE, before any issuance
setGranularity(1e18); // 1 token = 1% ownership, whole units only
```

Then the parcel's 100% is `100 * 1e18` base units. With `granularity == 1e18`,
`issueByPartition`, `transferByPartition`, `redeemByPartition`, `subscribe`, and
`redeemForUSDC` all reject any amount that is not a whole number of percent — the
on-chain expression of "the smallest tradable unit is 1% of the parcel."

> Granularity is enforced; it is not cosmetic. A subscription whose USDC amount
> would mint a fractional unit reverts with `Subscription not granular`, forcing
> the buyer to a clean whole-unit amount.

---

## 3. Transfer restrictions (the "transfer managers")

Land held under a Reg D 506(c) or Reg S exemption can only move to approved
buyers. ERC-1400's "transfer manager" modules are expressed here directly in
`_canTransfer` (the predicate behind `canTransfer` / `canTransferByPartition`),
which every transfer routes through. For a parcel under Reg D 506(c):

```solidity
setAccreditationRequired(true);        // GOVERNANCE_ADMIN_ROLE — 506(c) gate on
setDefaultLockupPeriod(365 days);      // Rule 144 holding period at issuance
```

Then, per investor, the compliance officers attest status — **never**
self-asserted:

```solidity
setKycStatus(buyer, true);                          // KYC_OFFICER_ROLE — identity/AML
setAccreditation(buyer, expiry, evidenceHash);      // ACCREDITATION_VERIFIER_ROLE
```

`_canTransfer` blocks a transfer unless the **receiver** is KYC-verified and (when
required) accredited, neither party is frozen, the sender is past their lock-up,
and the amount is granular. This is the KYC/AML + jurisdiction screen the standard
calls for, satisfied without a separate module registry. For jurisdiction limits
(e.g. excluding a sanctioned region or enforcing Reg S), gate
`setKycStatus` / `setAccreditation` issuance on the off-chain verification vendor's
determination — the on-chain record is the verifier's attestation, not the
investor's claim.

Accreditation is verifier-attested by design: `setAccreditation` is callable only
by `ACCREDITATION_VERIFIER_ROLE`, with an evidence hash and a future expiry. That
is the on-chain anchor for the 506(c) "reasonable steps" record.

---

## 4. Capital stack and distributions

For raw land the token usually represents **equity** with voting rights on major
decisions (sale, development, financing). Two structuring choices:

**Single class (simplest).** Issue everything on `DEFAULT_PARTITION`. One class,
one vote-per-token, no tranches. Right for a parcel held for appreciation or a
straight option/sale.

**Tranches via partitions (if needed).** Use ERC-1410 partitions to separate, e.g.,
a managing-member class from passive LP units, or a lock-up tranche from a free
tranche. Issue into a named partition:

```solidity
issueByPartition(bytes32("voting"),    member, 51e18, "");   // managing member
issueByPartition(bytes32("nonvoting"), lp,     49e18, "");   // passive LPs
```

Each partition tracks its own supply (`totalSupplyByPartition`) and can carry its
own operator authorizations and transfer semantics.

**Distributions (lease / option / sale revenue).** The USDC rail handles cash
back to holders. Lease income, option payments, or sale proceeds are deposited to
the redemption reserve and flow out via redemption at the pegged price:

```solidity
depositReserve(usdcFromLeaseIncome);   // fund the reserve from revenue / NAV
setPegPrice(newNavPerToken);           // GOVERNANCE_ADMIN_ROLE — track NAV
```

Holders redeem with `redeemForUSDC`. Redemptions at/above
`humanReviewThresholdUSDC` require an EXECUTED `HumanApprovalGateway` financial
decision — no automation moves investor money past that bar unattended. If you
prefer pro-rata distributions over redemption, that is a checkpoint/dividend
module not yet built here; track it as ROADMAP rather than implying it exists.

---

## 5. Deployment parameter sheet (worked example)

A single 1%-unit equity token for one parcel, par-pegged to USDC, **not yet
cleared**:

| Parameter | Value | Where set |
|-----------|-------|-----------|
| `name` | `123 Country Road LLC` | `setTokenMetadata` |
| `symbol` | `LAND1` | `setTokenMetadata` |
| `tokenDetails` | `ipfs://<CID>/index.json` | `setTokenMetadata` |
| `decimals` | `18` (fixed) | constructor / constant |
| `granularity` | `1e18` (1 token = 1%) | `setGranularity` (pre-issuance) |
| Total interest | `100 * 1e18` (100%) | issued via `issueByPartition` |
| `usdc` / `usdcDecimals` | chain USDC / `6` | constructor |
| `pegPriceUSDC` | par (`1 * 10^6`) or NAV | constructor / `setPegPrice` |
| `accreditationRequired` | `true` (Reg D 506(c)) | `setAccreditationRequired` |
| `defaultLockupPeriod` | `365 days` (Rule 144) | `setDefaultLockupPeriod` |
| `approvalGateway` + threshold | gateway addr + USD bar | `setApprovalGateway` |
| `liveOfferingCleared` | **`false`** | constructor — counsel-gated |

Roles wired to multisigs per [erc1400-nbpt-usdc.md](./erc1400-nbpt-usdc.md) §4.

---

## 6. Order of operations

1. Deploy with the constructor (admin, USDC, USDC decimals, peg). Gate is `false`.
2. `setGranularity(1e18)` **before any issuance** (locks once supply > 0).
3. `setTokenMetadata(...)` to white-label to the parcel LLC.
4. `setApprovalGateway(...)`, `setAccreditationRequired(true)`,
   `setDefaultLockupPeriod(...)`.
5. Anchor the document set via `setDocument(...)` (ERC-1643).
6. KYC/accredit investors via the verifier roles as they clear the off-chain
   vendor.
7. **Testnet dry-run:** confirm `issue` / `subscribe` / `redeemForUSDC` revert
   while the gate is `false`. They must.
8. Hold. Real money moves only after counsel executes the
   `HumanApprovalGateway` LEGAL decision and `setLiveOfferingClearance(true, …)`
   is called — see the pre-go-live checklist in
   [erc1400-nbpt-usdc.md](./erc1400-nbpt-usdc.md) §6.

---

## What this playbook does NOT do

- It does not clear the offering, choose the exemption, or substitute for counsel.
- It does not add a pro-rata dividend/checkpoint module (redemption-based
  distributions only, today).
- It does not deploy to mainnet or assert any on-chain address. The contract
  remains **IMPLEMENTED**, not **DEPLOYED**, in the
  [smart-contract registry](./smart-contract-registry.md).
