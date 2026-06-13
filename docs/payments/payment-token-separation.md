# The Hard Wall: Payment Node ⟂ Token / Liquidity Layer

This document specifies the **architectural separation** between the
construction payment node and the NBPT / KUZO / liquidity layer. It is not a
feature flag and not a "disabled pending review" toggle — it is a wall with no
door.

## Why a wall, not a gate

A feature flag still leaves a code path that someone — or some model output, or
some human clicking "approve" — can traverse. That is not acceptable here:

- **Consumer-fund fiduciary duty.** Construction deposits are consumer funds
  protected under **MA c.142A**. Routing or commingling those dollars anywhere
  near a liquidity or token operation is a serious legal and fiduciary problem.
- **Securities / money-services exposure.** A custom token, USDC/NBPT pools, and
  swaps can pull the business into securities regulation and money-transmitter /
  MSB licensing (FinCEN + state) — a regulatory apparatus unrelated to being a
  GC. That review must happen **before** the architecture is built, with
  securities and money-services counsel, not after.

So the requirement is concrete: **the payment node contains zero functions
capable of calling wallet sync, liquidity routing, or swaps.** Customer deposits
never touch the crypto side — not automatically, and not even with a human in
the loop inside this process.

> Not legal advice. The sequencing — counsel reviews the token design before it
> is built, payment rails prove out independently — is the whole game.

## The two sides

| | **Payment node** (in scope, near cutover) | **Token / liquidity layer** (separate project) |
|---|---|---|
| Purpose | Take construction deposits, gate jobs | NBPT security token, USDC/NBPT pools, treasury |
| Code | `backend/services/stripe_service.py`, `backend/api/payments.py`, `backend/models/payment.py` | `contracts/*.sol`, `src/lib/nemoclaw/*`, `backend/services/nobleport_bridge.py`, `backend/trading/*` |
| Money | Real USD, Stripe → Mercury | On-chain assets, DEX, vaults |
| Regulatory frame | Consumer funds (MA c.142A) | Securities + MSB/FinCEN (pending counsel) |
| Governance lane | `Lane.CONSTRUCTION` | `Lane.KUZO_TRADING`, `Lane.CAPITAL` (execution-restricted) |
| Status | Prove these rails first | Do not build until counsel reviews the design |

## What the wall actually is

1. **No imports across the wall.** Payment-node modules import **nothing** from
   `web3`/`eth_*`, `backend.services.nobleport_bridge`, `backend.trading`, or
   `nemoclaw`. There is no transitive path from a deposit to a signer.
2. **No shared vocabulary.** Payment-node source does not reference `wallet`,
   `liquidity`, `swap`, `treasury`, `stablecoin`, or a signer gateway. If the
   concept isn't there, the call can't be there.
3. **No shared process boundary (target).** The token work should not share a
   process with customer deposits. Until that is true at the deployment level,
   the import/symbol wall keeps them from sharing a call stack.
4. **Governance fail-closed.** `Lane.KUZO_TRADING` and `Lane.CAPITAL` are
   `EXECUTION_RESTRICTED_LANES`; `payment_approval` and `securities_trading` are
   `BLOCKED` in the Authority Matrix. The wall is the structural complement to
   that policy layer — policy says "escalate to a human," structure says "the
   function literally isn't reachable from here."

### A specific trap to avoid

`PaymentProcessor.NOBLEPORT` exists in the payment model as an enum **label**
only. It must never be wired to the token layer (wallet mint, NBPT transfer,
treasury movement). It records that a payment was handled in-house — nothing
more. Any PR that gives it on-chain behavior is the exact boundary violation
this wall exists to stop.

## How the wall is enforced

`backend/tests/test_payment_node_isolation.py` runs in CI
(`.github/workflows/payment-node-guard.yml`) and fails the build if any of the
following regress:

- a payment-node module imports a crypto/token/bridge/trading package
  (checked via AST — no execution needed);
- payment-node source references token-layer vocabulary;
- the live pre-flight stops failing closed (live key / webhook secret / durable
  Postgres ledger / https URLs);
- raw-body webhook verification stops rejecting forgeries or replays.

## If the two ever need to exchange data

They don't today, and they shouldn't until counsel signs off. If a need ever
arises, it goes **across a process and trust boundary**, never an import:

- one-directional, **read-only** export (e.g. anonymized/aggregated portfolio
  metrics) — never customer funds or PII flowing toward the token side;
- an explicit, audited, human-operated step in a **separate** service —
  reviewed by securities and money-services counsel first;
- never a synchronous function call, shared session, or shared DB transaction
  between a customer deposit and any wallet/liquidity/swap operation.

## Bottom line

Prove the construction rails first. Treat the token work as a separate project
that does not share a process with customer deposits until securities and
money-services counsel has reviewed the actual design. This file plus the CI
guard make that separation testable instead of aspirational.
