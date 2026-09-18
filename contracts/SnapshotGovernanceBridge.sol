// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title Snapshot Governance Bridge — Module 7
 * @notice On-chain governance signal relay from Snapshot votes
 * @dev Bridges off-chain Snapshot voting results to on-chain execution
 */
contract SnapshotGovernanceBridge is IGovernanceBridge {
    enum ProposalState { PENDING, RELAYED, EXECUTED, EXPIRED }

    struct Proposal {
        bytes32 id;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 relayedAt;
        uint256 executionDeadline;
        ProposalState state;
        address relayedBy;
        bytes executionPayload;
    }

    mapping(bytes32 => Proposal) public proposals;
    bytes32[] public proposalIds;

    mapping(address => bool) public trustedRelayers;
    address public admin;
    uint256 public executionWindow = 7 days;

    event VoteRelayed(bytes32 indexed proposalId, uint256 forVotes, uint256 againstVotes);
    event ProposalExecuted(bytes32 indexed proposalId);
    event ProposalExpired(bytes32 indexed proposalId);

    modifier onlyRelayer() {
        require(trustedRelayers[msg.sender], "Bridge: not relayer");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Bridge: not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        trustedRelayers[msg.sender] = true;
    }

    function relayVote(
        bytes32 proposalId,
        uint256 forVotes,
        uint256 againstVotes,
        bytes calldata snapshotProof
    ) external override onlyRelayer {
        require(proposals[proposalId].relayedAt == 0, "Bridge: already relayed");
        require(snapshotProof.length > 0, "Bridge: empty proof");

        proposals[proposalId] = Proposal({
            id: proposalId,
            forVotes: forVotes,
            againstVotes: againstVotes,
            relayedAt: block.timestamp,
            executionDeadline: block.timestamp + executionWindow,
            state: ProposalState.RELAYED,
            relayedBy: msg.sender,
            executionPayload: ""
        });
        proposalIds.push(proposalId);

        emit VoteRelayed(proposalId, forVotes, againstVotes);
    }

    function executeProposal(bytes32 proposalId) external override {
        Proposal storage p = proposals[proposalId];
        require(p.state == ProposalState.RELAYED, "Bridge: not relayed");
        require(block.timestamp <= p.executionDeadline, "Bridge: expired");
        require(p.forVotes > p.againstVotes, "Bridge: not passed");

        p.state = ProposalState.EXECUTED;
        emit ProposalExecuted(proposalId);
    }

    function getProposalResult(
        bytes32 proposalId
    ) external view override returns (bool passed, uint256 forVotes, uint256 againstVotes) {
        Proposal storage p = proposals[proposalId];
        return (p.forVotes > p.againstVotes, p.forVotes, p.againstVotes);
    }

    function setRelayer(address relayer, bool trusted) external onlyAdmin {
        trustedRelayers[relayer] = trusted;
    }

    function setExecutionWindow(uint256 window) external onlyAdmin {
        executionWindow = window;
    }
}
