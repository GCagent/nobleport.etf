# Dual-Token Architecture & Hybrid Exchange Spec (v0)

**Status:** Architecture specification. **ROADMAP** for everything except the
ERC-1400 leg, which is IMPLEMENTED source (not deployed). No Solana code and
no exchange code exist in this repository as of this date.
**Date:** 2026-06-12 · per operator clarification: *two tokens by design*.
**Not legal advice. Not an offer of securities. Every real-money path stays
behind the Cooley gate.**

---

## The two tokens

| Leg | Chain | Standard | Contract | Status |
|-----|-------|----------|----------|--------|
| NBPT security token | EVM (Ethereum/Arbitrum target) | ERC-1400, white-label | `contracts/NBPTSecurityToken1400.sol` | **IMPLEMENTED** (source only; `liveOfferingCleared == false`) |
| Real estate utility/settlement token | Solana | Token-2022 (Token Extensions) | none — to be built | **ROADMAP** |

### Claimed Solana address (operator-provided, 2026-06-12)

```
74UMoemiriRqwLAGnJDnpLXJrWHX5XRs3rM4gWboUMQ8
```

Validated as a well-formed base58 32-byte Solana public key. **Everything
else about it is unverified:** ownership, on-chain existence, balance, and
role (operator wallet vs. intended mint authority vs. something else) — the
sandbox's network policy blocks Solana RPC, so no on-chain lookup was
performed. Same discipline as the ENS wallet record (`NP-ATT-IDN-002`,
SELF_ASSERTED): to verify, (1) sign an ed25519 challenge message from this
key and file the signature, and (2) record an explorer link
(`https://solscan.io/account/74UMoemiriRqwLAGnJDnpLXJrWHX5XRs3rM4gWboUMQ8`)
showing the expected state. Until then this address must not be presented
as a verified NoblePort asset or used as a payment destination in any
external material.

Division of labor, as intended:

- **ERC-1400 NBPT** is the *security* leg: partitioned ownership, transfer
  restrictions, USDC subscription/redemption, the land-parcel white-label
  path ([playbook](./erc1400-land-parcel-playbook.md)). It carries the
  regulatory weight.
- **Token-2022** is the *high-throughput* leg: Solana's Token Extensions
  give native transfer fees, interest-bearing mechanics, a metadata pointer
  for the property doc set, and — critically for compliance —
  **transfer hooks**, which can enforce an allowlist on-chain the way
  ERC-1400 partitions do on EVM. Confidential transfer extension is a
  *maybe*: it complicates the audit story and should be off by default.

## Hybrid exchange layer (ROADMAP)

"Hybrid" means both of:

1. **Venue-hybrid** — the same exposure quoted on traditional rails (via
   APs/market makers, post-registration) and on DEXs (EVM AMMs for the
   ERC-1400 leg where transfer restrictions allow; Solana DEXs for the
   Token-2022 leg with transfer-hook gating).
2. **Chain-hybrid** — a bridge between the two legs. Two honest options:
   - **Lock-and-mint:** ERC-1400 NBPT locked in an EVM vault; equivalent
     Token-2022 supply minted on Solana. Simpler audit (locked supply is
     explorer-checkable) — preferred starting design.
   - **Burn-and-mint:** supply destroyed on one chain, created on the
     other. Cleaner total-supply story, harsher failure modes.

   Either way the bridge inherits the design-review constraints already in
   the [structure map](./nbpt-etf-structure.md): redemption that releases
   fiat touches money-transmission exposure (`FiatRouter.sol` flag), and a
   token class cannot out-privilege the traditional share class
   (SEC equal-treatment).

## Hard rules carried over from the rest of the repo

1. **One source of truth for supply.** Total economic supply =
   EVM supply + Solana supply − bridged-locked amount, published from
   explorer-checkable sources only.
2. **Compliance on both legs.** ERC-1400 partitions/restrictions on EVM;
   Token-2022 transfer hook + allowlist on Solana. A holder who fails
   compliance on one chain must fail on both — shared allowlist root.
3. **Counsel-gated end to end.** The `liveOfferingCleared` gate conceptually
   extends to the Solana mint and the bridge: no mainnet deployment of any
   leg before clearance.
4. **No narrative metrics.** TVL, holder counts, and parcel counts for
   either leg report 0 until an explorer URL says otherwise (attestation
   registry discipline).

## Build order

1. **EVM leg to testnet** — deploy `NBPTSecurityToken1400.sol`; first
   on-chain anchor for the whole program.
2. **Solana Token-2022 mint config** — define the extension set (transfer
   fee, metadata pointer, transfer hook; confidential transfers off),
   devnet mint, allowlist hook program. This is net-new Rust/Anchor work.
3. **Lock-and-mint bridge prototype** — testnet/devnet only, supply
   invariant tested.
4. **DEX legs** — gated pools after both mints exist on test networks.
5. **TradFi venue** — only after registration/exemption path is resolved
   by counsel (see structure map build order).

## Quantum note

The dual-chain design has asymmetric key-risk: EVM keys are secp256k1
(risk 8/10, "VULNERABLE" per the [quantum threat matrix](../../cyborg/nvapi/docs/quantum-attack-tests-2025.md));
Solana keys are Ed25519 (less exposed, same eventual migration). Hybrid
ECDSA+ML-DSA planning applies to the EVM leg first.
