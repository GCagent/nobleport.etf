// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title NPETF - NoblePort ERC-1400 Security Token ETF Engine
 * @notice Tokenized real estate ETF with Reg D 506(c) compliance,
 *         partition-based transfers, vesting enforcement, and deflationary mechanics.
 *
 * ERC-1400 features implemented:
 *   - Partitioned balances (residential / commercial / treasury / staking)
 *   - Transfer restrictions via KYC whitelist
 *   - Document management (IPFS-anchored prospectus, SAI, etc.)
 *   - Controller operations for regulatory compliance
 *   - Forced transfers for legal/regulatory enforcement
 *
 * Tokenomics (from Ultra-Scarce Model):
 *   - 100M fixed supply
 *   - Quarterly burns
 *   - Governance penalty burns
 *   - Buyback operations
 *   - AI-optimized burn timing
 *
 * Yield logic:
 *   - 6% residential partition yield
 *   - 10% commercial partition yield
 */
contract NPETF is ERC20, ERC20Burnable, AccessControl, ReentrancyGuard, Pausable {

    // ─── Roles ────────────────────────────────────────────────────────
    bytes32 public constant CONTROLLER_ROLE   = keccak256("CONTROLLER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE   = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant TREASURY_ROLE     = keccak256("TREASURY_ROLE");
    bytes32 public constant BURN_OPERATOR     = keccak256("BURN_OPERATOR");

    // ─── Supply ───────────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M fixed
    uint256 public totalBurned;

    // ─── Partitions (ERC-1400) ────────────────────────────────────────
    bytes32 public constant RESIDENTIAL = keccak256("RESIDENTIAL");
    bytes32 public constant COMMERCIAL  = keccak256("COMMERCIAL");
    bytes32 public constant TREASURY    = keccak256("TREASURY");
    bytes32 public constant STAKING     = keccak256("STAKING");

    bytes32[] private _totalPartitions;
    mapping(bytes32 => bool) private _partitionExists;

    // partition => holder => balance
    mapping(bytes32 => mapping(address => uint256)) private _partitionBalances;
    // partition => total supply in that partition
    mapping(bytes32 => uint256) private _partitionTotalSupply;
    // holder => list of partitions they hold
    mapping(address => bytes32[]) private _holderPartitions;
    mapping(address => mapping(bytes32 => bool)) private _holderHasPartition;

    // ─── KYC / Whitelist (Reg D 506(c)) ──────────────────────────────
    struct InvestorRecord {
        bool    whitelisted;
        bool    accredited;
        uint256 kycExpiry;
        bytes32 sbtTokenId;       // zk-SBT reference
        string  jurisdiction;
    }
    mapping(address => InvestorRecord) public investors;
    uint256 public totalWhitelisted;

    // ─── Vesting ─────────────────────────────────────────────────────
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 released;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        bool    revocable;
        bool    revoked;
    }
    mapping(address => VestingSchedule) public vestingSchedules;

    // ─── Document Management (ERC-1400) ──────────────────────────────
    struct Document {
        string  uri;        // IPFS CID or URL
        bytes32 docHash;
        uint256 timestamp;
    }
    mapping(bytes32 => Document) private _documents;
    bytes32[] private _documentNames;

    // ─── Yield Configuration ─────────────────────────────────────────
    uint256 public residentialYieldBps = 600;   // 6%
    uint256 public commercialYieldBps  = 1000;  // 10%
    uint256 public lastYieldDistribution;

    // ─── Burn / Deflationary Mechanics ───────────────────────────────
    uint256 public lastQuarterlyBurn;
    uint256 public quarterlyBurnBps = 50;       // 0.5% default
    uint256 public totalGovernancePenaltyBurns;

    // ─── Buyback ─────────────────────────────────────────────────────
    uint256 public totalBuybackBurned;
    uint256 public buybackReserve;

    // ─── Staking ─────────────────────────────────────────────────────
    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 lockUntil;
    }
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    uint256 public minimumStakeForGovernance = 1000 * 1e18;

    // ─── Events ──────────────────────────────────────────────────────
    event InvestorWhitelisted(address indexed investor, string jurisdiction, bytes32 sbtTokenId);
    event InvestorRemoved(address indexed investor);
    event TransferByPartition(bytes32 indexed partition, address indexed from, address indexed to, uint256 amount);
    event IssuedByPartition(bytes32 indexed partition, address indexed to, uint256 amount);
    event RedeemedByPartition(bytes32 indexed partition, address indexed from, uint256 amount);
    event DocumentUpdated(bytes32 indexed name, string uri, bytes32 docHash);
    event QuarterlyBurnExecuted(uint256 amount, uint256 timestamp);
    event GovernancePenaltyBurn(address indexed penalized, uint256 amount, string reason);
    event BuybackExecuted(uint256 ethSpent, uint256 tokensBurned);
    event YieldDistributed(bytes32 indexed partition, uint256 totalYield, uint256 timestamp);
    event VestingScheduleCreated(address indexed beneficiary, uint256 totalAmount, uint256 startTime);
    event VestingReleased(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary);
    event Staked(address indexed staker, uint256 amount, uint256 lockUntil);
    event Unstaked(address indexed staker, uint256 amount);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, string reason);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) ERC20("NoblePort ETF Token", "NBPT") {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CONTROLLER_ROLE, _admin);
        _grantRole(COMPLIANCE_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _admin);
        _grantRole(BURN_OPERATOR, _admin);

        // Initialize partitions
        _addPartition(RESIDENTIAL);
        _addPartition(COMMERCIAL);
        _addPartition(TREASURY);
        _addPartition(STAKING);

        lastYieldDistribution = block.timestamp;
        lastQuarterlyBurn = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ERC-1400: Partition Management
    // ═══════════════════════════════════════════════════════════════════

    function totalPartitions() external view returns (bytes32[] memory) {
        return _totalPartitions;
    }

    function balanceOfByPartition(bytes32 _partition, address _holder) external view returns (uint256) {
        return _partitionBalances[_partition][_holder];
    }

    function partitionsOf(address _holder) external view returns (bytes32[] memory) {
        return _holderPartitions[_holder];
    }

    function issueByPartition(
        bytes32 _partition,
        address _to,
        uint256 _amount
    ) external onlyRole(CONTROLLER_ROLE) whenNotPaused {
        require(_partitionExists[_partition], "NPETF: partition does not exist");
        require(investors[_to].whitelisted, "NPETF: recipient not whitelisted");
        require(totalSupply() + _amount <= MAX_SUPPLY, "NPETF: exceeds max supply");

        _mint(_to, _amount);
        _partitionBalances[_partition][_to] += _amount;
        _partitionTotalSupply[_partition] += _amount;
        _addHolderPartition(_to, _partition);

        emit IssuedByPartition(_partition, _to, _amount);
    }

    function transferByPartition(
        bytes32 _partition,
        address _from,
        address _to,
        uint256 _amount
    ) external whenNotPaused nonReentrant {
        require(msg.sender == _from || hasRole(CONTROLLER_ROLE, msg.sender), "NPETF: unauthorized");
        require(_partitionBalances[_partition][_from] >= _amount, "NPETF: insufficient partition balance");
        require(investors[_to].whitelisted, "NPETF: recipient not whitelisted");
        require(_isTransferValid(_from, _to, _amount), "NPETF: transfer restricted");

        _transfer(_from, _to, _amount);
        _partitionBalances[_partition][_from] -= _amount;
        _partitionBalances[_partition][_to] += _amount;
        _addHolderPartition(_to, _partition);

        emit TransferByPartition(_partition, _from, _to, _amount);
    }

    function redeemByPartition(
        bytes32 _partition,
        uint256 _amount
    ) external whenNotPaused nonReentrant {
        require(_partitionBalances[_partition][msg.sender] >= _amount, "NPETF: insufficient partition balance");

        _burn(msg.sender, _amount);
        _partitionBalances[_partition][msg.sender] -= _amount;
        _partitionTotalSupply[_partition] -= _amount;

        emit RedeemedByPartition(_partition, msg.sender, _amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  KYC / Whitelist (Reg D 506(c))
    // ═══════════════════════════════════════════════════════════════════

    function whitelistInvestor(
        address _investor,
        bool _accredited,
        uint256 _kycExpiry,
        bytes32 _sbtTokenId,
        string calldata _jurisdiction
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(_kycExpiry > block.timestamp, "NPETF: KYC already expired");

        investors[_investor] = InvestorRecord({
            whitelisted: true,
            accredited: _accredited,
            kycExpiry: _kycExpiry,
            sbtTokenId: _sbtTokenId,
            jurisdiction: _jurisdiction
        });

        if (!investors[_investor].whitelisted) {
            totalWhitelisted++;
        }

        emit InvestorWhitelisted(_investor, _jurisdiction, _sbtTokenId);
    }

    function removeInvestor(address _investor) external onlyRole(COMPLIANCE_ROLE) {
        require(investors[_investor].whitelisted, "NPETF: not whitelisted");
        investors[_investor].whitelisted = false;
        totalWhitelisted--;
        emit InvestorRemoved(_investor);
    }

    function isOperatorForPartition(bytes32 _partition, address _operator, address _holder)
        external view returns (bool)
    {
        return hasRole(CONTROLLER_ROLE, _operator) || _operator == _holder;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ERC-1400: Document Management
    // ═══════════════════════════════════════════════════════════════════

    function setDocument(
        bytes32 _name,
        string calldata _uri,
        bytes32 _docHash
    ) external onlyRole(CONTROLLER_ROLE) {
        if (_documents[_name].timestamp == 0) {
            _documentNames.push(_name);
        }
        _documents[_name] = Document({
            uri: _uri,
            docHash: _docHash,
            timestamp: block.timestamp
        });
        emit DocumentUpdated(_name, _uri, _docHash);
    }

    function getDocument(bytes32 _name) external view returns (string memory, bytes32, uint256) {
        Document memory doc = _documents[_name];
        return (doc.uri, doc.docHash, doc.timestamp);
    }

    function getAllDocuments() external view returns (bytes32[] memory) {
        return _documentNames;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Vesting Enforcement
    // ═══════════════════════════════════════════════════════════════════

    function createVestingSchedule(
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _cliffDuration,
        uint256 _vestingDuration,
        bool _revocable
    ) external onlyRole(CONTROLLER_ROLE) {
        require(vestingSchedules[_beneficiary].totalAmount == 0, "NPETF: schedule exists");
        require(_vestingDuration > 0, "NPETF: duration must be > 0");
        require(_totalAmount > 0, "NPETF: amount must be > 0");

        vestingSchedules[_beneficiary] = VestingSchedule({
            totalAmount: _totalAmount,
            released: 0,
            startTime: block.timestamp,
            cliffDuration: _cliffDuration,
            vestingDuration: _vestingDuration,
            revocable: _revocable,
            revoked: false
        });

        emit VestingScheduleCreated(_beneficiary, _totalAmount, block.timestamp);
    }

    function releaseVested() external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        require(schedule.totalAmount > 0, "NPETF: no vesting schedule");
        require(!schedule.revoked, "NPETF: vesting revoked");

        uint256 releasable = _computeReleasable(schedule);
        require(releasable > 0, "NPETF: nothing to release");

        schedule.released += releasable;
        _transfer(address(this), msg.sender, releasable);

        emit VestingReleased(msg.sender, releasable);
    }

    function revokeVesting(address _beneficiary) external onlyRole(CONTROLLER_ROLE) {
        VestingSchedule storage schedule = vestingSchedules[_beneficiary];
        require(schedule.revocable, "NPETF: not revocable");
        require(!schedule.revoked, "NPETF: already revoked");

        schedule.revoked = true;
        emit VestingRevoked(_beneficiary);
    }

    function computeReleasableAmount(address _beneficiary) external view returns (uint256) {
        return _computeReleasable(vestingSchedules[_beneficiary]);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Deflationary Mechanics
    // ═══════════════════════════════════════════════════════════════════

    function executeQuarterlyBurn() external onlyRole(BURN_OPERATOR) {
        require(block.timestamp >= lastQuarterlyBurn + 90 days, "NPETF: too early for burn");

        uint256 burnAmount = (totalSupply() * quarterlyBurnBps) / 10000;
        require(burnAmount > 0, "NPETF: nothing to burn");

        // Burn from treasury partition
        require(
            _partitionBalances[TREASURY][address(this)] >= burnAmount,
            "NPETF: insufficient treasury for burn"
        );

        _burn(address(this), burnAmount);
        _partitionBalances[TREASURY][address(this)] -= burnAmount;
        _partitionTotalSupply[TREASURY] -= burnAmount;
        totalBurned += burnAmount;
        lastQuarterlyBurn = block.timestamp;

        emit QuarterlyBurnExecuted(burnAmount, block.timestamp);
    }

    function governancePenaltyBurn(
        address _violator,
        uint256 _amount,
        string calldata _reason
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(balanceOf(_violator) >= _amount, "NPETF: insufficient balance");

        _burn(_violator, _amount);
        totalBurned += _amount;
        totalGovernancePenaltyBurns += _amount;

        emit GovernancePenaltyBurn(_violator, _amount, _reason);
    }

    function executeBuybackBurn(uint256 _tokenAmount) external onlyRole(TREASURY_ROLE) {
        require(
            _partitionBalances[TREASURY][address(this)] >= _tokenAmount,
            "NPETF: insufficient treasury"
        );

        _burn(address(this), _tokenAmount);
        _partitionBalances[TREASURY][address(this)] -= _tokenAmount;
        _partitionTotalSupply[TREASURY] -= _tokenAmount;
        totalBurned += _tokenAmount;
        totalBuybackBurned += _tokenAmount;

        emit BuybackExecuted(0, _tokenAmount);
    }

    function setQuarterlyBurnBps(uint256 _bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bps <= 500, "NPETF: max 5%");
        quarterlyBurnBps = _bps;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Staking & Governance Gating
    // ═══════════════════════════════════════════════════════════════════

    function stake(uint256 _amount, uint256 _lockDuration) external nonReentrant whenNotPaused {
        require(investors[msg.sender].whitelisted, "NPETF: not whitelisted");
        require(balanceOf(msg.sender) >= _amount, "NPETF: insufficient balance");
        require(_lockDuration >= 30 days, "NPETF: minimum 30 day lock");

        _transfer(msg.sender, address(this), _amount);

        StakeInfo storage info = stakes[msg.sender];
        info.amount += _amount;
        info.stakedAt = block.timestamp;
        info.lockUntil = block.timestamp + _lockDuration;
        totalStaked += _amount;

        // Move to staking partition
        _partitionBalances[STAKING][msg.sender] += _amount;
        _partitionTotalSupply[STAKING] += _amount;
        _addHolderPartition(msg.sender, STAKING);

        emit Staked(msg.sender, _amount, info.lockUntil);
    }

    function unstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(info.amount > 0, "NPETF: nothing staked");
        require(block.timestamp >= info.lockUntil, "NPETF: still locked");

        uint256 amount = info.amount;
        info.amount = 0;
        totalStaked -= amount;

        _partitionBalances[STAKING][msg.sender] -= amount;
        _partitionTotalSupply[STAKING] -= amount;

        _transfer(address(this), msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function hasGovernanceRights(address _holder) external view returns (bool) {
        return stakes[_holder].amount >= minimumStakeForGovernance;
    }

    function setMinimumStakeForGovernance(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minimumStakeForGovernance = _amount;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Yield Distribution
    // ═══════════════════════════════════════════════════════════════════

    function distributeYield(bytes32 _partition) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(
            _partition == RESIDENTIAL || _partition == COMMERCIAL,
            "NPETF: yield only for RE/COM"
        );
        uint256 yieldBps = _partition == RESIDENTIAL ? residentialYieldBps : commercialYieldBps;
        uint256 partitionSupply = _partitionTotalSupply[_partition];
        require(partitionSupply > 0, "NPETF: no supply in partition");

        uint256 totalYield = (partitionSupply * yieldBps) / 10000;
        require(
            _partitionBalances[TREASURY][address(this)] >= totalYield,
            "NPETF: insufficient treasury for yield"
        );

        _partitionBalances[TREASURY][address(this)] -= totalYield;
        _partitionTotalSupply[TREASURY] -= totalYield;

        lastYieldDistribution = block.timestamp;

        emit YieldDistributed(_partition, totalYield, block.timestamp);
    }

    function setYieldRates(uint256 _residentialBps, uint256 _commercialBps)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_residentialBps <= 2000, "NPETF: max 20%");
        require(_commercialBps <= 2000, "NPETF: max 20%");
        residentialYieldBps = _residentialBps;
        commercialYieldBps = _commercialBps;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Controller Operations (ERC-1400 Forced Transfer)
    // ═══════════════════════════════════════════════════════════════════

    function forcedTransfer(
        address _from,
        address _to,
        uint256 _amount,
        string calldata _reason
    ) external onlyRole(CONTROLLER_ROLE) {
        require(balanceOf(_from) >= _amount, "NPETF: insufficient balance");
        _transfer(_from, _to, _amount);
        emit ForcedTransfer(_from, _to, _amount, _reason);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════════════════════════════

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {
        buybackReserve += msg.value;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ERC-20 Transfer Override (whitelist enforcement)
    // ═══════════════════════════════════════════════════════════════════

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);

        // Skip checks for mint/burn and contract-internal moves
        if (from == address(0) || to == address(0)) return;
        if (from == address(this) || to == address(this)) return;

        require(_isTransferValid(from, to, amount), "NPETF: transfer restricted");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Internal Helpers
    // ═══════════════════════════════════════════════════════════════════

    function _isTransferValid(address _from, address _to, uint256) internal view returns (bool) {
        if (!investors[_to].whitelisted) return false;
        if (investors[_to].kycExpiry < block.timestamp) return false;
        if (!investors[_from].whitelisted) return false;
        if (investors[_from].kycExpiry < block.timestamp) return false;
        return true;
    }

    function _addPartition(bytes32 _partition) internal {
        if (!_partitionExists[_partition]) {
            _totalPartitions.push(_partition);
            _partitionExists[_partition] = true;
        }
    }

    function _addHolderPartition(address _holder, bytes32 _partition) internal {
        if (!_holderHasPartition[_holder][_partition]) {
            _holderPartitions[_holder].push(_partition);
            _holderHasPartition[_holder][_partition] = true;
        }
    }

    function _computeReleasable(VestingSchedule memory _schedule) internal view returns (uint256) {
        if (_schedule.totalAmount == 0) return 0;
        if (block.timestamp < _schedule.startTime + _schedule.cliffDuration) return 0;

        uint256 elapsed = block.timestamp - _schedule.startTime;
        uint256 vested;
        if (elapsed >= _schedule.vestingDuration) {
            vested = _schedule.totalAmount;
        } else {
            vested = (_schedule.totalAmount * elapsed) / _schedule.vestingDuration;
        }
        return vested - _schedule.released;
    }
}
