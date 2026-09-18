// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title Escrow.sol — Module 3
 * @notice Pauseable USDC milestone escrow with dispute windows and arbiter multisig
 * @dev Supports multi-milestone projects with configurable dispute periods
 */
contract Escrow is IEscrow {
    // ─── Types ──────────────────────────────────────────────

    enum MilestoneStatus { PENDING, FUNDED, RELEASED, DISPUTED, RESOLVED }

    struct Milestone {
        uint256 amount;
        MilestoneStatus status;
        uint256 fundedAt;
        string disputeReason;
    }

    struct EscrowRecord {
        uint256 id;
        address payer;
        address payee;
        uint256 totalAmount;
        uint256 disputeWindowSeconds;
        uint256 createdAt;
        bool completed;
        Milestone[] milestones;
    }

    // ─── State ──────────────────────────────────────────────

    uint256 private _nextEscrowId;
    mapping(uint256 => EscrowRecord) private _escrows;

    // Arbiter multisig
    mapping(address => bool) public isArbiter;
    uint256 public arbiterQuorum;
    mapping(bytes32 => mapping(address => bool)) private _arbiterVotes;
    mapping(bytes32 => uint256) private _arbiterVoteCount;

    // Pausable
    bool public paused;
    address public admin;

    // USDC interface (simplified)
    address public usdcToken;

    event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, uint256 totalAmount);
    event MilestoneReleased(uint256 indexed escrowId, uint256 milestoneIndex, uint256 amount);
    event MilestoneDisputed(uint256 indexed escrowId, uint256 milestoneIndex, string reason);
    event DisputeResolved(uint256 indexed escrowId, uint256 milestoneIndex, bool releasedFunds);
    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        require(!paused, "Escrow: paused");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Escrow: not admin");
        _;
    }

    modifier onlyArbiter() {
        require(isArbiter[msg.sender], "Escrow: not arbiter");
        _;
    }

    constructor(address _usdcToken, address[] memory arbiters, uint256 _quorum) {
        admin = msg.sender;
        usdcToken = _usdcToken;
        arbiterQuorum = _quorum;
        for (uint256 i = 0; i < arbiters.length; i++) {
            isArbiter[arbiters[i]] = true;
        }
    }

    // ─── Core ───────────────────────────────────────────────

    function createEscrow(
        address payer,
        address payee,
        uint256 totalAmount,
        uint256 milestoneCount,
        uint256 disputeWindowSeconds
    ) external override whenNotPaused returns (uint256 escrowId) {
        require(milestoneCount > 0 && milestoneCount <= 50, "Escrow: invalid milestone count");
        require(totalAmount > 0, "Escrow: zero amount");

        escrowId = _nextEscrowId++;
        EscrowRecord storage record = _escrows[escrowId];
        record.id = escrowId;
        record.payer = payer;
        record.payee = payee;
        record.totalAmount = totalAmount;
        record.disputeWindowSeconds = disputeWindowSeconds;
        record.createdAt = block.timestamp;

        uint256 perMilestone = totalAmount / milestoneCount;
        uint256 remainder = totalAmount - (perMilestone * milestoneCount);

        for (uint256 i = 0; i < milestoneCount; i++) {
            uint256 amount = perMilestone;
            if (i == milestoneCount - 1) amount += remainder;
            record.milestones.push(Milestone({
                amount: amount,
                status: MilestoneStatus.PENDING,
                fundedAt: 0,
                disputeReason: ""
            }));
        }

        emit EscrowCreated(escrowId, payer, payee, totalAmount);
    }

    function releaseMilestone(
        uint256 escrowId,
        uint256 milestoneIndex
    ) external override whenNotPaused {
        EscrowRecord storage record = _escrows[escrowId];
        require(msg.sender == record.payer || isArbiter[msg.sender], "Escrow: unauthorized");
        Milestone storage milestone = record.milestones[milestoneIndex];
        require(milestone.status == MilestoneStatus.FUNDED, "Escrow: not funded");

        // Check dispute window passed
        if (msg.sender == record.payer) {
            require(
                block.timestamp >= milestone.fundedAt + record.disputeWindowSeconds,
                "Escrow: dispute window active"
            );
        }

        milestone.status = MilestoneStatus.RELEASED;
        // In production: IERC20(usdcToken).transfer(record.payee, milestone.amount);

        emit MilestoneReleased(escrowId, milestoneIndex, milestone.amount);
    }

    function disputeMilestone(
        uint256 escrowId,
        uint256 milestoneIndex,
        string calldata reason
    ) external override whenNotPaused {
        EscrowRecord storage record = _escrows[escrowId];
        require(
            msg.sender == record.payer || msg.sender == record.payee,
            "Escrow: only parties"
        );
        Milestone storage milestone = record.milestones[milestoneIndex];
        require(milestone.status == MilestoneStatus.FUNDED, "Escrow: not funded");
        require(
            block.timestamp < milestone.fundedAt + record.disputeWindowSeconds,
            "Escrow: window closed"
        );

        milestone.status = MilestoneStatus.DISPUTED;
        milestone.disputeReason = reason;

        emit MilestoneDisputed(escrowId, milestoneIndex, reason);
    }

    function resolveDispute(
        uint256 escrowId,
        uint256 milestoneIndex,
        bool releaseFunds
    ) external override onlyArbiter whenNotPaused {
        EscrowRecord storage record = _escrows[escrowId];
        Milestone storage milestone = record.milestones[milestoneIndex];
        require(milestone.status == MilestoneStatus.DISPUTED, "Escrow: not disputed");

        // Multisig voting
        bytes32 voteKey = keccak256(abi.encode(escrowId, milestoneIndex, releaseFunds));
        require(!_arbiterVotes[voteKey][msg.sender], "Escrow: already voted");
        _arbiterVotes[voteKey][msg.sender] = true;
        _arbiterVoteCount[voteKey]++;

        if (_arbiterVoteCount[voteKey] >= arbiterQuorum) {
            milestone.status = MilestoneStatus.RESOLVED;
            if (releaseFunds) {
                // In production: IERC20(usdcToken).transfer(record.payee, milestone.amount);
            } else {
                // In production: IERC20(usdcToken).transfer(record.payer, milestone.amount);
            }
            emit DisputeResolved(escrowId, milestoneIndex, releaseFunds);
        }
    }

    function getEscrowBalance(uint256 escrowId) external view override returns (uint256 balance) {
        EscrowRecord storage record = _escrows[escrowId];
        for (uint256 i = 0; i < record.milestones.length; i++) {
            if (record.milestones[i].status == MilestoneStatus.FUNDED ||
                record.milestones[i].status == MilestoneStatus.DISPUTED) {
                balance += record.milestones[i].amount;
            }
        }
    }

    function fundMilestone(uint256 escrowId, uint256 milestoneIndex) external whenNotPaused {
        EscrowRecord storage record = _escrows[escrowId];
        require(msg.sender == record.payer, "Escrow: only payer");
        Milestone storage milestone = record.milestones[milestoneIndex];
        require(milestone.status == MilestoneStatus.PENDING, "Escrow: not pending");

        // In production: IERC20(usdcToken).transferFrom(msg.sender, address(this), milestone.amount);
        milestone.status = MilestoneStatus.FUNDED;
        milestone.fundedAt = block.timestamp;
    }

    // ─── Pause ──────────────────────────────────────────────

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }
}
