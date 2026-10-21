# NoblePort Wallet Integration

Single wallet login across SolarCaps, NoblePort Systems, PermitStream, Payment
Node, and future ERC-1400 tokenized assets.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Wallet state | Wagmi v3 + Viem v2 + TanStack Query |
| Universal connector | WalletConnect (Reown) |
| Primary chain | Base (8453) |
| Supported chains | Ethereum, Polygon, Arbitrum, Optimism |

## Wallets supported

One integration covers Coinbase Wallet, MetaMask, Rainbow, Trust Wallet,
Phantom (EVM), Rabby, OKX, Safe, Ledger-connected wallets, and most other EVM
wallets:

- **Injected connector** — any EIP-6963 / `window.ethereum` wallet
  (MetaMask, Rabby, OKX, Trust extension, Phantom EVM, …)
- **Coinbase Wallet connector** — extension, mobile, and Smart Wallet
- **WalletConnect connector** — QR pairing for every WalletConnect-compatible
  mobile wallet (Rainbow, Trust, Phantom, Ledger Live, …)
- **Safe connector** — when the app runs inside a Safe{Wallet} app frame

## Canonical identity

The NoblePort receive identity is the Basename **`nobleport.base.eth`**
(Coinbase Wallet). The full treasury address is never hardcoded; set it in
`NEXT_PUBLIC_NOBLEPORT_TREASURY` and the Wallet dashboard verifies it against
live ENS resolution of the Basename, flagging any mismatch.

## Configuration

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — create a project at
  [cloud.reown.com](https://cloud.reown.com). Without it the WalletConnect QR
  option is hidden; injected + Coinbase wallets still work.
- `NEXT_PUBLIC_NOBLEPORT_TREASURY` — the full `0x…` address behind
  `nobleport.base.eth`.

## Code map

| File | Purpose |
| --- | --- |
| `src/lib/wallet/config.ts` | Wagmi config: chains, transports, connectors |
| `src/lib/wallet/nobleport.ts` | Identity constants, network + module registry |
| `src/components/wallet/WalletProvider.tsx` | Wagmi + React Query providers (mounted in the dashboard layout) |
| `src/components/wallet/ConnectWalletButton.tsx` | Connect / network-switch / disconnect control (in the Topbar) |
| `src/components/wallet/WalletPanels.tsx` | Session, treasury, networks, and modules panels |
| `src/app/dashboard/wallet/page.tsx` | `/dashboard/wallet` page |

## Module roadmap

1. **Wallet authentication** — live (this integration)
2. Token purchases (SolarCaps, settled on Base)
3. NFT certificates (completion / warranty)
4. Staking dashboard
5. Construction payment portal (Payment Node)
6. NoblePort DAO voting (ERC-1400 weighted)

Base is the default chain for all of the above; the connect flow requests
Base on connection and the button exposes a one-click network switcher.

## Payment Node stablecoin readiness

Stablecoin support for the Payment Node (USDC checkout, stablecoin payout
tracking, contractor wallet compatibility, and `fiat` / `stablecoin` /
`payout` / `refund` ledger tagging) is scoped to contractor/vendor payouts
and construction receivables only. See
[`strategy/payment-node-stablecoin-roadmap.md`](./strategy/payment-node-stablecoin-roadmap.md)
for the full roadmap, monitoring plan, and compliance gate.
