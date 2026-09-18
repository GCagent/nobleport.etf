// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title Merkle Root Anchorer — Module 4
 * @notice Daily off-chain data root commits to Arbitrum L2
 * @dev Maintains an ordered history of Merkle roots with inclusion verification
 */
contract MerkleRootAnchorer is IMerkleAnchor {
    struct RootCommit {
        bytes32 root;
        uint256 timestamp;
        uint256 leafCount;
        string metadata;
        address committer;
    }

    RootCommit[] public rootHistory;
    mapping(bytes32 => bool) public rootExists;
    mapping(address => bool) public authorizedCommitters;
    address public admin;

    event RootCommitted(bytes32 indexed root, uint256 leafCount, uint256 indexed index, address committer);
    event CommitterAuthorized(address indexed committer, bool authorized);

    modifier onlyAuthorized() {
        require(authorizedCommitters[msg.sender], "Anchor: unauthorized");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Anchor: not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        authorizedCommitters[msg.sender] = true;
    }

    function commitRoot(
        bytes32 root,
        uint256 leafCount,
        string calldata metadata
    ) external override onlyAuthorized {
        require(root != bytes32(0), "Anchor: empty root");
        require(!rootExists[root], "Anchor: duplicate root");

        rootHistory.push(RootCommit({
            root: root,
            timestamp: block.timestamp,
            leafCount: leafCount,
            metadata: metadata,
            committer: msg.sender
        }));
        rootExists[root] = true;

        emit RootCommitted(root, leafCount, rootHistory.length - 1, msg.sender);
    }

    function verifyInclusion(
        bytes32 root,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external pure override returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }

    function getLatestRoot() external view override returns (bytes32 root, uint256 timestamp, uint256 leafCount) {
        require(rootHistory.length > 0, "Anchor: no roots");
        RootCommit storage latest = rootHistory[rootHistory.length - 1];
        return (latest.root, latest.timestamp, latest.leafCount);
    }

    function getRootHistory(
        uint256 fromIndex,
        uint256 count
    ) external view override returns (bytes32[] memory) {
        uint256 end = fromIndex + count;
        if (end > rootHistory.length) end = rootHistory.length;
        bytes32[] memory roots = new bytes32[](end - fromIndex);
        for (uint256 i = fromIndex; i < end; i++) {
            roots[i - fromIndex] = rootHistory[i].root;
        }
        return roots;
    }

    function getRootCount() external view returns (uint256) {
        return rootHistory.length;
    }

    function authorizeCommitter(address committer, bool authorized) external onlyAdmin {
        authorizedCommitters[committer] = authorized;
        emit CommitterAuthorized(committer, authorized);
    }
}
