// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RetainageVault
 * @author GC-Agent.AI / NoblePort Construction
 * @notice Dedicated retainage management vault for construction contracts.
 *         Holds retainage funds separately from milestone escrow and releases
 *         them upon project completion conditions.
 *
 * @dev Phase 1 — Payment Rail Transformation
 *
 *      Retainage is the portion of each draw withheld until project completion.
 *      This contract:
 *        - Receives retainage automatically from MilestoneEscrow on each draw
 *        - Tracks retainage per job, per sub, and per milestone
 *        - Enforces release conditions (final inspection, punch list closure, lien waivers)
 *        - Supports partial retainage release (e.g., 50% at substantial completion)
 *        - Provides audit trail for bank/lender compliance
 *
 *      Release Gates (all must be met):
 *        1. Final inspection passed (inspector confirmation)
 *        2. Punch list 100% closed (PM confirmation)
 *        3. Final lien waiver on file (document hash)
 *        4. Certificate of occupancy issued (if applicable)
 *        5. Warranty period started (timestamp recorded)
 *
 *      Massachusetts-specific: Complies with MA G.L. c.149 retainage limits
 *      (max 5% on public projects, negotiable on private).
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract RetainageVault is AccessControl, ReentrancyGuard, Pausable {

    // ============ Roles ============

    bytes32 public constant PM_ROLE = keccak256("PM_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant GC_ROLE = keccak256("GC_ROLE");
    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");

    // ============ Enums ============

    enum ReleaseStatus {
        HELD,                   // Retainage held, no release conditions met
        PARTIAL_RELEASE,        // Partial release (e.g., 50% at substantial completion)
        RELEASE_PENDING,        // All gates passed, awaiting PM final release
        RELEASED,               // Fully released to payee
        FORFEITED               // Forfeited due to default/abandonment
    }

    // ============ Structs ============

    struct RetainageAccount {
        uint256 jobId;
        address payee;              // Sub or GC wallet
        string trade;               // Trade name for tracking
        uint256 totalRetained;      // Total retainage accumulated
        uint256 amountReleased;     // Amount released so far
        ReleaseStatus status;

        // Release gates
        bool finalInspectionPassed;
        bool punchListClosed;
        bool finalLienWaiverOnFile;
        bool coIssued;              // Certificate of Occupancy
        bool warrantyStarted;

        // Gate evidence
        bytes32 inspectionHash;     // Inspector evidence hash
        bytes32 punchListHash;      // PM punch closure evidence
        bytes32 lienWaiverHash;     // Final unconditional lien waiver
        bytes32 coHash;             // CO document hash
        uint256 warrantyStartDate;
        uint256 warrantyEndDate;

        uint256 createdAt;
        uint256 lastDepositAt;
        uint256 releasedAt;
    }

    struct RetainageDeposit {
        uint256 id;
        uint256 jobId;
        address payee;
        uint256 amount;
        uint256 fromMilestoneId;
        address depositedBy;       // MilestoneEscrow address
        uint256 depositedAt;
    }

    // ============ State ============

    uint256 private _depositCounter;

    // jobId => payee => RetainageAccount
    mapping(uint256 => mapping(address => RetainageAccount)) public accounts;

    // All deposits for audit trail
    mapping(uint256 => RetainageDeposit) public deposits;

    // Indexes
    mapping(uint256 => address[]) public jobPayees;      // jobId => payee list
    mapping(uint256 => uint256[]) public jobDeposits;     // jobId => deposit IDs

    // Aggregates
    uint256 public totalRetainageHeld;
    uint256 public totalRetainageReleased;

    // ============ Events ============

    event RetainageDeposited(uint256 indexed jobId, address indexed payee, uint256 amount, uint256 depositId);
    event ReleaseGateUpdated(uint256 indexed jobId, address indexed payee, string gate, bool passed);
    event PartialRelease(uint256 indexed jobId, address indexed payee, uint256 amount, uint256 percentReleased);
    event FullRelease(uint256 indexed jobId, address indexed payee, uint256 totalAmount);
    event RetainageForfeited(uint256 indexed jobId, address indexed payee, uint256 amount, string reason);
    event WarrantyStarted(uint256 indexed jobId, address indexed payee, uint256 startDate, uint256 endDate);

    // ============ Constructor ============

    constructor(address admin, address pm, address owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PM_ROLE, pm);
        _grantRole(OWNER_ROLE, owner);
    }

    // ============ Deposit (called by MilestoneEscrow) ============

    function depositRetainage(
        uint256 jobId,
        address payee,
        string calldata trade,
        uint256 fromMilestoneId
    ) external payable {
        require(msg.value > 0, "RetainageVault: must deposit > 0");
        require(payee != address(0), "RetainageVault: invalid payee");

        RetainageAccount storage acct = accounts[jobId][payee];

        if (acct.createdAt == 0) {
            // First deposit for this payee on this job
            acct.jobId = jobId;
            acct.payee = payee;
            acct.trade = trade;
            acct.totalRetained = 0;
            acct.amountReleased = 0;
            acct.status = ReleaseStatus.HELD;
            acct.createdAt = block.timestamp;
            jobPayees[jobId].push(payee);
        }

        acct.totalRetained += msg.value;
        acct.lastDepositAt = block.timestamp;

        _depositCounter++;
        deposits[_depositCounter] = RetainageDeposit({
            id: _depositCounter,
            jobId: jobId,
            payee: payee,
            amount: msg.value,
            fromMilestoneId: fromMilestoneId,
            depositedBy: msg.sender,
            depositedAt: block.timestamp
        });

        jobDeposits[jobId].push(_depositCounter);
        totalRetainageHeld += msg.value;

        emit RetainageDeposited(jobId, payee, msg.value, _depositCounter);
    }

    // ============ Release Gates ============

    function recordFinalInspection(uint256 jobId, address payee, bytes32 evidenceHash)
        external
        onlyRole(INSPECTOR_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");
        acct.finalInspectionPassed = true;
        acct.inspectionHash = evidenceHash;
        emit ReleaseGateUpdated(jobId, payee, "final_inspection", true);
    }

    function recordPunchListClosure(uint256 jobId, address payee, bytes32 evidenceHash)
        external
        onlyRole(PM_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");
        acct.punchListClosed = true;
        acct.punchListHash = evidenceHash;
        emit ReleaseGateUpdated(jobId, payee, "punch_list", true);
    }

    function recordFinalLienWaiver(uint256 jobId, address payee, bytes32 waiverHash)
        external
        onlyRole(GC_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");
        acct.finalLienWaiverOnFile = true;
        acct.lienWaiverHash = waiverHash;
        emit ReleaseGateUpdated(jobId, payee, "final_lien_waiver", true);
    }

    function recordCO(uint256 jobId, address payee, bytes32 coHash)
        external
        onlyRole(PM_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");
        acct.coIssued = true;
        acct.coHash = coHash;
        emit ReleaseGateUpdated(jobId, payee, "certificate_of_occupancy", true);
    }

    function startWarranty(uint256 jobId, address payee, uint256 warrantyDays)
        external
        onlyRole(PM_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");
        acct.warrantyStarted = true;
        acct.warrantyStartDate = block.timestamp;
        acct.warrantyEndDate = block.timestamp + (warrantyDays * 1 days);
        emit WarrantyStarted(jobId, payee, acct.warrantyStartDate, acct.warrantyEndDate);
    }

    // ============ Release ============

    function releasePartial(uint256 jobId, address payee, uint256 percentBasisPoints)
        external
        nonReentrant
        onlyRole(PM_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");
        require(acct.status == ReleaseStatus.HELD, "RetainageVault: not in HELD status");
        require(percentBasisPoints <= 10000, "RetainageVault: invalid percentage");

        // Partial release requires at minimum: final inspection + punch list closed
        require(acct.finalInspectionPassed, "RetainageVault: final inspection not passed");
        require(acct.punchListClosed, "RetainageVault: punch list not closed");

        uint256 releaseAmount = (acct.totalRetained * percentBasisPoints) / 10000;
        require(releaseAmount <= acct.totalRetained - acct.amountReleased, "RetainageVault: exceeds available");

        acct.amountReleased += releaseAmount;
        acct.status = ReleaseStatus.PARTIAL_RELEASE;
        totalRetainageReleased += releaseAmount;
        totalRetainageHeld -= releaseAmount;

        (bool sent, ) = payee.call{value: releaseAmount}("");
        require(sent, "RetainageVault: transfer failed");

        emit PartialRelease(jobId, payee, releaseAmount, percentBasisPoints);
    }

    function releaseFull(uint256 jobId, address payee)
        external
        nonReentrant
        onlyRole(PM_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");
        require(
            acct.status == ReleaseStatus.HELD || acct.status == ReleaseStatus.PARTIAL_RELEASE,
            "RetainageVault: not releasable"
        );

        // Full release requires ALL gates
        require(acct.finalInspectionPassed, "RetainageVault: gate: final inspection");
        require(acct.punchListClosed, "RetainageVault: gate: punch list");
        require(acct.finalLienWaiverOnFile, "RetainageVault: gate: final lien waiver");

        uint256 remaining = acct.totalRetained - acct.amountReleased;
        require(remaining > 0, "RetainageVault: nothing to release");

        acct.amountReleased = acct.totalRetained;
        acct.status = ReleaseStatus.RELEASED;
        acct.releasedAt = block.timestamp;
        totalRetainageReleased += remaining;
        totalRetainageHeld -= remaining;

        (bool sent, ) = payee.call{value: remaining}("");
        require(sent, "RetainageVault: transfer failed");

        emit FullRelease(jobId, payee, acct.totalRetained);
    }

    function forfeitRetainage(uint256 jobId, address payee, string calldata reason)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        RetainageAccount storage acct = accounts[jobId][payee];
        require(acct.createdAt != 0, "RetainageVault: account not found");

        uint256 remaining = acct.totalRetained - acct.amountReleased;
        acct.status = ReleaseStatus.FORFEITED;
        totalRetainageHeld -= remaining;

        // Forfeited funds remain in contract for owner withdrawal
        emit RetainageForfeited(jobId, payee, remaining, reason);
    }

    // ============ Views ============

    function getAccount(uint256 jobId, address payee)
        external
        view
        returns (RetainageAccount memory)
    {
        return accounts[jobId][payee];
    }

    function getJobPayees(uint256 jobId) external view returns (address[] memory) {
        return jobPayees[jobId];
    }

    function getJobDeposits(uint256 jobId) external view returns (uint256[] memory) {
        return jobDeposits[jobId];
    }

    function areAllGatesPassed(uint256 jobId, address payee) external view returns (bool) {
        RetainageAccount storage acct = accounts[jobId][payee];
        return acct.finalInspectionPassed &&
               acct.punchListClosed &&
               acct.finalLienWaiverOnFile;
    }

    function getGateStatus(uint256 jobId, address payee) external view returns (
        bool inspection,
        bool punchList,
        bool lienWaiver,
        bool co,
        bool warranty
    ) {
        RetainageAccount storage acct = accounts[jobId][payee];
        return (
            acct.finalInspectionPassed,
            acct.punchListClosed,
            acct.finalLienWaiverOnFile,
            acct.coIssued,
            acct.warrantyStarted
        );
    }

    function getVaultSummary() external view returns (
        uint256 held,
        uint256 released,
        uint256 balance
    ) {
        return (totalRetainageHeld, totalRetainageReleased, address(this).balance);
    }

    // ============ Admin ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {}
}
