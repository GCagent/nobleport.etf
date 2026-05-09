// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AttestationRegistry — Proof-of-Reserve Attestation for NBPT
 * @author NoblePort ETF
 * @notice Stores Merkle-root attestations of NBPT reserve holdings.
 *         NBPT contract gates minting on attestation freshness (max 6 hours).
 *         Combines D1 (public wallet) + D2 (on-chain attestation) strategies.
 * @dev ATTESTOR_ROLE is granted to the authorized reserve auditor / keeper.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/INBPTStability.sol";

contract AttestationRegistry is IAttestationRegistry, AccessControl {

    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");

    uint256 public constant MAX_ATTESTATION_AGE = 6 hours;

    struct Attestation {
        bytes32 merkleRoot;
        uint256 totalReserves;
        uint256 totalSupply;
        uint256 timestamp;
        bytes32 reportHash;     // IPFS CID or SHA-256 of off-chain report
        address attestor;
    }

    Attestation[] public attestations;

    // Reserve addresses published for D1 transparency
    address[] public reserveAddresses;
    mapping(address => bool) public isReserveAddress;

    event AttestationPosted(
        uint256 indexed id,
        bytes32 merkleRoot,
        uint256 totalReserves,
        uint256 totalSupply,
        bytes32 reportHash,
        address indexed attestor
    );
    event ReserveAddressAdded(address indexed addr);
    event ReserveAddressRemoved(address indexed addr);

    constructor(address admin) {
        require(admin != address(0), "zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ============ Attestation Posting ============

    function postAttestation(
        bytes32 merkleRoot,
        uint256 totalReserves,
        uint256 totalSupply,
        bytes32 reportHash
    ) external onlyRole(ATTESTOR_ROLE) {
        require(merkleRoot != bytes32(0), "empty root");
        require(totalReserves > 0, "zero reserves");

        uint256 id = attestations.length;

        attestations.push(Attestation({
            merkleRoot:    merkleRoot,
            totalReserves: totalReserves,
            totalSupply:   totalSupply,
            timestamp:     block.timestamp,
            reportHash:    reportHash,
            attestor:      msg.sender
        }));

        emit AttestationPosted(id, merkleRoot, totalReserves, totalSupply, reportHash, msg.sender);
    }

    // ============ Freshness Check (called by NBPT) ============

    function isFresh() external view override returns (bool) {
        if (attestations.length == 0) return false;
        return (block.timestamp - attestations[attestations.length - 1].timestamp) <= MAX_ATTESTATION_AGE;
    }

    function latestAttestedReserves() external view override returns (uint256) {
        if (attestations.length == 0) return 0;
        return attestations[attestations.length - 1].totalReserves;
    }

    function latestTimestamp() external view override returns (uint256) {
        if (attestations.length == 0) return 0;
        return attestations[attestations.length - 1].timestamp;
    }

    function latestAttestation() external view returns (Attestation memory) {
        require(attestations.length > 0, "no attestations");
        return attestations[attestations.length - 1];
    }

    function attestationCount() external view returns (uint256) {
        return attestations.length;
    }

    // ============ Reserve Address Registry (D1) ============

    function addReserveAddress(address addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(addr != address(0), "zero address");
        require(!isReserveAddress[addr], "already added");
        reserveAddresses.push(addr);
        isReserveAddress[addr] = true;
        emit ReserveAddressAdded(addr);
    }

    function removeReserveAddress(address addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isReserveAddress[addr], "not registered");
        isReserveAddress[addr] = false;
        uint256 len = reserveAddresses.length;
        for (uint256 i = 0; i < len; i++) {
            if (reserveAddresses[i] == addr) {
                reserveAddresses[i] = reserveAddresses[len - 1];
                reserveAddresses.pop();
                break;
            }
        }
        emit ReserveAddressRemoved(addr);
    }

    function getReserveAddresses() external view returns (address[] memory) {
        return reserveAddresses;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
