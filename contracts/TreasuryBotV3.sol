// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TreasuryBotV3 - DeFi Treasury Management Bot
 * @notice Automated treasury management with Curve, Aave, and Yearn
 *         auto-compound strategies, plus peg stabilization.
 *
 * Features:
 *   - Multi-strategy yield allocation (Curve/Aave/Yearn)
 *   - Auto-compound scheduling
 *   - Peg stabilization for NBPT
 *   - Risk-weighted portfolio rebalancing
 *   - Emergency withdrawal circuit breaker
 *   - DAO-approved strategy changes
 *   - Performance fee collection
 *   - NAV calculation
 */
contract TreasuryBotV3 is AccessControl, ReentrancyGuard, Pausable {

    // ─── Roles ────────────────────────────────────────────────────────
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant BOT_ROLE        = keccak256("BOT_ROLE");
    bytes32 public constant GUARDIAN_ROLE    = keccak256("GUARDIAN_ROLE");

    // ─── Strategy Types ──────────────────────────────────────────────
    enum Protocol { CURVE, AAVE, YEARN, COMPOUND, UNISWAP, CUSTOM }
    enum StrategyStatus { ACTIVE, PAUSED, DEPRECATED, EMERGENCY_EXIT }

    struct Strategy {
        uint256   id;
        string    name;
        Protocol  protocol;
        StrategyStatus status;
        address   vaultAddress;
        address   assetAddress;
        uint256   allocationBps;       // Allocation in basis points (max 10000)
        uint256   depositedAmount;
        uint256   currentValue;
        uint256   lastHarvestTime;
        uint256   totalHarvested;
        uint256   performanceFeeBps;   // Fee on profits
        uint256   riskScore;           // 1-100
        uint256   createdAt;
    }

    // ─── Auto-Compound Config ────────────────────────────────────────
    struct CompoundConfig {
        uint256 minCompoundAmount;     // Minimum to trigger compound
        uint256 compoundInterval;      // Minimum seconds between compounds
        bool    autoCompoundEnabled;
        uint256 lastCompoundTime;
        uint256 totalCompounded;
    }

    // ─── Peg Stabilization ──────────────────────────────────────────
    struct PegConfig {
        address pegAsset;              // e.g., USDC address
        uint256 targetPriceWei;        // Target peg price
        uint256 deviationThresholdBps; // Max allowed deviation
        uint256 stabilizationReserve;
        bool    stabilizationActive;
    }

    // ─── NAV Tracking ───────────────────────────────────────────────
    struct NAVSnapshot {
        uint256 timestamp;
        uint256 totalAssets;
        uint256 totalLiabilities;
        uint256 nav;
        string  reportCid;            // IPFS CID for detailed report
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => Strategy) public strategies;
    uint256 public strategyCount;
    uint256 public totalAllocatedBps;

    CompoundConfig public compoundConfig;
    PegConfig public pegConfig;

    NAVSnapshot[] public navHistory;

    // Treasury metrics
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalFeesCollected;
    uint256 public totalYieldGenerated;
    address public feeRecipient;

    // Emergency
    bool public emergencyMode;
    uint256 public emergencyActivatedAt;

    // ─── Events ──────────────────────────────────────────────────────
    event StrategyAdded(uint256 indexed id, string name, Protocol protocol, uint256 allocationBps);
    event StrategyUpdated(uint256 indexed id, StrategyStatus status, uint256 allocationBps);
    event StrategyRemoved(uint256 indexed id);
    event Deposited(uint256 indexed strategyId, uint256 amount);
    event Withdrawn(uint256 indexed strategyId, uint256 amount);
    event Harvested(uint256 indexed strategyId, uint256 yield, uint256 fee);
    event Compounded(uint256 indexed strategyId, uint256 amount);
    event Rebalanced(uint256 timestamp, uint256 strategiesAffected);
    event NAVRecorded(uint256 timestamp, uint256 nav);
    event PegStabilizationTriggered(uint256 deviation, uint256 action);
    event EmergencyActivated(address activatedBy, uint256 timestamp);
    event EmergencyDeactivated(address deactivatedBy, uint256 timestamp);
    event FeeCollected(uint256 amount, address recipient);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin, address _feeRecipient) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(STRATEGIST_ROLE, _admin);
        _grantRole(BOT_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _admin);

        feeRecipient = _feeRecipient;

        compoundConfig = CompoundConfig({
            minCompoundAmount: 0.01 ether,
            compoundInterval: 1 days,
            autoCompoundEnabled: true,
            lastCompoundTime: block.timestamp,
            totalCompounded: 0
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Strategy Management
    // ═══════════════════════════════════════════════════════════════════

    function addStrategy(
        string calldata _name,
        Protocol _protocol,
        address _vaultAddress,
        address _assetAddress,
        uint256 _allocationBps,
        uint256 _performanceFeeBps,
        uint256 _riskScore
    ) external onlyRole(STRATEGIST_ROLE) returns (uint256) {
        require(totalAllocatedBps + _allocationBps <= 10000, "Treasury: exceeds 100%");
        require(_performanceFeeBps <= 3000, "Treasury: max 30% fee");
        require(_riskScore >= 1 && _riskScore <= 100, "Treasury: risk 1-100");

        strategyCount++;
        uint256 id = strategyCount;

        strategies[id] = Strategy({
            id: id,
            name: _name,
            protocol: _protocol,
            status: StrategyStatus.ACTIVE,
            vaultAddress: _vaultAddress,
            assetAddress: _assetAddress,
            allocationBps: _allocationBps,
            depositedAmount: 0,
            currentValue: 0,
            lastHarvestTime: block.timestamp,
            totalHarvested: 0,
            performanceFeeBps: _performanceFeeBps,
            riskScore: _riskScore,
            createdAt: block.timestamp
        });

        totalAllocatedBps += _allocationBps;

        emit StrategyAdded(id, _name, _protocol, _allocationBps);
        return id;
    }

    function updateStrategy(
        uint256 _id,
        StrategyStatus _status,
        uint256 _newAllocationBps
    ) external onlyRole(STRATEGIST_ROLE) {
        Strategy storage s = strategies[_id];
        require(s.id != 0, "Treasury: strategy not found");

        totalAllocatedBps = totalAllocatedBps - s.allocationBps + _newAllocationBps;
        require(totalAllocatedBps <= 10000, "Treasury: exceeds 100%");

        s.status = _status;
        s.allocationBps = _newAllocationBps;

        emit StrategyUpdated(_id, _status, _newAllocationBps);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Deposit & Withdraw
    // ═══════════════════════════════════════════════════════════════════

    function deposit(uint256 _strategyId) external payable onlyRole(BOT_ROLE) nonReentrant whenNotPaused {
        require(!emergencyMode, "Treasury: emergency mode");
        Strategy storage s = strategies[_strategyId];
        require(s.id != 0, "Treasury: strategy not found");
        require(s.status == StrategyStatus.ACTIVE, "Treasury: strategy not active");
        require(msg.value > 0, "Treasury: zero deposit");

        s.depositedAmount += msg.value;
        s.currentValue += msg.value;
        totalDeposited += msg.value;

        emit Deposited(_strategyId, msg.value);
    }

    function withdraw(uint256 _strategyId, uint256 _amount)
        external onlyRole(STRATEGIST_ROLE) nonReentrant
    {
        Strategy storage s = strategies[_strategyId];
        require(s.id != 0, "Treasury: strategy not found");
        require(s.currentValue >= _amount, "Treasury: insufficient");

        s.currentValue -= _amount;
        totalWithdrawn += _amount;

        (bool sent,) = msg.sender.call{value: _amount}("");
        require(sent, "Treasury: withdraw failed");

        emit Withdrawn(_strategyId, _amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Harvest & Compound
    // ═══════════════════════════════════════════════════════════════════

    function harvest(uint256 _strategyId, uint256 _yieldAmount)
        external onlyRole(BOT_ROLE) nonReentrant
    {
        Strategy storage s = strategies[_strategyId];
        require(s.id != 0, "Treasury: strategy not found");

        uint256 fee = (_yieldAmount * s.performanceFeeBps) / 10000;
        uint256 netYield = _yieldAmount - fee;

        s.currentValue += netYield;
        s.totalHarvested += _yieldAmount;
        s.lastHarvestTime = block.timestamp;
        totalYieldGenerated += _yieldAmount;
        totalFeesCollected += fee;

        emit Harvested(_strategyId, _yieldAmount, fee);
    }

    function compound(uint256 _strategyId) external onlyRole(BOT_ROLE) whenNotPaused {
        require(compoundConfig.autoCompoundEnabled, "Treasury: compound disabled");
        require(
            block.timestamp >= compoundConfig.lastCompoundTime + compoundConfig.compoundInterval,
            "Treasury: too early"
        );

        Strategy storage s = strategies[_strategyId];
        require(s.id != 0, "Treasury: strategy not found");
        require(s.status == StrategyStatus.ACTIVE, "Treasury: not active");

        uint256 harvestable = s.currentValue - s.depositedAmount;
        require(harvestable >= compoundConfig.minCompoundAmount, "Treasury: below minimum");

        s.depositedAmount += harvestable;
        compoundConfig.lastCompoundTime = block.timestamp;
        compoundConfig.totalCompounded += harvestable;

        emit Compounded(_strategyId, harvestable);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Rebalancing
    // ═══════════════════════════════════════════════════════════════════

    function rebalance(
        uint256[] calldata _strategyIds,
        uint256[] calldata _newAllocations
    ) external onlyRole(STRATEGIST_ROLE) {
        require(_strategyIds.length == _newAllocations.length, "Treasury: length mismatch");

        uint256 newTotal = totalAllocatedBps;
        for (uint256 i = 0; i < _strategyIds.length; i++) {
            Strategy storage s = strategies[_strategyIds[i]];
            require(s.id != 0, "Treasury: strategy not found");

            newTotal = newTotal - s.allocationBps + _newAllocations[i];
            s.allocationBps = _newAllocations[i];
        }

        require(newTotal <= 10000, "Treasury: exceeds 100%");
        totalAllocatedBps = newTotal;

        emit Rebalanced(block.timestamp, _strategyIds.length);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  NAV Tracking
    // ═══════════════════════════════════════════════════════════════════

    function recordNAV(
        uint256 _totalAssets,
        uint256 _totalLiabilities,
        string calldata _reportCid
    ) external onlyRole(BOT_ROLE) {
        uint256 nav = _totalAssets > _totalLiabilities
            ? _totalAssets - _totalLiabilities
            : 0;

        navHistory.push(NAVSnapshot({
            timestamp: block.timestamp,
            totalAssets: _totalAssets,
            totalLiabilities: _totalLiabilities,
            nav: nav,
            reportCid: _reportCid
        }));

        emit NAVRecorded(block.timestamp, nav);
    }

    function getLatestNAV() external view returns (uint256 timestamp, uint256 nav) {
        require(navHistory.length > 0, "Treasury: no NAV recorded");
        NAVSnapshot memory latest = navHistory[navHistory.length - 1];
        return (latest.timestamp, latest.nav);
    }

    function getNavHistoryLength() external view returns (uint256) {
        return navHistory.length;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Peg Stabilization
    // ═══════════════════════════════════════════════════════════════════

    function configurePeg(
        address _pegAsset,
        uint256 _targetPriceWei,
        uint256 _deviationThresholdBps
    ) external onlyRole(STRATEGIST_ROLE) {
        pegConfig = PegConfig({
            pegAsset: _pegAsset,
            targetPriceWei: _targetPriceWei,
            deviationThresholdBps: _deviationThresholdBps,
            stabilizationReserve: pegConfig.stabilizationReserve,
            stabilizationActive: true
        });
    }

    function fundStabilizationReserve() external payable onlyRole(STRATEGIST_ROLE) {
        pegConfig.stabilizationReserve += msg.value;
    }

    function triggerPegStabilization(uint256 _currentPriceWei)
        external onlyRole(BOT_ROLE) nonReentrant
    {
        require(pegConfig.stabilizationActive, "Treasury: stabilization inactive");

        uint256 target = pegConfig.targetPriceWei;
        uint256 deviation;
        if (_currentPriceWei > target) {
            deviation = ((_currentPriceWei - target) * 10000) / target;
        } else {
            deviation = ((target - _currentPriceWei) * 10000) / target;
        }

        require(deviation > pegConfig.deviationThresholdBps, "Treasury: within threshold");

        emit PegStabilizationTriggered(deviation, _currentPriceWei < target ? 1 : 2);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Compound Config
    // ═══════════════════════════════════════════════════════════════════

    function setCompoundConfig(
        uint256 _minAmount,
        uint256 _interval,
        bool _enabled
    ) external onlyRole(STRATEGIST_ROLE) {
        compoundConfig.minCompoundAmount = _minAmount;
        compoundConfig.compoundInterval = _interval;
        compoundConfig.autoCompoundEnabled = _enabled;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Emergency Controls
    // ═══════════════════════════════════════════════════════════════════

    function activateEmergency() external onlyRole(GUARDIAN_ROLE) {
        emergencyMode = true;
        emergencyActivatedAt = block.timestamp;
        _pause();
        emit EmergencyActivated(msg.sender, block.timestamp);
    }

    function deactivateEmergency() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = false;
        _unpause();
        emit EmergencyDeactivated(msg.sender, block.timestamp);
    }

    function emergencyWithdrawAll() external onlyRole(GUARDIAN_ROLE) nonReentrant {
        require(emergencyMode, "Treasury: not emergency");

        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool sent,) = feeRecipient.call{value: balance}("");
            require(sent, "Treasury: emergency withdraw failed");
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Fee Management
    // ═══════════════════════════════════════════════════════════════════

    function collectFees() external onlyRole(STRATEGIST_ROLE) nonReentrant {
        uint256 fees = totalFeesCollected;
        require(fees > 0, "Treasury: no fees");
        require(address(this).balance >= fees, "Treasury: insufficient balance");

        totalFeesCollected = 0;

        (bool sent,) = feeRecipient.call{value: fees}("");
        require(sent, "Treasury: fee transfer failed");

        emit FeeCollected(fees, feeRecipient);
    }

    function setFeeRecipient(address _newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newRecipient != address(0), "Treasury: zero address");
        feeRecipient = _newRecipient;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════════════════════════════

    function pause() external onlyRole(GUARDIAN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {
        totalDeposited += msg.value;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function getTotalValue() external view returns (uint256 total) {
        for (uint256 i = 1; i <= strategyCount; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                total += strategies[i].currentValue;
            }
        }
    }

    function getRiskWeightedValue() external view returns (uint256 weightedTotal) {
        for (uint256 i = 1; i <= strategyCount; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                weightedTotal += (strategies[i].currentValue * (100 - strategies[i].riskScore)) / 100;
            }
        }
    }
}
