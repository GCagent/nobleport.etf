// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title Revocation Root Manager — Module 6
 * @notice Issuer-controlled Merkle root rotation for credential revocation
 * @dev Maintains a revocation accumulator with efficient batch revocation
 */
contract RevocationRootManager is IRevocationRegistry {
    struct RootRotation {
        bytes32 root;
        uint256 timestamp;
        uint256 revokedCount;
        address rotatedBy;
    }

    RootRotation[] public rotationHistory;
    bytes32 public currentRoot;
    mapping(address => bool) public authorizedIssuers;
    address public admin;

    event RootRotated(bytes32 indexed newRoot, uint256 revokedCount, address indexed rotatedBy);
    event IssuerAuthorized(address indexed issuer, bool authorized);

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Revocation: not issuer");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Revocation: not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    function rotateRoot(bytes32 newRoot, uint256 revokedCount) external override onlyIssuer {
        require(newRoot != bytes32(0), "Revocation: empty root");
        require(newRoot != currentRoot, "Revocation: same root");

        currentRoot = newRoot;
        rotationHistory.push(RootRotation({
            root: newRoot,
            timestamp: block.timestamp,
            revokedCount: revokedCount,
            rotatedBy: msg.sender
        }));

        emit RootRotated(newRoot, revokedCount, msg.sender);
    }

    function isRevoked(
        bytes32 credentialLeaf,
        bytes32[] calldata proof
    ) external view override returns (bool) {
        if (currentRoot == bytes32(0)) return false;

        bytes32 computedHash = credentialLeaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == currentRoot;
    }

    function getCurrentRoot() external view override returns (bytes32) {
        return currentRoot;
    }

    function getRotationHistory() external view override returns (bytes32[] memory roots, uint256[] memory timestamps) {
        roots = new bytes32[](rotationHistory.length);
        timestamps = new uint256[](rotationHistory.length);
        for (uint256 i = 0; i < rotationHistory.length; i++) {
            roots[i] = rotationHistory[i].root;
            timestamps[i] = rotationHistory[i].timestamp;
        }
    }

    function authorizeIssuer(address issuer, bool authorized) external onlyAdmin {
        authorizedIssuers[issuer] = authorized;
        emit IssuerAuthorized(issuer, authorized);
    }
}
