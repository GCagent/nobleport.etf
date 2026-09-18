// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title NPCAgreement - AIA/HIC Construction Governance
 * @notice Smart contract governance for construction agreements following
 *         AIA (American Institute of Architects) and HIC (Home Improvement
 *         Contractor) standards.
 *
 * Features:
 *   - AIA A101/A201 compliant contract structures
 *   - HIC license verification
 *   - Milestone-based payment escrow
 *   - Change order management
 *   - Retainage enforcement
 *   - Lien waiver tracking
 *   - Punch list / completion verification
 *   - Subcontractor tier management
 *   - Permit-linked construction phases
 *   - GCagent.ai integration points
 */
contract NPCAgreement is AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // ─── Roles ────────────────────────────────────────────────────────
    bytes32 public constant OWNER_ROLE        = keccak256("OWNER_ROLE");
    bytes32 public constant GC_ROLE           = keccak256("GC_ROLE");
    bytes32 public constant ARCHITECT_ROLE    = keccak256("ARCHITECT_ROLE");
    bytes32 public constant INSPECTOR_ROLE    = keccak256("INSPECTOR_ROLE");
    bytes32 public constant GCAGENT_ROLE      = keccak256("GCAGENT_ROLE");

    Counters.Counter private _agreementIdCounter;
    Counters.Counter private _milestoneIdCounter;
    Counters.Counter private _changeOrderIdCounter;

    // ─── Agreement Types ─────────────────────────────────────────────
    enum AgreementType { AIA_A101, AIA_A201, HIC_STANDARD, CUSTOM }
    enum AgreementStatus { DRAFT, EXECUTED, IN_PROGRESS, SUBSTANTIAL_COMPLETION, FINAL_COMPLETION, TERMINATED, DISPUTED }
    enum MilestoneStatus { PENDING, IN_PROGRESS, SUBMITTED, INSPECTED, APPROVED, PAID, DISPUTED }
    enum ChangeOrderStatus { PROPOSED, UNDER_REVIEW, APPROVED, REJECTED, EXECUTED }

    // ─── Agreement ───────────────────────────────────────────────────
    struct Agreement {
        uint256 id;
        AgreementType agreementType;
        AgreementStatus status;
        address owner;              // Property owner
        address generalContractor;
        address architect;
        uint256 contractAmount;
        uint256 retainagePercentBps;// e.g., 1000 = 10%
        uint256 retainageHeld;
        uint256 amountPaid;
        uint256 startDate;
        uint256 substantialCompletionDate;
        uint256 finalCompletionDate;
        string  propertyAddress;
        string  scopeOfWorkCid;    // IPFS CID
        string  agreementDocCid;   // IPFS CID for signed agreement
        uint256 permitId;          // Linked building permit ID
        uint256 createdAt;
    }

    // ─── Milestone ───────────────────────────────────────────────────
    struct Milestone {
        uint256 id;
        uint256 agreementId;
        string  description;
        uint256 amount;
        MilestoneStatus status;
        uint256 dueDate;
        uint256 completedDate;
        uint256 approvedDate;
        address approvedBy;
        string  evidenceCid;       // Photos/docs on IPFS
        bool    inspectionRequired;
        bool    inspectionPassed;
    }

    // ─── Change Order ────────────────────────────────────────────────
    struct ChangeOrder {
        uint256 id;
        uint256 agreementId;
        string  description;
        int256  amountChange;      // Can be positive or negative
        uint256 timeExtensionDays;
        ChangeOrderStatus status;
        address proposedBy;
        address approvedBy;
        uint256 proposedAt;
        uint256 approvedAt;
        string  documentCid;
    }

    // ─── Lien Waiver ─────────────────────────────────────────────────
    struct LienWaiver {
        uint256 agreementId;
        address contractor;
        uint256 amount;
        uint256 throughDate;
        bool    conditional;
        string  waiverDocCid;
        uint256 submittedAt;
    }

    // ─── Subcontractor ───────────────────────────────────────────────
    struct Subcontractor {
        address subAddress;
        string  trade;             // "electrical", "plumbing", "hvac", etc.
        uint256 contractAmount;
        uint256 amountPaid;
        bool    licensed;
        string  licenseNumber;
        uint256 sbtId;             // SBTFactory reference
    }

    // ─── Punch List ──────────────────────────────────────────────────
    struct PunchListItem {
        string  description;
        bool    completed;
        uint256 completedDate;
        address verifiedBy;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => Agreement) public agreements;
    mapping(uint256 => Milestone[]) public milestones;
    mapping(uint256 => ChangeOrder[]) public changeOrders;
    mapping(uint256 => LienWaiver[]) public lienWaivers;
    mapping(uint256 => Subcontractor[]) public subcontractors;
    mapping(uint256 => PunchListItem[]) public punchLists;

    // Metrics
    uint256 public totalAgreements;
    uint256 public totalContractValue;
    uint256 public totalPaidOut;

    // ─── Events ──────────────────────────────────────────────────────
    event AgreementCreated(uint256 indexed id, AgreementType agreementType, address owner, address gc, uint256 amount);
    event AgreementStatusChanged(uint256 indexed id, AgreementStatus oldStatus, AgreementStatus newStatus);
    event MilestoneCreated(uint256 indexed agreementId, uint256 milestoneId, string description, uint256 amount);
    event MilestoneStatusChanged(uint256 indexed agreementId, uint256 milestoneIndex, MilestoneStatus status);
    event MilestonePaymentReleased(uint256 indexed agreementId, uint256 milestoneIndex, uint256 amount, uint256 retainage);
    event ChangeOrderProposed(uint256 indexed agreementId, uint256 changeOrderId, int256 amountChange);
    event ChangeOrderApproved(uint256 indexed agreementId, uint256 changeOrderId);
    event LienWaiverSubmitted(uint256 indexed agreementId, address contractor, uint256 amount);
    event SubcontractorAdded(uint256 indexed agreementId, address subAddress, string trade);
    event PunchListItemAdded(uint256 indexed agreementId, string description);
    event PunchListItemCompleted(uint256 indexed agreementId, uint256 itemIndex);
    event RetainageReleased(uint256 indexed agreementId, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GCAGENT_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Agreement Lifecycle
    // ═══════════════════════════════════════════════════════════════════

    function createAgreement(
        AgreementType _type,
        address _owner,
        address _generalContractor,
        address _architect,
        uint256 _contractAmount,
        uint256 _retainageBps,
        uint256 _startDate,
        string calldata _propertyAddress,
        string calldata _scopeOfWorkCid,
        string calldata _agreementDocCid,
        uint256 _permitId
    ) external onlyRole(GCAGENT_ROLE) whenNotPaused returns (uint256) {
        require(_retainageBps <= 1500, "NPC: max 15% retainage");

        _agreementIdCounter.increment();
        uint256 id = _agreementIdCounter.current();

        agreements[id] = Agreement({
            id: id,
            agreementType: _type,
            status: AgreementStatus.DRAFT,
            owner: _owner,
            generalContractor: _generalContractor,
            architect: _architect,
            contractAmount: _contractAmount,
            retainagePercentBps: _retainageBps,
            retainageHeld: 0,
            amountPaid: 0,
            startDate: _startDate,
            substantialCompletionDate: 0,
            finalCompletionDate: 0,
            propertyAddress: _propertyAddress,
            scopeOfWorkCid: _scopeOfWorkCid,
            agreementDocCid: _agreementDocCid,
            permitId: _permitId,
            createdAt: block.timestamp
        });

        _grantRole(OWNER_ROLE, _owner);
        _grantRole(GC_ROLE, _generalContractor);
        if (_architect != address(0)) {
            _grantRole(ARCHITECT_ROLE, _architect);
        }

        totalAgreements++;
        totalContractValue += _contractAmount;

        emit AgreementCreated(id, _type, _owner, _generalContractor, _contractAmount);
        return id;
    }

    function executeAgreement(uint256 _id) external payable nonReentrant {
        Agreement storage a = agreements[_id];
        require(a.status == AgreementStatus.DRAFT, "NPC: not draft");
        require(
            msg.sender == a.owner || hasRole(GCAGENT_ROLE, msg.sender),
            "NPC: unauthorized"
        );
        require(msg.value >= a.contractAmount, "NPC: insufficient funding");

        a.status = AgreementStatus.EXECUTED;
        emit AgreementStatusChanged(_id, AgreementStatus.DRAFT, AgreementStatus.EXECUTED);
    }

    function updateAgreementStatus(uint256 _id, AgreementStatus _newStatus) external {
        Agreement storage a = agreements[_id];
        require(
            msg.sender == a.owner || msg.sender == a.architect || hasRole(GCAGENT_ROLE, msg.sender),
            "NPC: unauthorized"
        );
        AgreementStatus old = a.status;
        a.status = _newStatus;

        if (_newStatus == AgreementStatus.SUBSTANTIAL_COMPLETION) {
            a.substantialCompletionDate = block.timestamp;
        } else if (_newStatus == AgreementStatus.FINAL_COMPLETION) {
            a.finalCompletionDate = block.timestamp;
        }

        emit AgreementStatusChanged(_id, old, _newStatus);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Milestones
    // ═══════════════════════════════════════════════════════════════════

    function addMilestone(
        uint256 _agreementId,
        string calldata _description,
        uint256 _amount,
        uint256 _dueDate,
        bool _inspectionRequired
    ) external returns (uint256) {
        Agreement storage a = agreements[_agreementId];
        require(
            msg.sender == a.generalContractor || hasRole(GCAGENT_ROLE, msg.sender),
            "NPC: unauthorized"
        );

        _milestoneIdCounter.increment();
        uint256 msId = _milestoneIdCounter.current();

        milestones[_agreementId].push(Milestone({
            id: msId,
            agreementId: _agreementId,
            description: _description,
            amount: _amount,
            status: MilestoneStatus.PENDING,
            dueDate: _dueDate,
            completedDate: 0,
            approvedDate: 0,
            approvedBy: address(0),
            evidenceCid: "",
            inspectionRequired: _inspectionRequired,
            inspectionPassed: false
        }));

        emit MilestoneCreated(_agreementId, msId, _description, _amount);
        return msId;
    }

    function submitMilestone(
        uint256 _agreementId,
        uint256 _milestoneIndex,
        string calldata _evidenceCid
    ) external {
        Agreement storage a = agreements[_agreementId];
        require(msg.sender == a.generalContractor, "NPC: only GC");
        require(_milestoneIndex < milestones[_agreementId].length, "NPC: invalid index");

        Milestone storage ms = milestones[_agreementId][_milestoneIndex];
        ms.status = MilestoneStatus.SUBMITTED;
        ms.completedDate = block.timestamp;
        ms.evidenceCid = _evidenceCid;

        emit MilestoneStatusChanged(_agreementId, _milestoneIndex, MilestoneStatus.SUBMITTED);
    }

    function approveMilestone(uint256 _agreementId, uint256 _milestoneIndex) external {
        Agreement storage a = agreements[_agreementId];
        require(
            msg.sender == a.owner || msg.sender == a.architect || hasRole(INSPECTOR_ROLE, msg.sender),
            "NPC: unauthorized"
        );
        Milestone storage ms = milestones[_agreementId][_milestoneIndex];
        require(ms.status == MilestoneStatus.SUBMITTED || ms.status == MilestoneStatus.INSPECTED, "NPC: not submitted");

        if (ms.inspectionRequired && !ms.inspectionPassed) {
            revert("NPC: inspection required");
        }

        ms.status = MilestoneStatus.APPROVED;
        ms.approvedDate = block.timestamp;
        ms.approvedBy = msg.sender;

        emit MilestoneStatusChanged(_agreementId, _milestoneIndex, MilestoneStatus.APPROVED);
    }

    function releaseMilestonePayment(uint256 _agreementId, uint256 _milestoneIndex)
        external nonReentrant
    {
        Agreement storage a = agreements[_agreementId];
        require(
            msg.sender == a.owner || hasRole(GCAGENT_ROLE, msg.sender),
            "NPC: unauthorized"
        );
        Milestone storage ms = milestones[_agreementId][_milestoneIndex];
        require(ms.status == MilestoneStatus.APPROVED, "NPC: not approved");

        uint256 retainage = (ms.amount * a.retainagePercentBps) / 10000;
        uint256 payment = ms.amount - retainage;

        a.retainageHeld += retainage;
        a.amountPaid += payment;
        totalPaidOut += payment;

        ms.status = MilestoneStatus.PAID;

        (bool sent,) = a.generalContractor.call{value: payment}("");
        require(sent, "NPC: payment failed");

        emit MilestonePaymentReleased(_agreementId, _milestoneIndex, payment, retainage);
    }

    function inspectMilestone(
        uint256 _agreementId,
        uint256 _milestoneIndex,
        bool _passed
    ) external onlyRole(INSPECTOR_ROLE) {
        Milestone storage ms = milestones[_agreementId][_milestoneIndex];
        require(ms.inspectionRequired, "NPC: no inspection needed");

        ms.inspectionPassed = _passed;
        ms.status = MilestoneStatus.INSPECTED;

        emit MilestoneStatusChanged(_agreementId, _milestoneIndex, MilestoneStatus.INSPECTED);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Change Orders
    // ═══════════════════════════════════════════════════════════════════

    function proposeChangeOrder(
        uint256 _agreementId,
        string calldata _description,
        int256 _amountChange,
        uint256 _timeExtensionDays,
        string calldata _documentCid
    ) external returns (uint256) {
        Agreement storage a = agreements[_agreementId];
        require(
            msg.sender == a.generalContractor || msg.sender == a.owner || hasRole(GCAGENT_ROLE, msg.sender),
            "NPC: unauthorized"
        );

        _changeOrderIdCounter.increment();
        uint256 coId = _changeOrderIdCounter.current();

        changeOrders[_agreementId].push(ChangeOrder({
            id: coId,
            agreementId: _agreementId,
            description: _description,
            amountChange: _amountChange,
            timeExtensionDays: _timeExtensionDays,
            status: ChangeOrderStatus.PROPOSED,
            proposedBy: msg.sender,
            approvedBy: address(0),
            proposedAt: block.timestamp,
            approvedAt: 0,
            documentCid: _documentCid
        }));

        emit ChangeOrderProposed(_agreementId, coId, _amountChange);
        return coId;
    }

    function approveChangeOrder(uint256 _agreementId, uint256 _coIndex) external {
        Agreement storage a = agreements[_agreementId];
        require(msg.sender == a.owner || hasRole(GCAGENT_ROLE, msg.sender), "NPC: unauthorized");

        ChangeOrder storage co = changeOrders[_agreementId][_coIndex];
        require(co.status == ChangeOrderStatus.PROPOSED, "NPC: not proposed");

        co.status = ChangeOrderStatus.APPROVED;
        co.approvedBy = msg.sender;
        co.approvedAt = block.timestamp;

        // Adjust contract amount
        if (co.amountChange > 0) {
            a.contractAmount += uint256(co.amountChange);
        } else {
            a.contractAmount -= uint256(-co.amountChange);
        }

        emit ChangeOrderApproved(_agreementId, co.id);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Lien Waivers
    // ═══════════════════════════════════════════════════════════════════

    function submitLienWaiver(
        uint256 _agreementId,
        uint256 _amount,
        uint256 _throughDate,
        bool _conditional,
        string calldata _waiverDocCid
    ) external {
        lienWaivers[_agreementId].push(LienWaiver({
            agreementId: _agreementId,
            contractor: msg.sender,
            amount: _amount,
            throughDate: _throughDate,
            conditional: _conditional,
            waiverDocCid: _waiverDocCid,
            submittedAt: block.timestamp
        }));

        emit LienWaiverSubmitted(_agreementId, msg.sender, _amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Subcontractors
    // ═══════════════════════════════════════════════════════════════════

    function addSubcontractor(
        uint256 _agreementId,
        address _subAddress,
        string calldata _trade,
        uint256 _contractAmount,
        bool _licensed,
        string calldata _licenseNumber,
        uint256 _sbtId
    ) external {
        Agreement storage a = agreements[_agreementId];
        require(msg.sender == a.generalContractor || hasRole(GCAGENT_ROLE, msg.sender), "NPC: unauthorized");

        subcontractors[_agreementId].push(Subcontractor({
            subAddress: _subAddress,
            trade: _trade,
            contractAmount: _contractAmount,
            amountPaid: 0,
            licensed: _licensed,
            licenseNumber: _licenseNumber,
            sbtId: _sbtId
        }));

        emit SubcontractorAdded(_agreementId, _subAddress, _trade);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Punch List
    // ═══════════════════════════════════════════════════════════════════

    function addPunchListItem(uint256 _agreementId, string calldata _description) external {
        Agreement storage a = agreements[_agreementId];
        require(
            msg.sender == a.owner || msg.sender == a.architect || hasRole(INSPECTOR_ROLE, msg.sender),
            "NPC: unauthorized"
        );

        punchLists[_agreementId].push(PunchListItem({
            description: _description,
            completed: false,
            completedDate: 0,
            verifiedBy: address(0)
        }));

        emit PunchListItemAdded(_agreementId, _description);
    }

    function completePunchListItem(uint256 _agreementId, uint256 _itemIndex) external {
        Agreement storage a = agreements[_agreementId];
        require(
            msg.sender == a.owner || msg.sender == a.architect || hasRole(INSPECTOR_ROLE, msg.sender),
            "NPC: unauthorized"
        );
        PunchListItem storage item = punchLists[_agreementId][_itemIndex];
        require(!item.completed, "NPC: already completed");

        item.completed = true;
        item.completedDate = block.timestamp;
        item.verifiedBy = msg.sender;

        emit PunchListItemCompleted(_agreementId, _itemIndex);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Retainage Release
    // ═══════════════════════════════════════════════════════════════════

    function releaseRetainage(uint256 _agreementId) external nonReentrant {
        Agreement storage a = agreements[_agreementId];
        require(
            a.status == AgreementStatus.FINAL_COMPLETION,
            "NPC: not final completion"
        );
        require(msg.sender == a.owner || hasRole(GCAGENT_ROLE, msg.sender), "NPC: unauthorized");
        require(a.retainageHeld > 0, "NPC: no retainage");

        // Verify all punch list items completed
        PunchListItem[] storage items = punchLists[_agreementId];
        for (uint256 i = 0; i < items.length; i++) {
            require(items[i].completed, "NPC: punch list incomplete");
        }

        uint256 amount = a.retainageHeld;
        a.retainageHeld = 0;
        totalPaidOut += amount;

        (bool sent,) = a.generalContractor.call{value: amount}("");
        require(sent, "NPC: retainage transfer failed");

        emit RetainageReleased(_agreementId, amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function getMilestoneCount(uint256 _agreementId) external view returns (uint256) {
        return milestones[_agreementId].length;
    }

    function getChangeOrderCount(uint256 _agreementId) external view returns (uint256) {
        return changeOrders[_agreementId].length;
    }

    function getSubcontractorCount(uint256 _agreementId) external view returns (uint256) {
        return subcontractors[_agreementId].length;
    }

    function getPunchListCount(uint256 _agreementId) external view returns (uint256) {
        return punchLists[_agreementId].length;
    }

    // ─── Admin ───────────────────────────────────────────────────────
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {}
}
