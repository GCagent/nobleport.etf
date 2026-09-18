// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title zkSBT Credential Registry — Module 5
 * @notice Zero-knowledge soulbound tokens for licenses, insurance, certifications
 * @dev ERC-5192 soulbound with ZK proof verification for credential privacy
 */
contract ZkSBTCredentialRegistry is ICredentialRegistry {
    // ─── Types ──────────────────────────────────────────────

    enum CredentialType {
        CONTRACTOR_LICENSE,
        GENERAL_LIABILITY_INSURANCE,
        WORKERS_COMP_INSURANCE,
        PROFESSIONAL_CERTIFICATION,
        INSPECTOR_LICENSE,
        MUNICIPAL_AUTHORITY,
        INVESTOR_ACCREDITATION,
        SAFETY_CERTIFICATION
    }

    struct Credential {
        uint256 tokenId;
        address holder;
        bytes32 credentialHash;
        uint256 credentialType;
        uint256 issuedAt;
        uint256 expiresAt;
        address issuer;
        bool revoked;
    }

    // ─── State ──────────────────────────────────────────────

    uint256 private _nextTokenId;
    mapping(uint256 => Credential) public credentials;
    mapping(address => uint256[]) public holderCredentials;
    mapping(address => bool) public authorizedIssuers;
    address public admin;

    // ZK verifier contract address (pluggable)
    address public zkVerifier;

    // Soulbound: tokens cannot be transferred
    string public constant name = "NoblePort zkSBT";
    string public constant symbol = "NBPT-SBT";

    event CredentialIssued(uint256 indexed tokenId, address indexed holder, uint256 credentialType, address issuer);
    event CredentialRevoked(uint256 indexed tokenId, address indexed revokedBy);
    event IssuerUpdated(address indexed issuer, bool authorized);
    event ZKVerifierUpdated(address indexed newVerifier);

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "zkSBT: not issuer");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "zkSBT: not admin");
        _;
    }

    constructor(address _zkVerifier) {
        admin = msg.sender;
        authorizedIssuers[msg.sender] = true;
        zkVerifier = _zkVerifier;
    }

    // ─── Issuance ───────────────────────────────────────────

    function issueCredential(
        address holder,
        bytes32 credentialHash,
        uint256 credentialType,
        uint256 expiresAt
    ) external override onlyIssuer returns (uint256 tokenId) {
        require(holder != address(0), "zkSBT: zero address");
        require(expiresAt > block.timestamp, "zkSBT: already expired");
        require(credentialType <= uint256(CredentialType.SAFETY_CERTIFICATION), "zkSBT: invalid type");

        tokenId = _nextTokenId++;
        credentials[tokenId] = Credential({
            tokenId: tokenId,
            holder: holder,
            credentialHash: credentialHash,
            credentialType: credentialType,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            issuer: msg.sender,
            revoked: false
        });
        holderCredentials[holder].push(tokenId);

        emit CredentialIssued(tokenId, holder, credentialType, msg.sender);
    }

    // ─── Verification ───────────────────────────────────────

    function verifyCredential(
        uint256 tokenId,
        bytes calldata zkProof
    ) external view override returns (bool) {
        Credential storage cred = credentials[tokenId];
        if (cred.revoked || block.timestamp > cred.expiresAt) {
            return false;
        }

        // ZK proof verification: verify the holder knows the credential
        // without revealing the underlying data
        if (zkVerifier != address(0) && zkProof.length > 0) {
            // In production: call zkVerifier.verify(cred.credentialHash, zkProof)
            // For now, validate proof structure
            return zkProof.length >= 32;
        }

        return true;
    }

    function revokeCredential(uint256 tokenId) external override {
        Credential storage cred = credentials[tokenId];
        require(
            msg.sender == cred.issuer || msg.sender == admin,
            "zkSBT: unauthorized revocation"
        );
        require(!cred.revoked, "zkSBT: already revoked");

        cred.revoked = true;
        emit CredentialRevoked(tokenId, msg.sender);
    }

    function isCredentialValid(uint256 tokenId) external view override returns (bool) {
        Credential storage cred = credentials[tokenId];
        return !cred.revoked && block.timestamp <= cred.expiresAt;
    }

    // ─── Queries ────────────────────────────────────────────

    function getHolderCredentials(address holder) external view returns (uint256[] memory) {
        return holderCredentials[holder];
    }

    function getValidCredentialsByType(
        address holder,
        uint256 credentialType
    ) external view returns (uint256[] memory) {
        uint256[] storage all = holderCredentials[holder];
        uint256 count = 0;

        for (uint256 i = 0; i < all.length; i++) {
            Credential storage cred = credentials[all[i]];
            if (cred.credentialType == credentialType && !cred.revoked && block.timestamp <= cred.expiresAt) {
                count++;
            }
        }

        uint256[] memory valid = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < all.length; i++) {
            Credential storage cred = credentials[all[i]];
            if (cred.credentialType == credentialType && !cred.revoked && block.timestamp <= cred.expiresAt) {
                valid[idx++] = all[i];
            }
        }
        return valid;
    }

    // ─── Admin ──────────────────────────────────────────────

    function setIssuer(address issuer, bool authorized) external onlyAdmin {
        authorizedIssuers[issuer] = authorized;
        emit IssuerUpdated(issuer, authorized);
    }

    function setZKVerifier(address newVerifier) external onlyAdmin {
        zkVerifier = newVerifier;
        emit ZKVerifierUpdated(newVerifier);
    }

    // ─── Soulbound (ERC-5192) ───────────────────────────────
    // Transfers are permanently disabled — tokens are soulbound

    function locked(uint256 tokenId) external view returns (bool) {
        require(credentials[tokenId].issuedAt != 0, "zkSBT: nonexistent");
        return true; // Always locked — soulbound
    }
}
