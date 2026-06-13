# NoblePort Wallet Lab

Test wallets and connection probing for the
[dual-token architecture](../../docs/tokenization/dual-token-hybrid-exchange.md):
ERC-1400 NBPT on EVM + Token-2022 on Solana. **Testnet/devnet only.** Nothing
here touches real funds, and the Cooley gate applies to anything that would.

## Quick start

```bash
node scripts/wallet-lab/generate-wallets.mjs 2   # make 2 test wallets per chain
node scripts/wallet-lab/check-connections.mjs    # probe RPC endpoints
```

`generate-wallets.mjs` writes private material to `.wallets.local.json`
(gitignored, mode 600) and prints only public addresses. Never fund these
wallets with real assets; never commit the local file. Keyed providers are
tested by setting `ALCHEMY_KEY` / `INFURA_KEY` / `HELIUS_KEY` env vars.

## Options matrix — what to evaluate

### Wallets

| Option | Chain | Best for | Notes |
|--------|-------|----------|-------|
| MetaMask | EVM | Operator + AP testing | Ubiquitous; pairs with WalletConnect; secp256k1 (quantum note: highest-priority migration leg) |
| Phantom | Solana + EVM | Cross-chain UX testing | One wallet across both legs — strongest candidate for the hybrid UX test |
| Backpack | Solana | Token-2022 testing | Best Token Extensions support today |
| Solflare | Solana | Token-2022 alternates | Solid transfer-hook/extension handling |
| Safe (multisig) | EVM | Treasury / governance | Maps to HumanApprovalGateway + Nemoclaw multisig flows |
| Squads (multisig) | Solana | Treasury / governance | Solana-side counterpart for the same HITL discipline |

### RPC / connection providers

| Option | Chains | Free tier | Notes |
|--------|--------|-----------|-------|
| Public endpoints (publicnode, official) | both | yes | Fine for the lab; rate-limited; no SLA |
| Alchemy | EVM (+ Solana) | generous | Strong devtools; webhooks for Payment Node events |
| Infura | EVM | yes | Battle-tested; pairs with MetaMask infra |
| Helius | Solana | yes | Best Solana indexing/webhooks; Token-2022 aware APIs |
| QuickNode | both | limited | One vendor for both legs if consolidation wins |

### Networks for the test

| Leg | Network | Why |
|-----|---------|-----|
| ERC-1400 NBPT | **Sepolia** first, then Arbitrum Sepolia | Deploy `NBPTSecurityToken1400.sol` — the program's first on-chain anchor |
| Token-2022 | **Solana devnet** | Free airdrops; full Token Extensions support |

## The test plan (in order)

1. **Connections** — run `check-connections.mjs`; pick the fastest reliable
   endpoint per chain. From the Claude sandbox all RPC hosts are blocked by
   the egress allowlist (the script prints exactly which hosts to add);
   from your own machine everything public should pass.
2. **Wallets** — generate test wallets; fund via faucets; import into
   MetaMask (EVM secret) and Phantom/Backpack (Solana secret) to compare UX.
3. **Sign-and-verify** — sign a challenge message from each wallet and
   verify it; this is the same flow that upgrades the claimed addresses
   (ENS + `74UMoe…UMQ8`) to verified in the attestation registry.
4. **EVM leg** — deploy `NBPTSecurityToken1400.sol` to Sepolia from an
   evm-test wallet; exercise subscribe/redeem against test USDC.
5. **Solana leg** — create a devnet Token-2022 mint with transfer-fee +
   metadata extensions from a sol-test wallet; test gated transfers.
6. **Decide** — score each provider/wallet combo on: reliability, latency,
   Token-2022 support, webhook quality (Payment Node needs event feeds),
   multisig story, and one-vendor-vs-best-of-breed cost.

## Decision criteria ("what works best")

- **Wallet UX:** can one wallet (Phantom) credibly serve both legs, or is
  MetaMask+Backpack per-leg better for operators?
- **Provider:** Helius is the likely Solana pick (Token-2022 indexing);
  Alchemy or Infura for EVM; QuickNode if one vendor for both matters more.
- **Treasury:** Safe + Squads from day one for anything holding value —
  matches the repo's no-single-key HITL governance.

## Sandbox note

This environment's network policy currently blocks **all** RPC hosts (every
probe returns 403 "not in allowlist"). To run live tests from a Claude
session, add the hosts the connection script prints — at minimum:
`api.devnet.solana.com`, `api.mainnet-beta.solana.com`,
`ethereum-sepolia-rpc.publicnode.com`, `sepolia-rollup.arbitrum.io`.
Otherwise run the lab locally — it has no dependencies beyond this repo's
existing `ethers` and Node 18+.
