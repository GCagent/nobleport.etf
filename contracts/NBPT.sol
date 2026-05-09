// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NBPT — Noble Port Real Estate ETF Stablecoin
 * @author NoblePort ETF
 * @notice ERC-20 pegged 1:1 to USDC with tiered fees, daily caps, instant + queued
 *         redemption, hybrid reserves, TWAP mint brake, and attestation freshness gate.
 * @dev Implements Recommended Default Stack (Section H) targeting Arbitrum One.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./interfaces/INBPTStability.sol";

contract NBPT is ERC20, AccessControl, ReentrancyGuard, Pausable, INBPT {
    using SafeERC20 for IERC20;

    // ============ Roles ============

    bytes32 public constant MINTER_ROLE    = keccak256("MINTER_ROLE");
    bytes32 public constant TREASURY_ROLE  = keccak256("TREASURY_ROLE");
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE   = keccak256("GUARDIAN_ROLE");

    // ============ Arbitrum One Constants ============

    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    uint8   public constant USDC_DECIMALS = 6;

    // ============ Fee Tiers (basis points) ============

    uint256 public constant TIER1_LIMIT = 1_000 * 1e6;     // $1,000 in USDC decimals
    uint256 public constant TIER2_LIMIT = 25_000 * 1e6;    // $25,000
    uint256 public constant TIER1_FEE   = 10;              // 10 bps
    uint256 public constant TIER2_FEE   = 25;              // 25 bps
    uint256 public constant TIER3_FEE   = 50;              // 50 bps
    uint256 public constant BPS_DENOM   = 10_000;

    // ============ Peg Brake Thresholds (basis points of $1) ============

    uint256 public constant MINT_BRAKE_THRESHOLD  = 50;    // 0.50%
    uint256 public constant INCIDENT_THRESHOLD    = 100;   // 1.00%

    // ============ Attestation Freshness ============

    uint256 public constant ATTESTATION_MAX_AGE = 6 hours;

    // ============ State ============

    IAttestationRegistry public attestationRegistry;
    ITWAPOracleAdapter   public twapOracle;

    address public feeRecipient;

    // Daily caps (in USDC terms, 6 decimals)
    uint256 public dailyMintCap;
    uint256 public dailyRedeemCap;

    struct DayCounter {
        uint256 day;
        uint256 minted;
        uint256 redeemed;
    }
    DayCounter public dayCounter;

    // Hybrid reserves — allowlisted vaults
    address[] public vaults;
    mapping(address => bool) public isVault;

    // Mint brake state
    bool public mintBraked;
    bool public incidentMode;

    // Redemption queue
    struct RedemptionClaim {
        address redeemer;
        uint256 nbptAmount;
        uint256 timestamp;
        bool    claimed;
    }
    uint256 public nextClaimId;
    mapping(uint256 => RedemptionClaim) public claims;

    // ============ Constructor ============

    constructor(
        address admin,
        address treasury,
        address _feeRecipient,
        uint256 _dailyMintCap,
        uint256 _dailyRedeemCap
    ) ERC20("Noble Port Token", "NBPT") {
        require(admin != address(0), "zero admin");
        require(treasury != address(0), "zero treasury");
        require(_feeRecipient != address(0), "zero fee recipient");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, treasury);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);

        feeRecipient   = _feeRecipient;
        dailyMintCap   = _dailyMintCap;
        dailyRedeemCap = _dailyRedeemCap;
    }

    // ============ Configuration ============

    function setAttestationRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_registry != address(0), "zero registry");
        attestationRegistry = IAttestationRegistry(_registry);
    }

    function setTWAPOracle(address _oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_oracle != address(0), "zero oracle");
        twapOracle = ITWAPOracleAdapter(_oracle);
    }

    function setFeeRecipient(address _recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_recipient != address(0), "zero recipient");
        feeRecipient = _recipient;
    }

    function setDailyCaps(uint256 _mintCap, uint256 _redeemCap) external onlyRole(OPERATOR_ROLE) {
        dailyMintCap   = _mintCap;
        dailyRedeemCap = _redeemCap;
        emit DailyCapUpdated(_mintCap, _redeemCap);
    }

    // ============ Vault Management ============

    function addVault(address vault) external onlyRole(TREASURY_ROLE) {
        require(vault != address(0), "zero vault");
        require(!isVault[vault], "already added");
        require(IReserveVault(vault).asset() == USDC, "vault asset mismatch");
        vaults.push(vault);
        isVault[vault] = true;
        emit VaultAdded(vault);
    }

    function removeVault(address vault) external onlyRole(TREASURY_ROLE) {
        require(isVault[vault], "not a vault");
        require(IReserveVault(vault).reserveBalance() == 0, "vault not empty");
        isVault[vault] = false;
        uint256 len = vaults.length;
        for (uint256 i = 0; i < len; i++) {
            if (vaults[i] == vault) {
                vaults[i] = vaults[len - 1];
                vaults.pop();
                break;
            }
        }
        emit VaultRemoved(vault);
    }

    // ============ Reserve Accounting ============

    function liquidReserves() public view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }

    function vaultReserves() public view returns (uint256 total) {
        uint256 len = vaults.length;
        for (uint256 i = 0; i < len; i++) {
            total += IReserveVault(vaults[i]).reserveBalance();
        }
    }

    function totalReserves() public view returns (uint256) {
        return liquidReserves() + vaultReserves();
    }

    function reserveRatio() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return type(uint256).max;
        return (totalReserves() * BPS_DENOM) / supply;
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    // ============ Fee Calculation ============

    function calculateFee(uint256 usdcAmount) public pure returns (uint256) {
        if (usdcAmount <= TIER1_LIMIT) {
            return (usdcAmount * TIER1_FEE) / BPS_DENOM;
        } else if (usdcAmount <= TIER2_LIMIT) {
            return (usdcAmount * TIER2_FEE) / BPS_DENOM;
        } else {
            return (usdcAmount * TIER3_FEE) / BPS_DENOM;
        }
    }

    // ============ Mint ============

    function mint(uint256 usdcAmount) external nonReentrant whenNotPaused {
        require(usdcAmount > 0, "zero amount");
        _checkMintPreconditions();
        _checkDailyMintCap(usdcAmount);

        uint256 fee       = calculateFee(usdcAmount);
        uint256 nbptMint  = usdcAmount - fee;

        IERC20(USDC).safeTransferFrom(msg.sender, address(this), usdcAmount);

        if (fee > 0) {
            IERC20(USDC).safeTransfer(feeRecipient, fee);
        }

        _mint(msg.sender, nbptMint);

        emit Minted(msg.sender, nbptMint, usdcAmount, fee);
    }

    function _checkMintPreconditions() internal view {
        require(!mintBraked, "mint braked");
        require(!incidentMode, "incident mode");

        if (address(attestationRegistry) != address(0)) {
            require(attestationRegistry.isFresh(), "attestation stale");
        }

        if (address(twapOracle) != address(0)) {
            require(!twapOracle.isMintBraked(), "TWAP brake active");
        }
    }

    // ============ Redeem ============

    function redeem(uint256 nbptAmount) external nonReentrant whenNotPaused {
        require(nbptAmount > 0, "zero amount");
        require(balanceOf(msg.sender) >= nbptAmount, "insufficient NBPT");

        uint256 fee       = calculateFee(nbptAmount);
        uint256 usdcOut   = nbptAmount - fee;

        _checkDailyRedeemCap(nbptAmount);

        _burn(msg.sender, nbptAmount);

        uint256 liquid = liquidReserves();

        if (liquid >= usdcOut + fee) {
            if (fee > 0) {
                IERC20(USDC).safeTransfer(feeRecipient, fee);
            }
            IERC20(USDC).safeTransfer(msg.sender, usdcOut);
            emit Redeemed(msg.sender, nbptAmount, usdcOut, fee);
        } else {
            // Queue fallback (E2): NBPT already burned, issue claim
            uint256 claimId = nextClaimId++;
            claims[claimId] = RedemptionClaim({
                redeemer:  msg.sender,
                nbptAmount: nbptAmount,
                timestamp: block.timestamp,
                claimed:   false
            });
            emit RedemptionQueued(claimId, msg.sender, nbptAmount);
        }
    }

    function claimRedemption(uint256 claimId) external nonReentrant whenNotPaused {
        RedemptionClaim storage c = claims[claimId];
        require(c.redeemer == msg.sender, "not your claim");
        require(!c.claimed, "already claimed");

        uint256 fee     = calculateFee(c.nbptAmount);
        uint256 usdcOut = c.nbptAmount - fee;

        require(liquidReserves() >= usdcOut + fee, "insufficient liquidity");

        c.claimed = true;

        if (fee > 0) {
            IERC20(USDC).safeTransfer(feeRecipient, fee);
        }
        IERC20(USDC).safeTransfer(msg.sender, usdcOut);

        emit RedemptionClaimed(claimId, msg.sender, usdcOut);
    }

    // ============ Daily Caps ============

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _resetDayIfNeeded() internal {
        uint256 today = _currentDay();
        if (dayCounter.day != today) {
            dayCounter.day      = today;
            dayCounter.minted   = 0;
            dayCounter.redeemed = 0;
        }
    }

    function _checkDailyMintCap(uint256 usdcAmount) internal {
        if (dailyMintCap == 0) return; // uncapped
        _resetDayIfNeeded();
        dayCounter.minted += usdcAmount;
        require(dayCounter.minted <= dailyMintCap, "daily mint cap exceeded");
    }

    function _checkDailyRedeemCap(uint256 nbptAmount) internal {
        if (dailyRedeemCap == 0) return; // uncapped
        _resetDayIfNeeded();
        dayCounter.redeemed += nbptAmount;
        require(dayCounter.redeemed <= dailyRedeemCap, "daily redeem cap exceeded");
    }

    // ============ Brake / Incident Controls ============

    function engageMintBrake() external onlyRole(GUARDIAN_ROLE) {
        mintBraked = true;
        emit MintBrakeEngaged(0);
    }

    function releaseMintBrake() external onlyRole(GUARDIAN_ROLE) {
        mintBraked = false;
        emit MintBrakeReleased(0);
    }

    function declareIncident() external onlyRole(GUARDIAN_ROLE) {
        incidentMode = true;
        mintBraked   = true;
        emit IncidentDeclared(0);
    }

    function resolveIncident() external onlyRole(DEFAULT_ADMIN_ROLE) {
        incidentMode = false;
        mintBraked   = false;
        emit IncidentResolved();
    }

    // ============ Treasury Operations ============

    function depositToVault(address vault, uint256 amount) external onlyRole(TREASURY_ROLE) {
        require(isVault[vault], "not a vault");
        IERC20(USDC).safeApprove(vault, amount);
        IReserveVault(vault).deposit(amount);
    }

    function withdrawFromVault(address vault, uint256 amount) external onlyRole(TREASURY_ROLE) {
        require(isVault[vault], "not a vault");
        IReserveVault(vault).withdraw(amount, address(this));
    }

    // ============ Emergency ============

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ============ ERC-20 Overrides ============

    function decimals() public pure override returns (uint8) {
        return USDC_DECIMALS;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
