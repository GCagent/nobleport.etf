// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title  NBPTToken — Noble Port Token
 * @author Noble Port Realty
 * @notice Core utility and governance token for the Noble Port ecosystem.
 *
 * Architecture rails (clean separation blueprint):
 *
 *   Rail 1 — Utility:   access gating, feature unlocks, compute allocation
 *   Rail 2 — Governance: ERC-20Votes with delegation & tier-weighted voting power
 *   Rail 3 — Network Participation: in-wallet staking for Builder Tiers 1–5
 *   Rail 4 — Deflation:  burn on certification mints, avatar upgrades, marketplace fees
 *   Rail 5 — Multi-chain: bridge-ready mint/burn pattern (Base ↔ Solana)
 *
 * IMPORTANT: NBPT is strictly a utility/governance token. It does NOT represent
 * equity, revenue share, or any security interest in Noble Port Realty. Regulated
 * asset tokens (real estate, profit participation) MUST use a separate ERC-1400 rail.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract NBPTToken is
    ERC20,
    ERC20Burnable,
    ERC20Votes,
    AccessControl,
    ReentrancyGuard,
    Pausable
{
    // ─── Roles ───────────────────────────────────────────────────────────────────

    bytes32 public constant TREASURY_ROLE    = keccak256("TREASURY_ROLE");
    bytes32 public constant BRIDGE_ROLE      = keccak256("BRIDGE_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    // ─── Supply ──────────────────────────────────────────────────────────────────

    uint256 public constant MAX_SUPPLY    = 100_000_000 * 1e18; // 100 M initial
    uint256 public constant EMISSION_CAP  =  10_000_000 * 1e18; // 10 M max additional
    uint256 public emittedSupply;

    // ─── Builder Tiers ───────────────────────────────────────────────────────────

    enum BuilderTier { None, Bronze, Silver, Gold, Platinum, Sovereign }

    uint256 public constant TIER_BRONZE    =     1_000 * 1e18;
    uint256 public constant TIER_SILVER    =     5_000 * 1e18;
    uint256 public constant TIER_GOLD      =    25_000 * 1e18;
    uint256 public constant TIER_PLATINUM  =   100_000 * 1e18;
    uint256 public constant TIER_SOVEREIGN =   500_000 * 1e18;

    // ─── Staking ─────────────────────────────────────────────────────────────────

    struct StakePosition {
        uint256 amount;
        uint256 stakedAt;
        uint256 lockUntil;
    }

    uint256 public constant MIN_LOCK = 7 days;
    uint256 public constant MAX_LOCK = 365 days;

    mapping(address => StakePosition) public stakes;
    uint256 public totalStaked;

    // ─── Burn Rates (basis points · 10 000 = 100 %) ─────────────────────────────

    uint256 public certificationBurnBps = 500; // 5 %
    uint256 public avatarUpgradeBurnBps = 300; // 3 %
    uint256 public marketplaceBurnBps   = 200; // 2 %
    uint256 public constant MAX_BURN_BPS = 1_000; // 10 % ceiling
    uint256 private constant _BPS = 10_000;
    uint256 public totalBurned;

    // ─── Access Gating ───────────────────────────────────────────────────────────

    mapping(bytes32 => uint256) public featureGates;

    // ─── Events ──────────────────────────────────────────────────────────────────

    event Staked(address indexed account, uint256 amount, uint256 lockUntil, BuilderTier tier);
    event Unstaked(address indexed account, uint256 amount);
    event TierChanged(address indexed account, BuilderTier from, BuilderTier to);
    event FeeBurned(address indexed payer, uint256 burned, string feeType);
    event EmissionMinted(address indexed to, uint256 amount, string reason);
    event FeatureGateSet(bytes32 indexed featureId, uint256 minimumBalance);
    event BridgeMint(address indexed to, uint256 amount, uint256 sourceChainId);
    event BridgeBurn(address indexed from, uint256 amount, uint256 targetChainId);
    event BurnRateUpdated(string feeType, uint256 oldBps, uint256 newBps);

    // ═════════════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═════════════════════════════════════════════════════════════════════════════

    constructor(
        address treasury,
        address admin
    ) ERC20("Noble Port Token", "NBPT") ERC20Permit("Noble Port Token") {
        require(treasury != address(0), "Zero treasury");
        require(admin    != address(0), "Zero admin");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, treasury);

        _mint(treasury, MAX_SUPPLY);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  STAKING — Network Participation (non-financial rewards)
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice Lock NBPT in-wallet to earn Builder Tier status.
    ///         Staked tokens remain in the holder's wallet (preserving vote weight)
    ///         but cannot be transferred until the lock expires and unstake() is called.
    function stake(uint256 amount, uint256 lockDuration) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");
        require(lockDuration >= MIN_LOCK && lockDuration <= MAX_LOCK, "Invalid lock duration");

        StakePosition storage pos = stakes[msg.sender];
        uint256 unlocked = balanceOf(msg.sender) - pos.amount;
        require(unlocked >= amount, "Insufficient unlocked balance");

        BuilderTier oldTier = _tierOf(pos.amount);

        pos.amount   += amount;
        pos.stakedAt  = block.timestamp;
        uint256 newLock = block.timestamp + lockDuration;
        if (newLock > pos.lockUntil) pos.lockUntil = newLock;

        totalStaked += amount;

        BuilderTier newTier = _tierOf(pos.amount);
        emit Staked(msg.sender, amount, pos.lockUntil, newTier);
        if (oldTier != newTier) emit TierChanged(msg.sender, oldTier, newTier);
    }

    /// @notice Release previously staked NBPT after the lock period expires.
    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        StakePosition storage pos = stakes[msg.sender];
        require(amount > 0, "Zero amount");
        require(pos.amount >= amount, "Exceeds staked");
        require(block.timestamp >= pos.lockUntil, "Still locked");

        BuilderTier oldTier = _tierOf(pos.amount);

        pos.amount  -= amount;
        totalStaked -= amount;

        BuilderTier newTier = _tierOf(pos.amount);
        emit Unstaked(msg.sender, amount);
        if (oldTier != newTier) emit TierChanged(msg.sender, oldTier, newTier);
    }

    /// @notice Returns the Builder Tier for a given account.
    function tierOf(address account) external view returns (BuilderTier) {
        return _tierOf(stakes[account].amount);
    }

    function _tierOf(uint256 amount) internal pure returns (BuilderTier) {
        if (amount >= TIER_SOVEREIGN) return BuilderTier.Sovereign;
        if (amount >= TIER_PLATINUM)  return BuilderTier.Platinum;
        if (amount >= TIER_GOLD)      return BuilderTier.Gold;
        if (amount >= TIER_SILVER)    return BuilderTier.Silver;
        if (amount >= TIER_BRONZE)    return BuilderTier.Bronze;
        return BuilderTier.None;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  GOVERNANCE WEIGHT
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice Returns tier-weighted governance power for an account.
    ///         Multipliers: None 1×  · Bronze 1.1×  · Silver 1.25×
    ///                      Gold 1.5× · Platinum 2× · Sovereign 3×
    function governanceWeight(address account) external view returns (uint256) {
        uint256 votes = getVotes(account);
        BuilderTier tier = _tierOf(stakes[account].amount);

        uint256 mul;
        if      (tier == BuilderTier.Sovereign) mul = 300;
        else if (tier == BuilderTier.Platinum)  mul = 200;
        else if (tier == BuilderTier.Gold)      mul = 150;
        else if (tier == BuilderTier.Silver)    mul = 125;
        else if (tier == BuilderTier.Bronze)    mul = 110;
        else                                     mul = 100;

        return (votes * mul) / 100;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  FEE BURNS — Deflation
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice Burn a percentage of a certification minting fee.
    function burnCertificationFee(uint256 feeAmount) external onlyRole(FEE_MANAGER_ROLE) {
        _feeBurn(feeAmount, certificationBurnBps, "certification");
    }

    /// @notice Burn a percentage of an avatar premium upgrade fee.
    function burnAvatarUpgradeFee(uint256 feeAmount) external onlyRole(FEE_MANAGER_ROLE) {
        _feeBurn(feeAmount, avatarUpgradeBurnBps, "avatar_upgrade");
    }

    /// @notice Burn a percentage of a marketplace transaction fee.
    function burnMarketplaceFee(uint256 feeAmount) external onlyRole(FEE_MANAGER_ROLE) {
        _feeBurn(feeAmount, marketplaceBurnBps, "marketplace");
    }

    function _feeBurn(uint256 feeAmount, uint256 bps, string memory feeType) internal {
        uint256 amt = (feeAmount * bps) / _BPS;
        if (amt == 0) return;
        _burn(msg.sender, amt);
        totalBurned += amt;
        emit FeeBurned(msg.sender, amt, feeType);
    }

    /// @notice Update a burn rate (admin only, capped at MAX_BURN_BPS).
    function setBurnRate(string calldata feeType, uint256 newBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newBps <= MAX_BURN_BPS, "Exceeds ceiling");

        bytes32 h = keccak256(bytes(feeType));
        uint256 oldBps;

        if (h == keccak256("certification")) {
            oldBps = certificationBurnBps;
            certificationBurnBps = newBps;
        } else if (h == keccak256("avatar_upgrade")) {
            oldBps = avatarUpgradeBurnBps;
            avatarUpgradeBurnBps = newBps;
        } else if (h == keccak256("marketplace")) {
            oldBps = marketplaceBurnBps;
            marketplaceBurnBps = newBps;
        } else {
            revert("Unknown fee type");
        }

        emit BurnRateUpdated(feeType, oldBps, newBps);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  CAPPED EMISSIONS — Network Participation Rewards
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice Mint additional NBPT within the emission cap.
    ///         Used for network participation rewards — NOT financial yield.
    function emitTokens(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(TREASURY_ROLE) {
        require(emittedSupply + amount <= EMISSION_CAP, "Emission cap reached");
        emittedSupply += amount;
        _mint(to, amount);
        emit EmissionMinted(to, amount, reason);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  ACCESS GATING — Feature & Compute Unlocks
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice Set the minimum NBPT balance required for a gated feature.
    function setFeatureGate(
        bytes32 featureId,
        uint256 minimumBalance
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        featureGates[featureId] = minimumBalance;
        emit FeatureGateSet(featureId, minimumBalance);
    }

    /// @notice Check whether an account qualifies for a gated feature.
    ///         Full balance (including staked) counts since staked tokens stay in-wallet.
    function hasFeatureAccess(address account, bytes32 featureId) external view returns (bool) {
        uint256 required = featureGates[featureId];
        if (required == 0) return true;
        return balanceOf(account) >= required;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  MULTI-CHAIN BRIDGE — Mint / Burn Pattern
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice Mint tokens after a verified bridge transfer from another chain.
    function bridgeMint(
        address to,
        uint256 amount,
        uint256 sourceChainId
    ) external onlyRole(BRIDGE_ROLE) {
        _mint(to, amount);
        emit BridgeMint(to, amount, sourceChainId);
    }

    /// @notice Burn tokens to initiate a bridge transfer to another chain.
    function bridgeBurn(uint256 amount, uint256 targetChainId) external {
        _burn(msg.sender, amount);
        emit BridgeBurn(msg.sender, amount, targetChainId);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  ADMIN
    // ═════════════════════════════════════════════════════════════════════════════

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ═════════════════════════════════════════════════════════════════════════════
    //  VIEW HELPERS
    // ═════════════════════════════════════════════════════════════════════════════

    /// @notice Transferable (non-staked) balance.
    function availableBalance(address account) external view returns (uint256) {
        return balanceOf(account) - stakes[account].amount;
    }

    /// @notice Total supply minus tokens locked in staking positions.
    function circulatingSupply() external view returns (uint256) {
        return totalSupply() - totalStaked;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    //  REQUIRED OVERRIDES
    // ═════════════════════════════════════════════════════════════════════════════

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
        // Enforce staking lock: sender must retain enough for their staked position
        if (from != address(0)) {
            uint256 locked = stakes[from].amount;
            if (locked > 0) {
                require(
                    balanceOf(from) - locked >= amount,
                    "Balance locked for staking"
                );
            }
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
