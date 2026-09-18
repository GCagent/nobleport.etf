// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GCagentProjectManagement
 * @author NoblePort ETF - PMagent Module
 * @notice Smart contract for on-chain construction project management
 * @dev Implements milestone-based payouts, role-based access, change orders,
 *      punch lists, daily logs, permit tracking, and investor dashboards
 *      for the GCagent dApp ecosystem.
 *
 * Roles:
 *   OWNER_ROLE      - Property owner / client
 *   GC_ROLE         - General contractor
 *   PM_ROLE         - Project manager
 *   SUB_ROLE        - Subcontractor
 *   INSPECTOR_ROLE  - Inspector
 *   INVESTOR_ROLE   - Capital investor / LP
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract GCagentProjectManagement is AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // ============ Role Constants ============

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant GC_ROLE = keccak256("GC_ROLE");
    bytes32 public constant PM_ROLE = keccak256("PM_ROLE");
    bytes32 public constant SUB_ROLE = keccak256("SUB_ROLE");
    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");
    bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");

    // ============ Enums ============

    enum ProjectStatus {
        DRAFT,
        ACTIVE,
        ON_HOLD,
        COMPLETED,
        CANCELLED
    }

    enum MilestoneStatus {
        PENDING,
        IN_PROGRESS,
        AWAITING_APPROVAL,
        APPROVED,
        PAID,
        DISPUTED
    }

    enum ChangeOrderStatus {
        SUBMITTED,
        UNDER_REVIEW,
        APPROVED,
        REJECTED,
        SIGNED,
        EXECUTED
    }

    enum PunchItemStatus {
        OPEN,
        IN_PROGRESS,
        READY_FOR_REVIEW,
        CLOSED,
        DISPUTED
    }

    enum InspectionStatus {
        SCHEDULED,
        PASSED,
        FAILED,
        RESCHEDULED,
        CANCELLED
    }

    enum PermitStatus {
        APPLIED,
        UNDER_REVIEW,
        APPROVED,
        ACTIVE,
        EXPIRED,
        REVOKED
    }

    enum DisputeStatus {
        FILED,
        EVIDENCE_GATHERING,
        IN_ARBITRATION,
        RESOLVED,
        ESCALATED
    }

    // ============ Structs ============

    struct Project {
        uint256 id;
        string name;
        string locationHash;            // IPFS hash of project address/location data
        address owner;
        address generalContractor;
        address projectManager;
        uint256 totalBudget;             // in wei (stablecoin or ETH)
        uint256 budgetSpent;
        uint256 startDate;
        uint256 estimatedEndDate;
        ProjectStatus status;
        string planSetHash;              // IPFS hash of plan set documents
        uint256 milestoneCount;
        uint256 changeOrderCount;
        uint256 punchItemCount;
        uint256 inspectionCount;
        uint256 dailyLogCount;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct Milestone {
        uint256 id;
        uint256 projectId;
        string name;
        string description;
        uint256 payoutAmount;
        address payee;                   // wallet to receive payout
        uint256 dueDate;
        MilestoneStatus status;
        uint256 completedAt;
        address approvedBy;
        string evidenceHash;             // IPFS hash of completion evidence
        uint256[] dependsOn;             // milestone IDs that must complete first
    }

    struct ChangeOrder {
        uint256 id;
        uint256 projectId;
        string description;
        int256 costImpact;               // positive = cost increase, negative = savings
        int256 scheduleImpact;           // days added/removed
        ChangeOrderStatus status;
        address submittedBy;
        address approvedBy;
        bytes32 documentHash;            // keccak256 of the full change order document
        string ipfsHash;                 // IPFS hash of supporting documents
        uint256 submittedAt;
        uint256 resolvedAt;
    }

    struct PunchItem {
        uint256 id;
        uint256 projectId;
        string description;
        string locationInProject;
        address responsibleTrade;        // wallet of responsible sub
        PunchItemStatus status;
        string[] photoHashes;            // IPFS hashes of photos
        uint256 createdAt;
        uint256 closedAt;
        address closedBy;
    }

    struct DailyLog {
        uint256 id;
        uint256 projectId;
        uint256 logDate;
        address loggedBy;
        bytes32 contentHash;             // keccak256 of log content for tamper evidence
        string ipfsHash;                 // IPFS hash of full log (voice/text)
        uint256 workersOnSite;
        string weatherConditions;
        uint256 createdAt;
    }

    struct Inspection {
        uint256 id;
        uint256 projectId;
        string inspectionType;
        InspectionStatus status;
        address inspector;
        uint256 scheduledDate;
        uint256 completedDate;
        string notes;
        string[] evidenceHashes;         // IPFS hashes of inspection photos/docs
        bool passed;
    }

    struct Permit {
        uint256 id;
        uint256 projectId;
        string permitType;
        string jurisdiction;
        PermitStatus status;
        string permitNumber;
        uint256 applicationDate;
        uint256 approvalDate;
        uint256 expirationDate;
        string documentHash;             // IPFS hash of permit document
    }

    struct SubcontractorAssignment {
        address subWallet;
        uint256 projectId;
        string trade;
        uint256 contractAmount;
        uint256 amountPaid;
        bool coiVerified;
        bool licenseVerified;
        bool lienWaiverOnFile;
        uint256 assignedAt;
    }

    struct MaterialOrder {
        uint256 id;
        uint256 projectId;
        string vendor;
        string description;
        uint256 cost;
        string deliveryStatus;
        uint256 orderedAt;
        uint256 deliveredAt;
        bytes32 confirmationHash;        // on-chain confirmation of receipt
    }

    struct LaborEntry {
        uint256 id;
        uint256 projectId;
        address worker;
        uint256 date;
        uint256 hoursWorked;             // in minutes for precision
        string taskDescription;
        uint256 loggedAt;
    }

    struct Dispute {
        uint256 id;
        uint256 projectId;
        string description;
        address filedBy;
        address against;
        DisputeStatus status;
        string[] evidenceHashes;         // IPFS hashes of evidence
        uint256 filedAt;
        uint256 resolvedAt;
        string resolution;
    }

    struct ComplianceDoc {
        uint256 id;
        uint256 projectId;
        string docType;                  // COI, license, lien-waiver, contract, etc.
        address relatedParty;
        string ipfsHash;
        bytes32 contentHash;
        uint256 uploadedAt;
        uint256 expiresAt;
        bool verified;
    }

    struct InvestorStake {
        address investor;
        uint256 projectId;
        uint256 stakedAmount;
        uint256 sharePercentage;         // basis points (10000 = 100%)
        bool kycVerified;
        uint256 stakedAt;
    }

    // ============ State Variables ============

    Counters.Counter private _projectCounter;
    Counters.Counter private _milestoneCounter;
    Counters.Counter private _changeOrderCounter;
    Counters.Counter private _punchItemCounter;
    Counters.Counter private _dailyLogCounter;
    Counters.Counter private _inspectionCounter;
    Counters.Counter private _permitCounter;
    Counters.Counter private _materialOrderCounter;
    Counters.Counter private _laborEntryCounter;
    Counters.Counter private _disputeCounter;
    Counters.Counter private _complianceDocCounter;

    // Primary storage
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Milestone) public milestones;
    mapping(uint256 => ChangeOrder) public changeOrders;
    mapping(uint256 => PunchItem) public punchItems;
    mapping(uint256 => DailyLog) public dailyLogs;
    mapping(uint256 => Inspection) public inspections;
    mapping(uint256 => Permit) public permits;
    mapping(uint256 => MaterialOrder) public materialOrders;
    mapping(uint256 => LaborEntry) public laborEntries;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => ComplianceDoc) public complianceDocs;

    // Indexes
    mapping(uint256 => uint256[]) public projectMilestones;
    mapping(uint256 => uint256[]) public projectChangeOrders;
    mapping(uint256 => uint256[]) public projectPunchItems;
    mapping(uint256 => uint256[]) public projectDailyLogs;
    mapping(uint256 => uint256[]) public projectInspections;
    mapping(uint256 => uint256[]) public projectPermits;
    mapping(uint256 => uint256[]) public projectMaterialOrders;
    mapping(uint256 => uint256[]) public projectLaborEntries;
    mapping(uint256 => uint256[]) public projectDisputes;
    mapping(uint256 => uint256[]) public projectComplianceDocs;

    // Subcontractor assignments per project
    mapping(uint256 => mapping(address => SubcontractorAssignment)) public subAssignments;
    mapping(uint256 => address[]) public projectSubcontractors;

    // Investor stakes per project
    mapping(uint256 => mapping(address => InvestorStake)) public investorStakes;
    mapping(uint256 => address[]) public projectInvestors;
    mapping(uint256 => uint256) public projectTotalStaked;

    // ============ Events ============

    event ProjectCreated(uint256 indexed projectId, string name, address owner, address gc, uint256 budget);
    event ProjectStatusChanged(uint256 indexed projectId, ProjectStatus oldStatus, ProjectStatus newStatus);
    event MilestoneCreated(uint256 indexed projectId, uint256 indexed milestoneId, string name, uint256 payoutAmount);
    event MilestoneStatusChanged(uint256 indexed milestoneId, MilestoneStatus oldStatus, MilestoneStatus newStatus);
    event MilestonePaid(uint256 indexed milestoneId, address payee, uint256 amount);
    event ChangeOrderSubmitted(uint256 indexed projectId, uint256 indexed changeOrderId, int256 costImpact);
    event ChangeOrderStatusChanged(uint256 indexed changeOrderId, ChangeOrderStatus oldStatus, ChangeOrderStatus newStatus);
    event PunchItemCreated(uint256 indexed projectId, uint256 indexed punchItemId, address responsibleTrade);
    event PunchItemClosed(uint256 indexed punchItemId, address closedBy);
    event DailyLogCreated(uint256 indexed projectId, uint256 indexed logId, bytes32 contentHash);
    event InspectionScheduled(uint256 indexed projectId, uint256 indexed inspectionId, uint256 scheduledDate);
    event InspectionCompleted(uint256 indexed inspectionId, bool passed);
    event PermitUpdated(uint256 indexed projectId, uint256 indexed permitId, PermitStatus status);
    event SubcontractorAssigned(uint256 indexed projectId, address sub, string trade);
    event SubcontractorPaid(uint256 indexed projectId, address sub, uint256 amount);
    event MaterialOrderCreated(uint256 indexed projectId, uint256 indexed orderId, string vendor);
    event MaterialReceived(uint256 indexed orderId, bytes32 confirmationHash);
    event LaborLogged(uint256 indexed projectId, address worker, uint256 hoursMinutes);
    event DisputeFiled(uint256 indexed projectId, uint256 indexed disputeId, address filedBy);
    event DisputeResolved(uint256 indexed disputeId, string resolution);
    event ComplianceDocUploaded(uint256 indexed projectId, uint256 indexed docId, string docType);
    event InvestorStaked(uint256 indexed projectId, address investor, uint256 amount);
    event PayoutReleased(uint256 indexed projectId, address recipient, uint256 amount, string reason);

    // ============ Modifiers ============

    modifier onlyProjectRole(uint256 projectId, bytes32 role) {
        require(
            hasRole(role, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GCagentPM: insufficient role"
        );
        _;
    }

    modifier projectExists(uint256 projectId) {
        require(projects[projectId].createdAt != 0, "GCagentPM: project does not exist");
        _;
    }

    modifier projectActive(uint256 projectId) {
        require(projects[projectId].status == ProjectStatus.ACTIVE, "GCagentPM: project not active");
        _;
    }

    // ============ Constructor ============

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PM_ROLE, msg.sender);
    }

    // ============ Project Management ============

    function createProject(
        string calldata name,
        string calldata locationHash,
        address generalContractor,
        address projectManager,
        uint256 totalBudget,
        uint256 estimatedEndDate,
        string calldata planSetHash
    ) external onlyRole(OWNER_ROLE) returns (uint256) {
        _projectCounter.increment();
        uint256 projectId = _projectCounter.current();

        projects[projectId] = Project({
            id: projectId,
            name: name,
            locationHash: locationHash,
            owner: msg.sender,
            generalContractor: generalContractor,
            projectManager: projectManager,
            totalBudget: totalBudget,
            budgetSpent: 0,
            startDate: block.timestamp,
            estimatedEndDate: estimatedEndDate,
            status: ProjectStatus.DRAFT,
            planSetHash: planSetHash,
            milestoneCount: 0,
            changeOrderCount: 0,
            punchItemCount: 0,
            inspectionCount: 0,
            dailyLogCount: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Grant roles to GC and PM
        _grantRole(GC_ROLE, generalContractor);
        _grantRole(PM_ROLE, projectManager);

        emit ProjectCreated(projectId, name, msg.sender, generalContractor, totalBudget);
        return projectId;
    }

    function activateProject(uint256 projectId)
        external
        projectExists(projectId)
        onlyProjectRole(projectId, PM_ROLE)
    {
        Project storage p = projects[projectId];
        require(p.status == ProjectStatus.DRAFT, "GCagentPM: can only activate from DRAFT");
        ProjectStatus old = p.status;
        p.status = ProjectStatus.ACTIVE;
        p.updatedAt = block.timestamp;
        emit ProjectStatusChanged(projectId, old, ProjectStatus.ACTIVE);
    }

    function updateProjectStatus(uint256 projectId, ProjectStatus newStatus)
        external
        projectExists(projectId)
        onlyProjectRole(projectId, PM_ROLE)
    {
        Project storage p = projects[projectId];
        ProjectStatus old = p.status;
        p.status = newStatus;
        p.updatedAt = block.timestamp;
        emit ProjectStatusChanged(projectId, old, newStatus);
    }

    // ============ Milestone Management ============

    function createMilestone(
        uint256 projectId,
        string calldata name,
        string calldata description,
        uint256 payoutAmount,
        address payee,
        uint256 dueDate,
        uint256[] calldata dependsOn
    ) external projectExists(projectId) onlyProjectRole(projectId, PM_ROLE) returns (uint256) {
        _milestoneCounter.increment();
        uint256 milestoneId = _milestoneCounter.current();

        milestones[milestoneId] = Milestone({
            id: milestoneId,
            projectId: projectId,
            name: name,
            description: description,
            payoutAmount: payoutAmount,
            payee: payee,
            dueDate: dueDate,
            status: MilestoneStatus.PENDING,
            completedAt: 0,
            approvedBy: address(0),
            evidenceHash: "",
            dependsOn: dependsOn
        });

        projectMilestones[projectId].push(milestoneId);
        projects[projectId].milestoneCount++;
        projects[projectId].updatedAt = block.timestamp;

        emit MilestoneCreated(projectId, milestoneId, name, payoutAmount);
        return milestoneId;
    }

    function submitMilestoneForApproval(uint256 milestoneId, string calldata evidenceHash)
        external
    {
        Milestone storage m = milestones[milestoneId];
        require(m.id != 0, "GCagentPM: milestone does not exist");
        require(
            m.status == MilestoneStatus.PENDING || m.status == MilestoneStatus.IN_PROGRESS,
            "GCagentPM: invalid milestone status"
        );

        // Verify dependencies are completed
        for (uint256 i = 0; i < m.dependsOn.length; i++) {
            require(
                milestones[m.dependsOn[i]].status == MilestoneStatus.PAID ||
                milestones[m.dependsOn[i]].status == MilestoneStatus.APPROVED,
                "GCagentPM: dependency not met"
            );
        }

        m.status = MilestoneStatus.AWAITING_APPROVAL;
        m.evidenceHash = evidenceHash;
        m.completedAt = block.timestamp;

        emit MilestoneStatusChanged(milestoneId, MilestoneStatus.IN_PROGRESS, MilestoneStatus.AWAITING_APPROVAL);
    }

    function approveMilestone(uint256 milestoneId)
        external
        onlyRole(PM_ROLE)
    {
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.AWAITING_APPROVAL, "GCagentPM: not awaiting approval");
        m.status = MilestoneStatus.APPROVED;
        m.approvedBy = msg.sender;
        emit MilestoneStatusChanged(milestoneId, MilestoneStatus.AWAITING_APPROVAL, MilestoneStatus.APPROVED);
    }

    function payMilestone(uint256 milestoneId)
        external
        payable
        nonReentrant
        onlyRole(PM_ROLE)
    {
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.APPROVED, "GCagentPM: milestone not approved");
        require(msg.value >= m.payoutAmount, "GCagentPM: insufficient payment");

        m.status = MilestoneStatus.PAID;
        projects[m.projectId].budgetSpent += m.payoutAmount;
        projects[m.projectId].updatedAt = block.timestamp;

        (bool sent, ) = m.payee.call{value: m.payoutAmount}("");
        require(sent, "GCagentPM: payment failed");

        emit MilestonePaid(milestoneId, m.payee, m.payoutAmount);
        emit PayoutReleased(m.projectId, m.payee, m.payoutAmount, "milestone");
    }

    // ============ Change Order Management ============

    function submitChangeOrder(
        uint256 projectId,
        string calldata description,
        int256 costImpact,
        int256 scheduleImpact,
        bytes32 documentHash,
        string calldata ipfsHash
    ) external projectExists(projectId) projectActive(projectId) returns (uint256) {
        _changeOrderCounter.increment();
        uint256 coId = _changeOrderCounter.current();

        changeOrders[coId] = ChangeOrder({
            id: coId,
            projectId: projectId,
            description: description,
            costImpact: costImpact,
            scheduleImpact: scheduleImpact,
            status: ChangeOrderStatus.SUBMITTED,
            submittedBy: msg.sender,
            approvedBy: address(0),
            documentHash: documentHash,
            ipfsHash: ipfsHash,
            submittedAt: block.timestamp,
            resolvedAt: 0
        });

        projectChangeOrders[projectId].push(coId);
        projects[projectId].changeOrderCount++;
        projects[projectId].updatedAt = block.timestamp;

        emit ChangeOrderSubmitted(projectId, coId, costImpact);
        return coId;
    }

    function approveChangeOrder(uint256 changeOrderId)
        external
        onlyRole(PM_ROLE)
    {
        ChangeOrder storage co = changeOrders[changeOrderId];
        require(co.id != 0, "GCagentPM: change order does not exist");
        require(co.status == ChangeOrderStatus.SUBMITTED || co.status == ChangeOrderStatus.UNDER_REVIEW,
            "GCagentPM: cannot approve in current status");

        ChangeOrderStatus old = co.status;
        co.status = ChangeOrderStatus.APPROVED;
        co.approvedBy = msg.sender;
        co.resolvedAt = block.timestamp;

        // Adjust project budget
        if (co.costImpact > 0) {
            projects[co.projectId].totalBudget += uint256(co.costImpact);
        } else if (co.costImpact < 0) {
            projects[co.projectId].totalBudget -= uint256(-co.costImpact);
        }

        projects[co.projectId].updatedAt = block.timestamp;
        emit ChangeOrderStatusChanged(changeOrderId, old, ChangeOrderStatus.APPROVED);
    }

    function signChangeOrder(uint256 changeOrderId) external {
        ChangeOrder storage co = changeOrders[changeOrderId];
        require(co.status == ChangeOrderStatus.APPROVED, "GCagentPM: must be approved first");
        co.status = ChangeOrderStatus.SIGNED;
        emit ChangeOrderStatusChanged(changeOrderId, ChangeOrderStatus.APPROVED, ChangeOrderStatus.SIGNED);
    }

    // ============ Punch List Management ============

    function createPunchItem(
        uint256 projectId,
        string calldata description,
        string calldata locationInProject,
        address responsibleTrade,
        string[] calldata photoHashes
    ) external projectExists(projectId) returns (uint256) {
        _punchItemCounter.increment();
        uint256 itemId = _punchItemCounter.current();

        punchItems[itemId] = PunchItem({
            id: itemId,
            projectId: projectId,
            description: description,
            locationInProject: locationInProject,
            responsibleTrade: responsibleTrade,
            status: PunchItemStatus.OPEN,
            photoHashes: photoHashes,
            createdAt: block.timestamp,
            closedAt: 0,
            closedBy: address(0)
        });

        projectPunchItems[projectId].push(itemId);
        projects[projectId].punchItemCount++;
        projects[projectId].updatedAt = block.timestamp;

        emit PunchItemCreated(projectId, itemId, responsibleTrade);
        return itemId;
    }

    function closePunchItem(uint256 punchItemId) external onlyRole(PM_ROLE) {
        PunchItem storage item = punchItems[punchItemId];
        require(item.id != 0, "GCagentPM: punch item does not exist");
        require(item.status != PunchItemStatus.CLOSED, "GCagentPM: already closed");

        item.status = PunchItemStatus.CLOSED;
        item.closedAt = block.timestamp;
        item.closedBy = msg.sender;

        emit PunchItemClosed(punchItemId, msg.sender);
    }

    function updatePunchItemStatus(uint256 punchItemId, PunchItemStatus newStatus) external {
        PunchItem storage item = punchItems[punchItemId];
        require(item.id != 0, "GCagentPM: punch item does not exist");
        item.status = newStatus;
    }

    // ============ Daily Log Management ============

    function createDailyLog(
        uint256 projectId,
        uint256 logDate,
        bytes32 contentHash,
        string calldata ipfsHash,
        uint256 workersOnSite,
        string calldata weatherConditions
    ) external projectExists(projectId) returns (uint256) {
        _dailyLogCounter.increment();
        uint256 logId = _dailyLogCounter.current();

        dailyLogs[logId] = DailyLog({
            id: logId,
            projectId: projectId,
            logDate: logDate,
            loggedBy: msg.sender,
            contentHash: contentHash,
            ipfsHash: ipfsHash,
            workersOnSite: workersOnSite,
            weatherConditions: weatherConditions,
            createdAt: block.timestamp
        });

        projectDailyLogs[projectId].push(logId);
        projects[projectId].dailyLogCount++;
        projects[projectId].updatedAt = block.timestamp;

        emit DailyLogCreated(projectId, logId, contentHash);
        return logId;
    }

    // ============ Inspection Management ============

    function scheduleInspection(
        uint256 projectId,
        string calldata inspectionType,
        address inspector,
        uint256 scheduledDate
    ) external projectExists(projectId) onlyProjectRole(projectId, PM_ROLE) returns (uint256) {
        require(hasRole(INSPECTOR_ROLE, inspector), "GCagentPM: not a registered inspector");

        _inspectionCounter.increment();
        uint256 inspId = _inspectionCounter.current();

        string[] memory emptyArr;
        inspections[inspId] = Inspection({
            id: inspId,
            projectId: projectId,
            inspectionType: inspectionType,
            status: InspectionStatus.SCHEDULED,
            inspector: inspector,
            scheduledDate: scheduledDate,
            completedDate: 0,
            notes: "",
            evidenceHashes: emptyArr,
            passed: false
        });

        projectInspections[projectId].push(inspId);
        projects[projectId].inspectionCount++;
        projects[projectId].updatedAt = block.timestamp;

        emit InspectionScheduled(projectId, inspId, scheduledDate);
        return inspId;
    }

    function completeInspection(
        uint256 inspectionId,
        bool passed,
        string calldata notes,
        string[] calldata evidenceHashes
    ) external onlyRole(INSPECTOR_ROLE) {
        Inspection storage insp = inspections[inspectionId];
        require(insp.id != 0, "GCagentPM: inspection does not exist");
        require(insp.inspector == msg.sender, "GCagentPM: not assigned inspector");

        insp.status = passed ? InspectionStatus.PASSED : InspectionStatus.FAILED;
        insp.completedDate = block.timestamp;
        insp.passed = passed;
        insp.notes = notes;
        insp.evidenceHashes = evidenceHashes;

        projects[insp.projectId].updatedAt = block.timestamp;
        emit InspectionCompleted(inspectionId, passed);
    }

    // ============ Permit Tracking ============

    function addPermit(
        uint256 projectId,
        string calldata permitType,
        string calldata jurisdiction,
        string calldata permitNumber,
        uint256 expirationDate,
        string calldata documentHash
    ) external projectExists(projectId) onlyProjectRole(projectId, PM_ROLE) returns (uint256) {
        _permitCounter.increment();
        uint256 permitId = _permitCounter.current();

        permits[permitId] = Permit({
            id: permitId,
            projectId: projectId,
            permitType: permitType,
            jurisdiction: jurisdiction,
            status: PermitStatus.APPLIED,
            permitNumber: permitNumber,
            applicationDate: block.timestamp,
            approvalDate: 0,
            expirationDate: expirationDate,
            documentHash: documentHash
        });

        projectPermits[projectId].push(permitId);
        emit PermitUpdated(projectId, permitId, PermitStatus.APPLIED);
        return permitId;
    }

    function updatePermitStatus(uint256 permitId, PermitStatus newStatus)
        external
        onlyRole(PM_ROLE)
    {
        Permit storage p = permits[permitId];
        require(p.id != 0, "GCagentPM: permit does not exist");
        p.status = newStatus;
        if (newStatus == PermitStatus.APPROVED) {
            p.approvalDate = block.timestamp;
        }
        emit PermitUpdated(p.projectId, permitId, newStatus);
    }

    // ============ Subcontractor Management ============

    function assignSubcontractor(
        uint256 projectId,
        address subWallet,
        string calldata trade,
        uint256 contractAmount
    ) external projectExists(projectId) onlyProjectRole(projectId, GC_ROLE) {
        require(subAssignments[projectId][subWallet].assignedAt == 0, "GCagentPM: sub already assigned");

        _grantRole(SUB_ROLE, subWallet);

        subAssignments[projectId][subWallet] = SubcontractorAssignment({
            subWallet: subWallet,
            projectId: projectId,
            trade: trade,
            contractAmount: contractAmount,
            amountPaid: 0,
            coiVerified: false,
            licenseVerified: false,
            lienWaiverOnFile: false,
            assignedAt: block.timestamp
        });

        projectSubcontractors[projectId].push(subWallet);
        emit SubcontractorAssigned(projectId, subWallet, trade);
    }

    function verifySubCompliance(
        uint256 projectId,
        address subWallet,
        bool coiVerified,
        bool licenseVerified,
        bool lienWaiverOnFile
    ) external onlyRole(PM_ROLE) {
        SubcontractorAssignment storage sa = subAssignments[projectId][subWallet];
        require(sa.assignedAt != 0, "GCagentPM: sub not assigned");
        sa.coiVerified = coiVerified;
        sa.licenseVerified = licenseVerified;
        sa.lienWaiverOnFile = lienWaiverOnFile;
    }

    function paySubcontractor(uint256 projectId, address subWallet, uint256 amount)
        external
        payable
        nonReentrant
        onlyRole(PM_ROLE)
    {
        SubcontractorAssignment storage sa = subAssignments[projectId][subWallet];
        require(sa.assignedAt != 0, "GCagentPM: sub not assigned");
        require(sa.coiVerified && sa.licenseVerified && sa.lienWaiverOnFile,
            "GCagentPM: compliance docs missing - payout blocked");
        require(msg.value >= amount, "GCagentPM: insufficient payment");

        sa.amountPaid += amount;
        projects[projectId].budgetSpent += amount;
        projects[projectId].updatedAt = block.timestamp;

        (bool sent, ) = subWallet.call{value: amount}("");
        require(sent, "GCagentPM: payment failed");

        emit SubcontractorPaid(projectId, subWallet, amount);
        emit PayoutReleased(projectId, subWallet, amount, "subcontractor");
    }

    // ============ Material Tracking ============

    function createMaterialOrder(
        uint256 projectId,
        string calldata vendor,
        string calldata description,
        uint256 cost
    ) external projectExists(projectId) returns (uint256) {
        _materialOrderCounter.increment();
        uint256 orderId = _materialOrderCounter.current();

        materialOrders[orderId] = MaterialOrder({
            id: orderId,
            projectId: projectId,
            vendor: vendor,
            description: description,
            cost: cost,
            deliveryStatus: "ordered",
            orderedAt: block.timestamp,
            deliveredAt: 0,
            confirmationHash: bytes32(0)
        });

        projectMaterialOrders[projectId].push(orderId);
        emit MaterialOrderCreated(projectId, orderId, vendor);
        return orderId;
    }

    function confirmMaterialReceived(uint256 orderId, bytes32 confirmationHash) external {
        MaterialOrder storage mo = materialOrders[orderId];
        require(mo.id != 0, "GCagentPM: order does not exist");
        mo.deliveryStatus = "delivered";
        mo.deliveredAt = block.timestamp;
        mo.confirmationHash = confirmationHash;
        emit MaterialReceived(orderId, confirmationHash);
    }

    // ============ Labor Tracking ============

    function logLabor(
        uint256 projectId,
        uint256 date,
        uint256 hoursWorked,
        string calldata taskDescription
    ) external projectExists(projectId) returns (uint256) {
        _laborEntryCounter.increment();
        uint256 entryId = _laborEntryCounter.current();

        laborEntries[entryId] = LaborEntry({
            id: entryId,
            projectId: projectId,
            worker: msg.sender,
            date: date,
            hoursWorked: hoursWorked,
            taskDescription: taskDescription,
            loggedAt: block.timestamp
        });

        projectLaborEntries[projectId].push(entryId);
        emit LaborLogged(projectId, msg.sender, hoursWorked);
        return entryId;
    }

    // ============ Dispute Management ============

    function fileDispute(
        uint256 projectId,
        string calldata description,
        address against,
        string[] calldata evidenceHashes
    ) external projectExists(projectId) returns (uint256) {
        _disputeCounter.increment();
        uint256 disputeId = _disputeCounter.current();

        disputes[disputeId] = Dispute({
            id: disputeId,
            projectId: projectId,
            description: description,
            filedBy: msg.sender,
            against: against,
            status: DisputeStatus.FILED,
            evidenceHashes: evidenceHashes,
            filedAt: block.timestamp,
            resolvedAt: 0,
            resolution: ""
        });

        projectDisputes[projectId].push(disputeId);
        emit DisputeFiled(projectId, disputeId, msg.sender);
        return disputeId;
    }

    function resolveDispute(uint256 disputeId, string calldata resolution)
        external
        onlyRole(PM_ROLE)
    {
        Dispute storage d = disputes[disputeId];
        require(d.id != 0, "GCagentPM: dispute does not exist");
        d.status = DisputeStatus.RESOLVED;
        d.resolvedAt = block.timestamp;
        d.resolution = resolution;
        emit DisputeResolved(disputeId, resolution);
    }

    // ============ Compliance Documents ============

    function uploadComplianceDoc(
        uint256 projectId,
        string calldata docType,
        address relatedParty,
        string calldata ipfsHash,
        bytes32 contentHash,
        uint256 expiresAt
    ) external projectExists(projectId) returns (uint256) {
        _complianceDocCounter.increment();
        uint256 docId = _complianceDocCounter.current();

        complianceDocs[docId] = ComplianceDoc({
            id: docId,
            projectId: projectId,
            docType: docType,
            relatedParty: relatedParty,
            ipfsHash: ipfsHash,
            contentHash: contentHash,
            uploadedAt: block.timestamp,
            expiresAt: expiresAt,
            verified: false
        });

        projectComplianceDocs[projectId].push(docId);
        emit ComplianceDocUploaded(projectId, docId, docType);
        return docId;
    }

    function verifyComplianceDoc(uint256 docId) external onlyRole(PM_ROLE) {
        ComplianceDoc storage doc = complianceDocs[docId];
        require(doc.id != 0, "GCagentPM: doc does not exist");
        require(doc.expiresAt > block.timestamp, "GCagentPM: document expired");
        doc.verified = true;
    }

    // ============ Investor Layer ============

    function stakeInProject(uint256 projectId)
        external
        payable
        projectExists(projectId)
        onlyRole(INVESTOR_ROLE)
    {
        require(msg.value > 0, "GCagentPM: must stake > 0");

        InvestorStake storage stake = investorStakes[projectId][msg.sender];
        if (stake.stakedAt == 0) {
            // New investor
            projectInvestors[projectId].push(msg.sender);
            investorStakes[projectId][msg.sender] = InvestorStake({
                investor: msg.sender,
                projectId: projectId,
                stakedAmount: msg.value,
                sharePercentage: 0, // calculated after all stakes
                kycVerified: false,
                stakedAt: block.timestamp
            });
        } else {
            stake.stakedAmount += msg.value;
        }

        projectTotalStaked[projectId] += msg.value;
        emit InvestorStaked(projectId, msg.sender, msg.value);
    }

    function verifyInvestorKYC(uint256 projectId, address investor) external onlyRole(PM_ROLE) {
        InvestorStake storage stake = investorStakes[projectId][investor];
        require(stake.stakedAt != 0, "GCagentPM: investor not found");
        stake.kycVerified = true;
    }

    // ============ View Functions ============

    function getProjectMilestoneIds(uint256 projectId) external view returns (uint256[] memory) {
        return projectMilestones[projectId];
    }

    function getProjectChangeOrderIds(uint256 projectId) external view returns (uint256[] memory) {
        return projectChangeOrders[projectId];
    }

    function getProjectPunchItemIds(uint256 projectId) external view returns (uint256[] memory) {
        return projectPunchItems[projectId];
    }

    function getProjectDailyLogIds(uint256 projectId) external view returns (uint256[] memory) {
        return projectDailyLogs[projectId];
    }

    function getProjectInspectionIds(uint256 projectId) external view returns (uint256[] memory) {
        return projectInspections[projectId];
    }

    function getProjectPermitIds(uint256 projectId) external view returns (uint256[] memory) {
        return projectPermits[projectId];
    }

    function getProjectSubcontractors(uint256 projectId) external view returns (address[] memory) {
        return projectSubcontractors[projectId];
    }

    function getProjectInvestors(uint256 projectId) external view returns (address[] memory) {
        return projectInvestors[projectId];
    }

    function getProjectBudgetSummary(uint256 projectId)
        external
        view
        projectExists(projectId)
        returns (uint256 totalBudget, uint256 spent, uint256 remaining, uint256 totalStaked)
    {
        Project storage p = projects[projectId];
        return (
            p.totalBudget,
            p.budgetSpent,
            p.totalBudget > p.budgetSpent ? p.totalBudget - p.budgetSpent : 0,
            projectTotalStaked[projectId]
        );
    }

    function getProjectCount() external view returns (uint256) {
        return _projectCounter.current();
    }

    // ============ Admin ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    receive() external payable {}
}
