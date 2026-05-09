# NBPT Stability Suite — Deployment Checklist

**Target Chain:** Arbitrum One  
**USDC Address:** `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (native Circle CCTP)  
**Aave V3 Pool:** `0x794a61358D6845594F94dc1DB02A252b5b4814aD`  
**Uniswap V3 Factory:** `0x1F98431c8aD98523631AE4a59f267346ea31F984`

---

## Architecture: Recommended Default Stack (Section H)

| Layer | Choice | Contract |
|-------|--------|----------|
| Fees | Tiered A2 (10/25/50 bps) | NBPT.sol |
| Micro-txns | Netting B1 (off-chain via Stephanie.ai) | — |
| Reserves | Hybrid C3 (30% liquid, 70% vaults) | NBPT.sol + ReserveVault.sol |
| Proof of Reserve | D1 + D2 (public + attestation freshness) | AttestationRegistry.sol |
| Redemption | E2 (instant + queue fallback) | NBPT.sol |
| Liquidity | F1 (Uni V3 narrow + wide backstop) | External pool deployment |
| Brake | G2 (TWAP mint-off only) | TWAPOracleAdapter.sol |
| Caps | Daily mint/redeem caps with ramp | NBPT.sol |

---

## Deployment Order

### Phase 1 — Core Contracts

1. **AttestationRegistry**
   ```
   deploy AttestationRegistry(admin = multisig)
   grantRole(ATTESTOR_ROLE, keeper/auditor EOA or bot)
   ```

2. **TWAPOracleAdapter**
   ```
   deploy TWAPOracleAdapter(admin = multisig, pool = address(0), twapWindow = 1800)
   ```
   Pool is set after Uni V3 pool creation (Phase 2).

3. **NBPT**
   ```
   deploy NBPT(
     admin          = multisig,
     treasury       = treasury multisig,
     feeRecipient   = fee collection address,
     dailyMintCap   = 500_000 * 1e6,   // $500k initial
     dailyRedeemCap = 500_000 * 1e6
   )
   ```
   Then configure:
   ```
   NBPT.setAttestationRegistry(attestationRegistry)
   NBPT.setTWAPOracle(twapOracle)
   ```

4. **ReserveVault(s)**
   ```
   deploy CustodyVault(USDC, treasury multisig)
   deploy AaveVault(USDC, aUSDC address, treasury multisig)
   
   // Grant NBPT permission to operate vaults
   CustodyVault.grantRole(VAULT_OPERATOR_ROLE, NBPT address)
   AaveVault.grantRole(VAULT_OPERATOR_ROLE, NBPT address)
   
   // Register in NBPT
   NBPT.addVault(custodyVault)
   NBPT.addVault(aaveVault)
   ```

### Phase 2 — Liquidity Pool

5. **Uniswap V3 Pool**
   ```
   Create NBPT/USDC pool (fee tier: 100 bps or 500 bps)
   Initialize at tick 0 (price = 1.0)
   
   Provide liquidity:
     - Narrow range: tick [-10, +10] (tight peg band)
     - Wide backstop: tick [-200, +200]
   ```

6. **Connect Oracle**
   ```
   TWAPOracleAdapter.setPool(uniV3Pool)
   ```

### Phase 3 — Activate

7. **Post initial attestation**
   ```
   AttestationRegistry.postAttestation(
     merkleRoot   = keccak256(reserve proof),
     totalReserves = actual USDC balance,
     totalSupply   = 0,
     reportHash   = IPFS CID of audit report
   )
   ```

8. **Grant MINTER_ROLE** (if using permissioned mint for APs only)
   ```
   NBPT.grantRole(MINTER_ROLE, authorized_participant)
   ```
   Note: current `mint()` is permissionless. Add `onlyRole(MINTER_ROLE)` 
   if AP-gated minting is desired.

9. **Announce reserve addresses**
   ```
   AttestationRegistry.addReserveAddress(NBPT contract)
   AttestationRegistry.addReserveAddress(custodyVault)
   AttestationRegistry.addReserveAddress(aaveVault)
   ```

---

## Role Matrix

| Role | Holder | Power |
|------|--------|-------|
| DEFAULT_ADMIN_ROLE | Timelock (24h) → Multisig | Upgrade roles, unpause, resolve incidents |
| TREASURY_ROLE | Treasury Multisig (3/5) | Add/remove vaults, move USDC to vaults |
| OPERATOR_ROLE | Ops Multisig (2/3) | Update daily caps |
| GUARDIAN_ROLE | Guardian EOA (hot) | Engage brake, declare incident, pause |
| ATTESTOR_ROLE | Keeper bot + backup EOA | Post attestations every ≤6h |
| VAULT_OPERATOR_ROLE | NBPT contract address | Deposit/withdraw from vaults |

---

## Parameter Defaults

| Parameter | Value | Notes |
|-----------|-------|-------|
| Tier 1 fee | 10 bps | ≤ $1,000 |
| Tier 2 fee | 25 bps | $1k–$25k |
| Tier 3 fee | 50 bps | > $25k |
| Daily mint cap | $500,000 | Ramp weekly via OPERATOR_ROLE |
| Daily redeem cap | $500,000 | Can be higher than mint |
| TWAP window | 1800s (30 min) | Min 300s enforced |
| Mint brake | 50 bps deviation | Auto via TWAP |
| Incident threshold | 100 bps deviation | Manual or automated |
| Attestation max age | 6 hours | Mint disabled if stale |
| Liquid reserve target | 30% of supply | Operational policy, not enforced on-chain |

---

## Cap Ramp Schedule (Suggested)

| Week | Daily Mint Cap | Daily Redeem Cap |
|------|---------------|-----------------|
| 1 | $500,000 | $500,000 |
| 2 | $1,000,000 | $1,000,000 |
| 3 | $2,500,000 | $2,500,000 |
| 4 | $5,000,000 | $5,000,000 |
| 8+ | $10,000,000 | $15,000,000 |

---

## Security Considerations

1. **Timelock all admin actions** — 24h minimum via OpenZeppelin TimelockController
2. **Multisig for treasury** — Gnosis Safe, 3-of-5 minimum
3. **Guardian is hot** — single EOA for speed, but can ONLY pause/brake (no fund access)
4. **TWAP manipulation resistance** — 30-min window makes single-block manipulation uneconomical
5. **Attestation liveness** — keeper bot with redundant triggers (cron + event-based)
6. **Vault allowlist is append-only in practice** — remove only when empty
7. **No proxy/upgradeable pattern** — immutable logic, new deployments if needed
8. **ReentrancyGuard on all external state-changing functions**
9. **SafeERC20 for all token interactions** (USDC has no return value on some chains)

---

## Monitoring & Alerts (G2 Implementation)

| Deviation | Action | Automated? |
|-----------|--------|-----------|
| 0.30% | Info alert to ops channel | Yes (off-chain) |
| 0.50% | TWAP brake disables mint | Yes (on-chain read) |
| 1.00% | Incident: mint off, queue enabled, treasury notified | Guardian triggers |

Off-chain monitoring via:
- TheGraph subgraph for NBPT events
- Tenderly alerts on reserve ratio changes
- Chainlink Automation (Keepers) for attestation posting

---

## Testing Requirements

Before mainnet:
- [ ] Unit tests: mint, redeem, queue, claim, fee tiers, caps, brake
- [ ] Integration tests: vault deposit/withdraw round-trip
- [ ] Invariant tests: totalSupply ≤ totalReserves (always)
- [ ] Fork tests: against Arbitrum mainnet state (Aave V3, Uni V3)
- [ ] Scenario tests: bank run (deplete liquid, verify queue)
- [ ] Gas profiling: mint + redeem under load
- [ ] Formal verification: fee calculation, reserve accounting

---

## Post-Deployment Verification

```bash
# Verify reserve ratio
cast call $NBPT "reserveRatio()" --rpc-url $ARB_RPC

# Verify attestation freshness
cast call $REGISTRY "isFresh()" --rpc-url $ARB_RPC

# Verify brake status
cast call $ORACLE "isMintBraked()" --rpc-url $ARB_RPC

# Verify daily caps
cast call $NBPT "dailyMintCap()" --rpc-url $ARB_RPC
cast call $NBPT "dailyRedeemCap()" --rpc-url $ARB_RPC
```
