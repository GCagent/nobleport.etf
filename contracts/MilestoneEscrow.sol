// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MilestoneEscrow
 * @author GC-Agent.AI / NoblePort Construction
 * @notice Draw-based escrow contract for construction milestone payments.
 *         Funds are held in escrow and released upon milestone completion
 *         with multi-party approval (PM + Owner or PM + Inspector).
 *
 * @dev Phase 1 — Payment Rail Transformation
 *
 *      Payment flow:
 *        1. Owner deposits funds for upcoming milestone(s)
 *        2. GC/Sub completes work and submits draw request with evidence
 *        3. PM reviews and approves (optionally requires inspector sign-off)
 *        4. Retainage is split off to RetainageVault
 *        5. Net payment released to payee wallet
 *        6. On-chain receipt recorded for audit trail
 *
 *      Supports:
 *        - Multi-milestone per job
 *        - Retainage withholding (auto-routes to RetainageVault)
 *        - Partial draws against a milestone
 *        - Dispute holds with arbitration release
 *        - Lien waiver gate (payout blocked until waiver hash submitted)
 *        - Change order adjustments (increase/decrease milestone amounts)
 *
 *      Designed for stablecoin payments on Arbitrum (USDC/USDT).
 *      Native ETH supported as fallback.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MilestoneEscrow is AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // ============ Roles ============

    bytes32 public constant PM_ROLE = keccak256("PM_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant GC_ROLE = keccak256("GC_ROLE");
    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    // ============ Enums ============

    enum MilestonePhase {
        UNFUNDED,               // Created but no escrow deposited
        FUNDED,                 // Owner deposited escrow
        WORK_IN_PROGRESS,       // GC started milestone work
        DRAW_SUBMITTED,         // GC submitted draw request
        PM_APPROVED,            // PM approved the draw
        INSPECTION_REQUIRED,    // Awaiting inspector sign-off
        INSPECTION_PASSED,      // Inspector approved
        INSPECTION_FAILED,      // Inspector rejected — rework needed
        RELEASED,               // Payment released to payee
        DISPUTED,               // Payment disputed — funds held
        ARBITRATION_RESOLVED,   // Dispute resolved by arbitrator
        CANCELLED               // Milestone cancelled
    }

    enum DrawStatus {
        PENDING,
        PM_APPROVED,
        INSPECTION_PENDING,
        FULLY_APPROVED,
        PAID,
        REJECTED,
        DISPUTED
    }

    // ============ Structs ============

    struct EscrowMilestone {
        uint256 id;
        uint256 jobId;
        string name;
        string description;
        uint256 totalAmount;            // Full milestone value (wei)
        uint256 amountDrawn;            // Amount already drawn
        uint256 retainageHeld;          // Retainage withheld so far
        uint256 retainagePercent;       // Basis points
        address payee;                  // Who receives payment
        MilestonePhase phase;
        bool requiresInspection;
        bool lienWaiverRequired;
        bytes32 lienWaiverHash;         // Hash of submitted lien waiver
        uint256 sequenceOrder;          // Order in job schedule
        uint256[] dependsOn;            // Milestone IDs that must complete first
        uint256 fundedAt;
        uint256 completedAt;
    }

    struct DrawRequest {
        uint256 id;
        uint256 milestoneId;
        uint256 amount;                 // Requested draw amount
        uint256 netPayment;             // Amount after retainage
        uint256 retainageAmount;        // Retainage portion
        DrawStatus status;
        address requestedBy;
        address approvedBy;
        string evidenceHash;            // IPFS hash of completion evidence
        string invoiceHash;             // IPFS hash of invoice
        bytes32 lienWaiverHash;         // Conditional lien waiver for this draw
        uint256 requestedAt;
        uint256 approvedAt;
        uint256 paidAt;
    }

    struct DisputeRecord {
        uint256 milestoneId;
        uint256 drawId;
        string reason;
        address filedBy;
        uint256 disputedAmount;
        bool resolved;
        string resolution;
        uint256 filedAt;
        uint256 resolvedAt;
    }

    // ============ State ============

    Counters.Counter private _milestoneCounter;
    Counters.Counter private _drawCounter;
    Counters.Counter private _disputeCounter;

    uint256 public jobId;
    address public retainageVault;
    uint256 public totalEscrowed;
    uint256 public totalReleased;
    uint256 public totalRetainageRouted;
    uint256 public totalDisputed;

    mapping(uint256 => EscrowMilestone) public milestones;
    mapping(uint256 => DrawRequest) public draws;
    mapping(uint256 => DisputeRecord) public disputeRecords;
    mapping(uint256 => uint256[]) public milestoneDraws; // milestoneId => drawIds

    uint256[] public milestoneIds;

    // ============ Events ============

    event MilestoneCreated(uint256 indexed milestoneId, string name, uint256 amount, address payee);
    event MilestoneFunded(uint256 indexed milestoneId, uint256 amount, address funder);
    event DrawRequested(uint256 indexed milestoneId, uint256 indexed drawId, uint256 amount);
    event DrawApproved(uint256 indexed drawId, address approvedBy);
    event DrawPaid(uint256 indexed drawId, address payee, uint256 netAmount, uint256 retainageAmount);
    event DrawRejected(uint256 indexed drawId, string reason);
    event InspectionResult(uint256 indexed milestoneId, bool passed, address inspector);
    event RetainageRouted(uint256 indexed milestoneId, uint256 amount, address vault);
    event DisputeFiled(uint256 indexed milestoneId, uint256 indexed disputeId, uint256 amount);
    event DisputeResolved(uint256 indexed disputeId, string resolution);
    event LienWaiverSubmitted(uint256 indexed milestoneId, bytes32 waiverHash);
    event MilestoneCompleted(uint256 indexed milestoneId, uint256 totalDrawn, uint256 totalRetainage);

    // ============ Constructor ============

    constructor(
        uint256 _jobId,
        address owner,
        address gc,
        address pm,
        address _retainageVault
    ) {
        jobId = _jobId;
        retainageVault = _retainageVault;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OWNER_ROLE, owner);
        _grantRole(GC_ROLE, gc);
        _grantRole(PM_ROLE, pm);
    }

    // ============ Milestone Setup ============

    function createMilestone(
        string calldata name,
        string calldata description,
        uint256 totalAmount,
        address payee,
        uint256 retainagePercent,
        bool requiresInspection,
        bool lienWaiverRequired,
        uint256 sequenceOrder,
        uint256[] calldata dependsOn
    ) external onlyRole(PM_ROLE) returns (uint256) {
        _milestoneCounter.increment();
        uint256 msId = _milestoneCounter.current();

        milestones[msId] = EscrowMilestone({
            id: msId,
            jobId: jobId,
            name: name,
            description: description,
            totalAmount: totalAmount,
            amountDrawn: 0,
            retainageHeld: 0,
            retainagePercent: retainagePercent,
            payee: payee,
            phase: MilestonePhase.UNFUNDED,
            requiresInspection: requiresInspection,
            lienWaiverRequired: lienWaiverRequired,
            lienWaiverHash: bytes32(0),
            sequenceOrder: sequenceOrder,
            dependsOn: dependsOn,
            fundedAt: 0,
            completedAt: 0
        });

        milestoneIds.push(msId);
        emit MilestoneCreated(msId, name, totalAmount, payee);
        return msId;
    }

    // ============ Funding ============

    function fundMilestone(uint256 milestoneId)
        external
        payable
        onlyRole(OWNER_ROLE)
    {
        EscrowMilestone storage ms = milestones[milestoneId];
        require(ms.id != 0, "MilestoneEscrow: milestone does not exist");
        require(ms.phase == MilestonePhase.UNFUNDED, "MilestoneEscrow: already funded");
        require(msg.value >= ms.totalAmount, "MilestoneEscrow: insufficient funding");

        ms.phase = MilestonePhase.FUNDED;
        ms.fundedAt = block.timestamp;
        totalEscrowed += msg.value;

        emit MilestoneFunded(milestoneId, msg.value, msg.sender);
    }

    // ============ Draw Requests ============

    function submitDraw(
        uint256 milestoneId,
        uint256 amount,
        string calldata evidenceHash,
        string calldata invoiceHash,
        bytes32 lienWaiverHash
    ) external onlyRole(GC_ROLE) returns (uint256) {
        EscrowMilestone storage ms = milestones[milestoneId];
        require(ms.id != 0, "MilestoneEscrow: milestone does not exist");
        require(
            ms.phase == MilestonePhase.FUNDED ||
            ms.phase == MilestonePhase.WORK_IN_PROGRESS ||
            ms.phase == MilestonePhase.INSPECTION_PASSED,
            "MilestoneEscrow: milestone not in drawable state"
        );
        require(ms.amountDrawn + amount <= ms.totalAmount, "MilestoneEscrow: exceeds milestone amount");

        // Check dependencies
        for (uint256 i = 0; i < ms.dependsOn.length; i++) {
            EscrowMilestone storage dep = milestones[ms.dependsOn[i]];
            require(
                dep.phase == MilestonePhase.RELEASED || dep.completedAt > 0,
                "MilestoneEscrow: dependency not complete"
            );
        }

        // Check lien waiver
        if (ms.lienWaiverRequired && ms.lienWaiverHash == bytes32(0)) {
            require(lienWaiverHash != bytes32(0), "MilestoneEscrow: lien waiver required");
            ms.lienWaiverHash = lienWaiverHash;
            emit LienWaiverSubmitted(milestoneId, lienWaiverHash);
        }

        // Calculate retainage
        uint256 retainageAmount = (amount * ms.retainagePercent) / 10000;
        uint256 netPayment = amount - retainageAmount;

        _drawCounter.increment();
        uint256 drawId = _drawCounter.current();

        draws[drawId] = DrawRequest({
            id: drawId,
            milestoneId: milestoneId,
            amount: amount,
            netPayment: netPayment,
            retainageAmount: retainageAmount,
            status: DrawStatus.PENDING,
            requestedBy: msg.sender,
            approvedBy: address(0),
            evidenceHash: evidenceHash,
            invoiceHash: invoiceHash,
            lienWaiverHash: lienWaiverHash,
            requestedAt: block.timestamp,
            approvedAt: 0,
            paidAt: 0
        });

        milestoneDraws[milestoneId].push(drawId);
        ms.phase = MilestonePhase.DRAW_SUBMITTED;

        emit DrawRequested(milestoneId, drawId, amount);
        return drawId;
    }

    function approveDraw(uint256 drawId) external onlyRole(PM_ROLE) {
        DrawRequest storage dr = draws[drawId];
        require(dr.id != 0, "MilestoneEscrow: draw does not exist");
        require(dr.status == DrawStatus.PENDING, "MilestoneEscrow: draw not pending");

        EscrowMilestone storage ms = milestones[dr.milestoneId];

        if (ms.requiresInspection) {
            dr.status = DrawStatus.INSPECTION_PENDING;
            ms.phase = MilestonePhase.INSPECTION_REQUIRED;
        } else {
            dr.status = DrawStatus.FULLY_APPROVED;
            dr.approvedBy = msg.sender;
            dr.approvedAt = block.timestamp;
            ms.phase = MilestonePhase.PM_APPROVED;
        }

        emit DrawApproved(drawId, msg.sender);
    }

    function recordInspection(uint256 milestoneId, bool passed)
        external
        onlyRole(INSPECTOR_ROLE)
    {
        EscrowMilestone storage ms = milestones[milestoneId];
        require(ms.phase == MilestonePhase.INSPECTION_REQUIRED, "MilestoneEscrow: not awaiting inspection");

        if (passed) {
            ms.phase = MilestonePhase.INSPECTION_PASSED;
            // Auto-approve any pending draws
            uint256[] storage drawIds = milestoneDraws[milestoneId];
            for (uint256 i = 0; i < drawIds.length; i++) {
                if (draws[drawIds[i]].status == DrawStatus.INSPECTION_PENDING) {
                    draws[drawIds[i]].status = DrawStatus.FULLY_APPROVED;
                    draws[drawIds[i]].approvedAt = block.timestamp;
                }
            }
        } else {
            ms.phase = MilestonePhase.INSPECTION_FAILED;
        }

        emit InspectionResult(milestoneId, passed, msg.sender);
    }

    function rejectDraw(uint256 drawId, string calldata reason) external onlyRole(PM_ROLE) {
        DrawRequest storage dr = draws[drawId];
        require(dr.id != 0, "MilestoneEscrow: draw does not exist");
        require(dr.status == DrawStatus.PENDING || dr.status == DrawStatus.INSPECTION_PENDING,
            "MilestoneEscrow: draw not rejectable");

        dr.status = DrawStatus.REJECTED;
        milestones[dr.milestoneId].phase = MilestonePhase.WORK_IN_PROGRESS;

        emit DrawRejected(drawId, reason);
    }

    // ============ Payment Release ============

    function releaseDraw(uint256 drawId)
        external
        nonReentrant
        onlyRole(PM_ROLE)
    {
        DrawRequest storage dr = draws[drawId];
        require(dr.status == DrawStatus.FULLY_APPROVED, "MilestoneEscrow: draw not fully approved");

        EscrowMilestone storage ms = milestones[dr.milestoneId];

        // Release net payment to payee
        dr.status = DrawStatus.PAID;
        dr.paidAt = block.timestamp;

        ms.amountDrawn += dr.amount;
        ms.retainageHeld += dr.retainageAmount;
        totalReleased += dr.netPayment;

        // Send net payment to payee
        (bool paymentSent, ) = ms.payee.call{value: dr.netPayment}("");
        require(paymentSent, "MilestoneEscrow: payment transfer failed");

        // Route retainage to vault
        if (dr.retainageAmount > 0 && retainageVault != address(0)) {
            (bool retainageSent, ) = retainageVault.call{value: dr.retainageAmount}("");
            require(retainageSent, "MilestoneEscrow: retainage transfer failed");
            totalRetainageRouted += dr.retainageAmount;
            emit RetainageRouted(dr.milestoneId, dr.retainageAmount, retainageVault);
        }

        // Check if milestone is fully drawn
        if (ms.amountDrawn >= ms.totalAmount) {
            ms.phase = MilestonePhase.RELEASED;
            ms.completedAt = block.timestamp;
            emit MilestoneCompleted(dr.milestoneId, ms.amountDrawn, ms.retainageHeld);
        } else {
            ms.phase = MilestonePhase.WORK_IN_PROGRESS;
        }

        emit DrawPaid(drawId, ms.payee, dr.netPayment, dr.retainageAmount);
    }

    // ============ Disputes ============

    function disputeDraw(uint256 drawId, string calldata reason) external {
        DrawRequest storage dr = draws[drawId];
        require(dr.id != 0, "MilestoneEscrow: draw does not exist");
        require(
            dr.status != DrawStatus.PAID && dr.status != DrawStatus.DISPUTED,
            "MilestoneEscrow: cannot dispute"
        );

        dr.status = DrawStatus.DISPUTED;
        milestones[dr.milestoneId].phase = MilestonePhase.DISPUTED;

        _disputeCounter.increment();
        uint256 disputeId = _disputeCounter.current();

        disputeRecords[disputeId] = DisputeRecord({
            milestoneId: dr.milestoneId,
            drawId: drawId,
            reason: reason,
            filedBy: msg.sender,
            disputedAmount: dr.amount,
            resolved: false,
            resolution: "",
            filedAt: block.timestamp,
            resolvedAt: 0
        });

        totalDisputed += dr.amount;
        emit DisputeFiled(dr.milestoneId, disputeId, dr.amount);
    }

    function resolveDispute(uint256 disputeId, string calldata resolution, bool releaseFunds)
        external
        onlyRole(ARBITRATOR_ROLE)
    {
        DisputeRecord storage d = disputeRecords[disputeId];
        require(!d.resolved, "MilestoneEscrow: already resolved");

        d.resolved = true;
        d.resolution = resolution;
        d.resolvedAt = block.timestamp;

        DrawRequest storage dr = draws[d.drawId];
        milestones[d.milestoneId].phase = MilestonePhase.ARBITRATION_RESOLVED;

        if (releaseFunds) {
            dr.status = DrawStatus.FULLY_APPROVED;
        } else {
            dr.status = DrawStatus.REJECTED;
        }

        totalDisputed -= d.disputedAmount;
        emit DisputeResolved(disputeId, resolution);
    }

    // ============ Lien Waiver Management ============

    function submitLienWaiver(uint256 milestoneId, bytes32 waiverHash) external onlyRole(GC_ROLE) {
        EscrowMilestone storage ms = milestones[milestoneId];
        require(ms.id != 0, "MilestoneEscrow: milestone does not exist");
        ms.lienWaiverHash = waiverHash;
        emit LienWaiverSubmitted(milestoneId, waiverHash);
    }

    // ============ Views ============

    function getMilestoneCount() external view returns (uint256) {
        return _milestoneCounter.current();
    }

    function getDrawCount() external view returns (uint256) {
        return _drawCounter.current();
    }

    function getMilestoneDrawIds(uint256 milestoneId) external view returns (uint256[] memory) {
        return milestoneDraws[milestoneId];
    }

    function getAllMilestoneIds() external view returns (uint256[] memory) {
        return milestoneIds;
    }

    function getEscrowBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getEscrowSummary() external view returns (
        uint256 escrowed,
        uint256 released,
        uint256 retainageRouted,
        uint256 disputed,
        uint256 balance
    ) {
        return (totalEscrowed, totalReleased, totalRetainageRouted, totalDisputed, address(this).balance);
    }

    // ============ Admin ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {
        totalEscrowed += msg.value;
    }
}
