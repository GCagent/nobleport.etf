# NBPT ETF Structure — Build-State Map v1

**Purpose:** The README's ETF architecture diagram, mapped component-by-
component to what actually exists. Same discipline as the
[Smart Contract Registry](./smart-contract-registry.md) and the
[Attestation Registry](../governance/attestation-registry-v1.md).

**Date:** 2026-06-12
**Not legal advice. Not an investment representation. Nothing here is an
offer of securities.**

> **Bottom line up front:** The NBPT ETF is **target architecture**. No SEC
> filing exists, no Authorized Participant / market-maker / custodian
> relationship exists, no fund holds any property, and 0 contracts are
> deployed. The one genuinely built piece is the ERC-1400 token source
> (subscription/redemption, counsel-gated). The architecture is
> **dual-token by design** — ERC-1400 NBPT on EVM *and* a Solana Token-2022
> real estate token, joined by a hybrid exchange layer — per the operator's
> 2026-06-12 clarification. The EVM leg has source; the Solana leg and the
> exchange layer have none. See the
> [dual-token hybrid exchange spec](./dual-token-hybrid-exchange.md).

## Traditional ETF wrapper

| Component | Status | Reality |
|-----------|--------|---------|
| SEC Registration (1940 Act) | **ROADMAP** | No registration statement filed or drafted. The 1940 Act exposure is already flagged on `NPETF.sol` in the smart-contract registry. Counsel-gated — same Cooley gate as the token offering. |
| Authorized Participants | **ROADMAP** | No AP agreements exist. Requires a registered fund first. |
| Market Makers | **ROADMAP** | No market-making relationships. Requires a listed product first. |
| Custodian Bank | **ROADMAP** | No custodian engaged. The "Custodian Bridge" (key custody, multi-sig) has no code in the repo. |

## Blockchain layer

| Component | Status | Reality |
|-----------|--------|---------|
| Token 2022 Asset Backing | **Dual-token by design** | Two tokens are intended: (1) `contracts/NBPTSecurityToken1400.sol` — ERC-1400 white-label NBPT, EVM, **IMPLEMENTED** source, not deployed, counsel-gated; (2) a Solana Token-2022 real estate token using Token Extensions (transfer fees, metadata, transfer-hook compliance, confidential transfers) — **ROADMAP**, zero Solana code in the repo. The legs are joined by a hybrid exchange layer (**ROADMAP**). Spec: [dual-token-hybrid-exchange.md](./dual-token-hybrid-exchange.md). |
| Smart Contract NAV Calculation | **DOCUMENTED** | No NAV contract or oracle integration code exists. `NPETF.sol` is named in docs with no source. The "Oracle Network" (Chainlink feeds, valuation) has zero integration code. |
| Automated Rebalancing | **ROADMAP** | No rebalancing logic anywhere. Automated treasury action would be regulated-activity-adjacent — keep human-gated per the governance layer. |
| Transparent Holdings Registry | **DOCUMENTED** | `holdings.nobleport.eth` is referenced in the README; no registry contract exists and the ENS name's contenthash is unverified. The attestation registry's evidence-bundle type (`NP-ATT-REG-003`) is the natural anchor format when built. |

## Integration components (README §Architecture)

| Component | Status | Reality |
|-----------|--------|---------|
| Oracle Network | **ROADMAP** | No Chainlink or valuation-feed code. |
| Custodian Bridge | **ROADMAP** | No custody or multi-sig bridge code. (Nemoclaw has multi-sig *workflow* types in `src/lib/nemoclaw/`, INTERNAL_R&D.) |
| Creation / Redemption | **PARTIAL** | `NBPTSecurityToken1400.sol` implements USDC subscription/redemption at the token level — source-only, hard-gated by `liveOfferingCleared`. The AP portal and settlement layers do not exist. |
| Reporting Infrastructure | **PARTIAL** | The dashboard exists and now includes the measured Executive Snapshot page; fund-style NAV publication and regulatory filing automation do not exist. |

## README claims corrected

The README previously presented several aspirational items as fact. As of
this doc's commit, it is labeled target architecture. For the record:

- "SEC-registered investment vehicle" — **no registration exists**.
- "Initial Holdings" ($4.4M across Miami/Austin/Denver, 9.2% projected
  yield) — **a model portfolio**; no fund exists and no property is held.
- "Token 2022 Integration" compliance claims — no Solana code exists;
  compliance hooks live in the ERC-1400 source.

## Design review notes (external analysis, 2026-06-12)

From an AI-assisted architecture review of the hybrid structure. These are
design considerations for counsel and engineering — not legal conclusions.

- **Roles in the hybrid model.** APs would interface between the
  fiat/custody bank and on-chain minting; market makers could quote on both
  traditional exchanges and DEXs; the custodian holds the underlying
  property/REIT assets so investors are protected regardless of chain state.
- **Official NAV stays off-chain.** A smart contract can publish an
  oracle-fed *estimated* NAV in real time, but the official daily NAV should
  remain off-chain for audit compliance. This bounds what "Smart Contract
  NAV Calculation" can honestly claim.
- **The redemption mechanism is the hard structural question.** How does an
  AP redeem — does burning tokens release fiat from the custodian? That
  on/off-ramp needs deep TradFi integration and touches the same money-
  movement exposure flagged on `FiatRouter.sol` in the smart-contract
  registry. Design this before writing any NAV or rebalancing code.
- **Dual-class share treatment.** If NBPT issues a token class alongside a
  traditional share class, SEC equal-treatment principles mean the token
  class cannot offer better liquidity or lower fees outside the prospectus.
  This constrains the "Blockchain Benefits" marketing framing and is a
  counsel question from day one.
- **Holdings registry source of truth.** Real-time holdings transparency
  should derive from the custodian's wallet or a verified data feed — not a
  self-reported list — or it adds no trust over a web page.

## Build order that converts this from diagram to fact

1. **Counsel** scopes the wrapper question (1940 Act fund vs. Reg D fund vs.
   simpler tokenized-parcel SPVs first — the land-parcel playbook is the
   lowest-regulatory-drag on-ramp and already written).
2. **Reconcile the token standard** to ERC-1400 across README and docs.
3. **Testnet-deploy** `NBPTSecurityToken1400.sol` — first on-chain anchor.
4. **Holdings registry**: a minimal contract anchoring property evidence
   bundles (deeds, appraisals) by hash — feeds both "Transparent Holdings"
   and the attestation registry.
5. **NAV oracle**: only after real holdings exist to value.
