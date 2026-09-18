// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title JobFactory
 * @author GC-Agent.AI / NoblePort Construction
 * @notice Factory contract for creating and managing construction jobs on-chain.
 *         Each job deploys a MilestoneEscrow and links to RetainageVault + SubIdentityVault.
 *
 * @dev Phase 1 Revenue Impact Architecture
 *
 *      JobFactory creates Job structs that represent real construction contracts.
 *      Every job automatically receives:
 *        - A linked MilestoneEscrow address for draw-based payments
 *        - A linked RetainageVault address for retainage management
 *        - References to SubIdentityVault for trade credentialing
 *
 *      Designed for Arbitrum One deployment (low gas, fast finality).
 *
 *      Job Types:
 *        BATHROOM_REMODEL   - Simplest milestone structure (demo/MVP)
 *        KITCHEN_REMODEL    - Medium complexity
 *        ADU_CONSTRUCTION   - Accessory dwelling unit (MA Housing Choice Act)
 *        FULL_RENOVATION    - Multi-trade renovation
 *        NEW_CONSTRUCTION   - Ground-up build
 *        COMMERCIAL_FITOUT  - Commercial tenant improvement
 *        ROOFING            - Specialty trade
 *        CUSTOM             - User-defined milestones
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract JobFactory is AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // ============ Roles ============

    bytes32 public constant GC_ADMIN_ROLE = keccak256("GC_ADMIN_ROLE");
    bytes32 public constant PROJECT_MANAGER_ROLE = keccak256("PROJECT_MANAGER_ROLE");
    bytes32 public constant ESTIMATOR_ROLE = keccak256("ESTIMATOR_ROLE");

    // ============ Enums ============

    enum JobType {
        BATHROOM_REMODEL,
        KITCHEN_REMODEL,
        ADU_CONSTRUCTION,
        FULL_RENOVATION,
        NEW_CONSTRUCTION,
        COMMERCIAL_FITOUT,
        ROOFING,
        CUSTOM
    }

    enum JobStatus {
        DRAFT,                  // Estimate phase
        PROPOSAL_SENT,          // Proposal delivered to client
        CONTRACT_SIGNED,        // Client signed, pre-construction
        PERMITS_PENDING,        // Waiting on permits
        ACTIVE,                 // Construction in progress
        PUNCH_LIST,             // Substantial completion, punch phase
        FINAL_INSPECTION,       // Waiting on final inspection
        COMPLETED,              // CO issued, all payments received
        WARRANTY,               // Warranty period active
        CLOSED,                 // Job fully closed
        CANCELLED               // Cancelled before completion
    }

    enum PaymentStructure {
        FIXED_PRICE,            // Lump sum contract
        COST_PLUS,              // Cost + markup
        TIME_AND_MATERIALS,     // T&M with cap
        UNIT_PRICE              // Per-unit pricing
    }

    // ============ Structs ============

    struct Job {
        uint256 id;
        string projectName;
        JobType jobType;
        JobStatus status;
        PaymentStructure paymentStructure;

        // Parties
        address owner;              // Property owner / client wallet
        address generalContractor;  // GC wallet (NoblePort)
        address projectManager;     // Assigned PM

        // Financial
        uint256 contractAmount;     // Total contract value (wei)
        uint256 estimatedCost;      // GC estimated cost (internal)
        uint256 markup;             // Markup percentage (basis points, 10000 = 100%)
        uint256 contingency;        // Contingency reserve (wei)
        uint256 totalDrawn;         // Total drawn to date
        uint256 retainagePercent;   // Retainage % (basis points)

        // Location
        string propertyAddress;     // Physical address (encrypted or IPFS hash)
        string jurisdiction;        // Town/city for permits

        // Linked contracts
        address milestoneEscrow;    // MilestoneEscrow contract address
        address retainageVault;     // RetainageVault contract address
        address subIdentityVault;   // SubIdentityVault contract address

        // Timestamps
        uint256 createdAt;
        uint256 contractSignedAt;
        uint256 constructionStartAt;
        uint256 estimatedCompletionAt;
        uint256 actualCompletionAt;
        uint256 updatedAt;

        // Metadata
        string scopeHash;           // IPFS hash of scope document
        string contractHash;        // IPFS hash of signed contract
        uint256 changeOrderCount;
        uint256 drawRequestCount;
    }

    struct JobTemplate {
        JobType jobType;
        string name;
        string[] defaultMilestones;
        uint256[] defaultMilestonePercents; // basis points per milestone
        uint256 defaultRetainagePercent;
        uint256 typicalDurationDays;
    }

    struct CostBreakdown {
        uint256 laborCost;
        uint256 materialCost;
        uint256 subcontractorCost;
        uint256 permitFees;
        uint256 equipmentCost;
        uint256 overheadAllocation;
        uint256 profitMargin;
    }

    struct RealTimePnL {
        uint256 jobId;
        uint256 contractRevenue;
        uint256 actualCostToDate;
        uint256 projectedFinalCost;
        int256 currentMargin;           // basis points
        int256 projectedMargin;         // basis points
        uint256 percentComplete;        // basis points
        uint256 earnedValue;
        uint256 costVariance;
        uint256 scheduleVariance;
        uint256 calculatedAt;
    }

    // ============ State ============

    Counters.Counter private _jobCounter;

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => CostBreakdown) public costBreakdowns;
    mapping(uint256 => RealTimePnL) public pnlSnapshots;
    mapping(JobType => JobTemplate) public templates;

    // GC-level aggregates
    uint256 public totalActiveJobs;
    uint256 public totalContractValue;
    uint256 public totalDrawnToDate;

    // ============ Events ============

    event JobCreated(uint256 indexed jobId, string projectName, JobType jobType, address owner, uint256 contractAmount);
    event JobStatusChanged(uint256 indexed jobId, JobStatus oldStatus, JobStatus newStatus);
    event JobLinked(uint256 indexed jobId, address milestoneEscrow, address retainageVault, address subIdentityVault);
    event ContractSigned(uint256 indexed jobId, string contractHash, uint256 signedAt);
    event ConstructionStarted(uint256 indexed jobId, uint256 startDate);
    event DrawProcessed(uint256 indexed jobId, uint256 drawNumber, uint256 amount);
    event PnLUpdated(uint256 indexed jobId, int256 currentMargin, int256 projectedMargin);
    event CostBreakdownUpdated(uint256 indexed jobId);
    event JobCompleted(uint256 indexed jobId, uint256 completionDate, int256 finalMargin);

    // ============ Modifiers ============

    modifier jobExists(uint256 jobId) {
        require(jobs[jobId].createdAt != 0, "JobFactory: job does not exist");
        _;
    }

    modifier onlyJobParty(uint256 jobId) {
        Job storage j = jobs[jobId];
        require(
            msg.sender == j.owner ||
            msg.sender == j.generalContractor ||
            msg.sender == j.projectManager ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "JobFactory: not a job party"
        );
        _;
    }

    // ============ Constructor ============

    constructor(address gcAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, gcAdmin);
        _grantRole(GC_ADMIN_ROLE, gcAdmin);

        // Initialize default templates
        _initTemplates();
    }

    // ============ Job Creation ============

    function createJob(
        string calldata projectName,
        JobType jobType,
        PaymentStructure paymentStructure,
        address owner,
        address projectManager,
        uint256 contractAmount,
        uint256 estimatedCost,
        uint256 markup,
        uint256 contingency,
        uint256 retainagePercent,
        string calldata propertyAddress,
        string calldata jurisdiction,
        uint256 estimatedCompletionAt,
        string calldata scopeHash
    ) external onlyRole(GC_ADMIN_ROLE) returns (uint256) {
        require(contractAmount > 0, "JobFactory: contract amount must be > 0");
        require(owner != address(0), "JobFactory: invalid owner address");

        _jobCounter.increment();
        uint256 jobId = _jobCounter.current();

        jobs[jobId] = Job({
            id: jobId,
            projectName: projectName,
            jobType: jobType,
            status: JobStatus.DRAFT,
            paymentStructure: paymentStructure,
            owner: owner,
            generalContractor: msg.sender,
            projectManager: projectManager,
            contractAmount: contractAmount,
            estimatedCost: estimatedCost,
            markup: markup,
            contingency: contingency,
            totalDrawn: 0,
            retainagePercent: retainagePercent,
            propertyAddress: propertyAddress,
            jurisdiction: jurisdiction,
            milestoneEscrow: address(0),
            retainageVault: address(0),
            subIdentityVault: address(0),
            createdAt: block.timestamp,
            contractSignedAt: 0,
            constructionStartAt: 0,
            estimatedCompletionAt: estimatedCompletionAt,
            actualCompletionAt: 0,
            updatedAt: block.timestamp,
            scopeHash: scopeHash,
            contractHash: "",
            changeOrderCount: 0,
            drawRequestCount: 0
        });

        if (projectManager != address(0)) {
            _grantRole(PROJECT_MANAGER_ROLE, projectManager);
        }

        totalContractValue += contractAmount;

        emit JobCreated(jobId, projectName, jobType, owner, contractAmount);
        return jobId;
    }

    function linkContracts(
        uint256 jobId,
        address milestoneEscrow,
        address retainageVault,
        address subIdentityVault
    ) external jobExists(jobId) onlyRole(GC_ADMIN_ROLE) {
        Job storage j = jobs[jobId];
        j.milestoneEscrow = milestoneEscrow;
        j.retainageVault = retainageVault;
        j.subIdentityVault = subIdentityVault;
        j.updatedAt = block.timestamp;

        emit JobLinked(jobId, milestoneEscrow, retainageVault, subIdentityVault);
    }

    // ============ Job Lifecycle ============

    function signContract(uint256 jobId, string calldata contractHash)
        external
        jobExists(jobId)
        onlyJobParty(jobId)
    {
        Job storage j = jobs[jobId];
        require(j.status == JobStatus.DRAFT || j.status == JobStatus.PROPOSAL_SENT, "JobFactory: invalid status for signing");

        JobStatus old = j.status;
        j.status = JobStatus.CONTRACT_SIGNED;
        j.contractSignedAt = block.timestamp;
        j.contractHash = contractHash;
        j.updatedAt = block.timestamp;

        emit ContractSigned(jobId, contractHash, block.timestamp);
        emit JobStatusChanged(jobId, old, JobStatus.CONTRACT_SIGNED);
    }

    function startConstruction(uint256 jobId)
        external
        jobExists(jobId)
        onlyRole(GC_ADMIN_ROLE)
    {
        Job storage j = jobs[jobId];
        require(
            j.status == JobStatus.CONTRACT_SIGNED || j.status == JobStatus.PERMITS_PENDING,
            "JobFactory: must be signed or permits cleared"
        );

        JobStatus old = j.status;
        j.status = JobStatus.ACTIVE;
        j.constructionStartAt = block.timestamp;
        j.updatedAt = block.timestamp;
        totalActiveJobs++;

        emit ConstructionStarted(jobId, block.timestamp);
        emit JobStatusChanged(jobId, old, JobStatus.ACTIVE);
    }

    function updateJobStatus(uint256 jobId, JobStatus newStatus)
        external
        jobExists(jobId)
        onlyRole(GC_ADMIN_ROLE)
    {
        Job storage j = jobs[jobId];
        JobStatus old = j.status;

        if (newStatus == JobStatus.COMPLETED) {
            j.actualCompletionAt = block.timestamp;
            if (totalActiveJobs > 0) totalActiveJobs--;
        }

        j.status = newStatus;
        j.updatedAt = block.timestamp;
        emit JobStatusChanged(jobId, old, newStatus);
    }

    // ============ Financial Tracking ============

    function updateCostBreakdown(
        uint256 jobId,
        uint256 laborCost,
        uint256 materialCost,
        uint256 subcontractorCost,
        uint256 permitFees,
        uint256 equipmentCost,
        uint256 overheadAllocation,
        uint256 profitMargin
    ) external jobExists(jobId) onlyRole(GC_ADMIN_ROLE) {
        costBreakdowns[jobId] = CostBreakdown({
            laborCost: laborCost,
            materialCost: materialCost,
            subcontractorCost: subcontractorCost,
            permitFees: permitFees,
            equipmentCost: equipmentCost,
            overheadAllocation: overheadAllocation,
            profitMargin: profitMargin
        });

        emit CostBreakdownUpdated(jobId);
    }

    function recordDraw(uint256 jobId, uint256 amount)
        external
        jobExists(jobId)
        onlyRole(GC_ADMIN_ROLE)
    {
        Job storage j = jobs[jobId];
        j.totalDrawn += amount;
        j.drawRequestCount++;
        j.updatedAt = block.timestamp;
        totalDrawnToDate += amount;

        emit DrawProcessed(jobId, j.drawRequestCount, amount);
    }

    function updatePnL(
        uint256 jobId,
        uint256 actualCostToDate,
        uint256 projectedFinalCost,
        int256 currentMargin,
        int256 projectedMargin,
        uint256 percentComplete,
        uint256 earnedValue,
        uint256 costVariance,
        uint256 scheduleVariance
    ) external jobExists(jobId) onlyRole(GC_ADMIN_ROLE) {
        pnlSnapshots[jobId] = RealTimePnL({
            jobId: jobId,
            contractRevenue: jobs[jobId].contractAmount,
            actualCostToDate: actualCostToDate,
            projectedFinalCost: projectedFinalCost,
            currentMargin: currentMargin,
            projectedMargin: projectedMargin,
            percentComplete: percentComplete,
            earnedValue: earnedValue,
            costVariance: costVariance,
            scheduleVariance: scheduleVariance,
            calculatedAt: block.timestamp
        });

        emit PnLUpdated(jobId, currentMargin, projectedMargin);
    }

    function completeJob(uint256 jobId, int256 finalMargin)
        external
        jobExists(jobId)
        onlyRole(GC_ADMIN_ROLE)
    {
        Job storage j = jobs[jobId];
        JobStatus old = j.status;
        j.status = JobStatus.COMPLETED;
        j.actualCompletionAt = block.timestamp;
        j.updatedAt = block.timestamp;

        if (totalActiveJobs > 0) totalActiveJobs--;

        emit JobCompleted(jobId, block.timestamp, finalMargin);
        emit JobStatusChanged(jobId, old, JobStatus.COMPLETED);
    }

    // ============ Views ============

    function getJobCount() external view returns (uint256) {
        return _jobCounter.current();
    }

    function getJobPnL(uint256 jobId) external view returns (RealTimePnL memory) {
        return pnlSnapshots[jobId];
    }

    function getJobCostBreakdown(uint256 jobId) external view returns (CostBreakdown memory) {
        return costBreakdowns[jobId];
    }

    function getTemplate(JobType jobType) external view returns (JobTemplate memory) {
        return templates[jobType];
    }

    function getGCAggregates() external view returns (
        uint256 activeJobs,
        uint256 totalContract,
        uint256 totalDrawn
    ) {
        return (totalActiveJobs, totalContractValue, totalDrawnToDate);
    }

    // ============ Template Initialization ============

    function _initTemplates() internal {
        // Bathroom Remodel — simplest milestone structure
        string[] memory bathMilestones = new string[](5);
        bathMilestones[0] = "Demo & Rough-In";
        bathMilestones[1] = "Plumbing & Electrical";
        bathMilestones[2] = "Tile & Waterproofing";
        bathMilestones[3] = "Fixtures & Finish";
        bathMilestones[4] = "Final Punch & CO";

        uint256[] memory bathPcts = new uint256[](5);
        bathPcts[0] = 2000; // 20%
        bathPcts[1] = 2500; // 25%
        bathPcts[2] = 2500; // 25%
        bathPcts[3] = 2000; // 20%
        bathPcts[4] = 1000; // 10%

        templates[JobType.BATHROOM_REMODEL] = JobTemplate({
            jobType: JobType.BATHROOM_REMODEL,
            name: "Bathroom Remodel",
            defaultMilestones: bathMilestones,
            defaultMilestonePercents: bathPcts,
            defaultRetainagePercent: 1000, // 10%
            typicalDurationDays: 21
        });

        // Kitchen Remodel
        string[] memory kitMilestones = new string[](6);
        kitMilestones[0] = "Demo & Structural";
        kitMilestones[1] = "Rough MEP";
        kitMilestones[2] = "Drywall & Prep";
        kitMilestones[3] = "Cabinets & Countertops";
        kitMilestones[4] = "Appliances & Finish";
        kitMilestones[5] = "Final Punch & CO";

        uint256[] memory kitPcts = new uint256[](6);
        kitPcts[0] = 1500;
        kitPcts[1] = 2000;
        kitPcts[2] = 1500;
        kitPcts[3] = 2500;
        kitPcts[4] = 1500;
        kitPcts[5] = 1000;

        templates[JobType.KITCHEN_REMODEL] = JobTemplate({
            jobType: JobType.KITCHEN_REMODEL,
            name: "Kitchen Remodel",
            defaultMilestones: kitMilestones,
            defaultMilestonePercents: kitPcts,
            defaultRetainagePercent: 1000,
            typicalDurationDays: 42
        });

        // ADU Construction
        string[] memory aduMilestones = new string[](8);
        aduMilestones[0] = "Site Prep & Foundation";
        aduMilestones[1] = "Framing & Sheathing";
        aduMilestones[2] = "Rough MEP";
        aduMilestones[3] = "Insulation & Drywall";
        aduMilestones[4] = "Exterior Finish";
        aduMilestones[5] = "Interior Finish";
        aduMilestones[6] = "Fixtures & Appliances";
        aduMilestones[7] = "Final Inspection & CO";

        uint256[] memory aduPcts = new uint256[](8);
        aduPcts[0] = 1500;
        aduPcts[1] = 1500;
        aduPcts[2] = 1500;
        aduPcts[3] = 1000;
        aduPcts[4] = 1200;
        aduPcts[5] = 1300;
        aduPcts[6] = 1000;
        aduPcts[7] = 500;

        templates[JobType.ADU_CONSTRUCTION] = JobTemplate({
            jobType: JobType.ADU_CONSTRUCTION,
            name: "Accessory Dwelling Unit (ADU)",
            defaultMilestones: aduMilestones,
            defaultMilestonePercents: aduPcts,
            defaultRetainagePercent: 1000,
            typicalDurationDays: 120
        });

        // Roofing
        string[] memory roofMilestones = new string[](4);
        roofMilestones[0] = "Tear-Off & Deck Inspection";
        roofMilestones[1] = "Underlayment & Flashing";
        roofMilestones[2] = "Shingle/Material Install";
        roofMilestones[3] = "Final Inspection & Cleanup";

        uint256[] memory roofPcts = new uint256[](4);
        roofPcts[0] = 2500;
        roofPcts[1] = 2500;
        roofPcts[2] = 3500;
        roofPcts[3] = 1500;

        templates[JobType.ROOFING] = JobTemplate({
            jobType: JobType.ROOFING,
            name: "Roofing",
            defaultMilestones: roofMilestones,
            defaultMilestonePercents: roofPcts,
            defaultRetainagePercent: 500, // 5%
            typicalDurationDays: 7
        });
    }

    // ============ Admin ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {}
}
