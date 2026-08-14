// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title SBTFactory - Soulbound Token Factory for zk-SBT Identity
 * @notice Non-transferable identity tokens for tenants, vendors, managers,
 *         and voters in the NoblePort ecosystem.
 *
 * Features:
 *   - Role-based SBT minting (TENANT, VENDOR, MANAGER, VOTER, INSPECTOR, CONTRACTOR)
 *   - zk-proof verification compatibility
 *   - KYC/AML status tracking per SBT
 *   - Revocation by compliance officers
 *   - On-chain reputation scoring
 *   - IPFS-anchored credential documents
 *   - DAO governance eligibility gating
 *   - Sismo Connect integration points
 *   - ENS record linking
 */
contract SBTFactory is AccessControl, Pausable {
    using Counters for Counters.Counter;

    // ─── Roles ────────────────────────────────────────────────────────
    bytes32 public constant ISSUER_ROLE     = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant REVOKER_ROLE    = keccak256("REVOKER_ROLE");

    Counters.Counter private _sbtIdCounter;

    // ─── SBT Types ───────────────────────────────────────────────────
    enum SBTType { TENANT, VENDOR, MANAGER, VOTER, INSPECTOR, CONTRACTOR, INVESTOR, AGENT }

    // ─── SBT Data ────────────────────────────────────────────────────
    struct SoulboundToken {
        uint256   id;
        address   holder;
        SBTType   sbtType;
        uint256   issuedAt;
        uint256   expiresAt;
        bool      revoked;
        bool      kycVerified;
        bool      amlCleared;
        uint256   reputationScore;     // 0-10000 (basis points)
        string    credentialCid;       // IPFS CID for verifiable credential
        string    jurisdiction;
        bytes32   zkProofHash;         // zk-proof verification hash
        string    ensName;             // Linked ENS name
        address   revokedBy;
        uint256   revokedAt;
        string    revocationReason;
    }

    // ─── Credential Attestation ──────────────────────────────────────
    struct Attestation {
        uint256 sbtId;
        address attester;
        uint256 timestamp;
        string  attestationType;       // "kyc", "aml", "accreditation", "license"
        string  evidenceCid;
        bool    valid;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => SoulboundToken) public soulboundTokens;
    mapping(address => uint256[])      public holderTokens;
    mapping(address => mapping(SBTType => uint256)) public holderTypeToken; // holder => type => tokenId
    mapping(uint256 => Attestation[])  public tokenAttestations;

    // ─── Metrics ─────────────────────────────────────────────────────
    uint256 public totalMinted;
    uint256 public totalRevoked;
    uint256 public totalActiveVoters;
    mapping(SBTType => uint256) public mintedByType;

    // ─── Events ──────────────────────────────────────────────────────
    event SBTMinted(uint256 indexed id, address indexed holder, SBTType sbtType, string jurisdiction);
    event SBTRevoked(uint256 indexed id, address indexed holder, address revokedBy, string reason);
    event SBTRenewed(uint256 indexed id, uint256 newExpiry);
    event ReputationUpdated(uint256 indexed id, uint256 oldScore, uint256 newScore);
    event AttestationAdded(uint256 indexed sbtId, address attester, string attestationType);
    event AttestationRevoked(uint256 indexed sbtId, uint256 attestationIndex);
    event KYCStatusUpdated(uint256 indexed id, bool kycVerified, bool amlCleared);
    event ZKProofLinked(uint256 indexed id, bytes32 zkProofHash);
    event ENSLinked(uint256 indexed id, string ensName);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ISSUER_ROLE, _admin);
        _grantRole(COMPLIANCE_ROLE, _admin);
        _grantRole(REVOKER_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SBT Minting
    // ═══════════════════════════════════════════════════════════════════

    function mintSBT(
        address _holder,
        SBTType _sbtType,
        uint256 _expiresAt,
        bool    _kycVerified,
        bool    _amlCleared,
        string calldata _credentialCid,
        string calldata _jurisdiction,
        bytes32 _zkProofHash,
        string calldata _ensName
    ) external onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256) {
        require(
            holderTypeToken[_holder][_sbtType] == 0,
            "SBTFactory: holder already has this SBT type"
        );
        require(_expiresAt > block.timestamp, "SBTFactory: expiry must be future");

        _sbtIdCounter.increment();
        uint256 id = _sbtIdCounter.current();

        soulboundTokens[id] = SoulboundToken({
            id: id,
            holder: _holder,
            sbtType: _sbtType,
            issuedAt: block.timestamp,
            expiresAt: _expiresAt,
            revoked: false,
            kycVerified: _kycVerified,
            amlCleared: _amlCleared,
            reputationScore: 5000,      // Start at 50% (neutral)
            credentialCid: _credentialCid,
            jurisdiction: _jurisdiction,
            zkProofHash: _zkProofHash,
            ensName: _ensName,
            revokedBy: address(0),
            revokedAt: 0,
            revocationReason: ""
        });

        holderTokens[_holder].push(id);
        holderTypeToken[_holder][_sbtType] = id;
        totalMinted++;
        mintedByType[_sbtType]++;

        if (_sbtType == SBTType.VOTER) {
            totalActiveVoters++;
        }

        emit SBTMinted(id, _holder, _sbtType, _jurisdiction);

        if (_zkProofHash != bytes32(0)) {
            emit ZKProofLinked(id, _zkProofHash);
        }
        if (bytes(_ensName).length > 0) {
            emit ENSLinked(id, _ensName);
        }

        return id;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SBT Revocation
    // ═══════════════════════════════════════════════════════════════════

    function revokeSBT(uint256 _id, string calldata _reason) external onlyRole(REVOKER_ROLE) {
        SoulboundToken storage sbt = soulboundTokens[_id];
        require(sbt.id != 0, "SBTFactory: token does not exist");
        require(!sbt.revoked, "SBTFactory: already revoked");

        sbt.revoked = true;
        sbt.revokedBy = msg.sender;
        sbt.revokedAt = block.timestamp;
        sbt.revocationReason = _reason;
        totalRevoked++;

        // Clear the type mapping so a new one can be issued
        holderTypeToken[sbt.holder][sbt.sbtType] = 0;

        if (sbt.sbtType == SBTType.VOTER) {
            totalActiveVoters--;
        }

        emit SBTRevoked(_id, sbt.holder, msg.sender, _reason);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Renewal
    // ═══════════════════════════════════════════════════════════════════

    function renewSBT(uint256 _id, uint256 _newExpiry) external onlyRole(ISSUER_ROLE) {
        SoulboundToken storage sbt = soulboundTokens[_id];
        require(sbt.id != 0, "SBTFactory: token does not exist");
        require(!sbt.revoked, "SBTFactory: token revoked");
        require(_newExpiry > block.timestamp, "SBTFactory: expiry must be future");

        sbt.expiresAt = _newExpiry;
        emit SBTRenewed(_id, _newExpiry);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Reputation System
    // ═══════════════════════════════════════════════════════════════════

    function updateReputation(uint256 _id, uint256 _newScore) external onlyRole(COMPLIANCE_ROLE) {
        require(_newScore <= 10000, "SBTFactory: max 10000");
        SoulboundToken storage sbt = soulboundTokens[_id];
        require(sbt.id != 0, "SBTFactory: token does not exist");

        uint256 oldScore = sbt.reputationScore;
        sbt.reputationScore = _newScore;

        emit ReputationUpdated(_id, oldScore, _newScore);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Attestations
    // ═══════════════════════════════════════════════════════════════════

    function addAttestation(
        uint256 _sbtId,
        string calldata _attestationType,
        string calldata _evidenceCid
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(soulboundTokens[_sbtId].id != 0, "SBTFactory: token does not exist");

        tokenAttestations[_sbtId].push(Attestation({
            sbtId: _sbtId,
            attester: msg.sender,
            timestamp: block.timestamp,
            attestationType: _attestationType,
            evidenceCid: _evidenceCid,
            valid: true
        }));

        emit AttestationAdded(_sbtId, msg.sender, _attestationType);
    }

    function revokeAttestation(uint256 _sbtId, uint256 _index) external onlyRole(COMPLIANCE_ROLE) {
        require(_index < tokenAttestations[_sbtId].length, "SBTFactory: invalid index");
        tokenAttestations[_sbtId][_index].valid = false;

        emit AttestationRevoked(_sbtId, _index);
    }

    function getAttestationCount(uint256 _sbtId) external view returns (uint256) {
        return tokenAttestations[_sbtId].length;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  KYC/AML Management
    // ═══════════════════════════════════════════════════════════════════

    function updateKYCStatus(
        uint256 _id,
        bool _kycVerified,
        bool _amlCleared
    ) external onlyRole(COMPLIANCE_ROLE) {
        SoulboundToken storage sbt = soulboundTokens[_id];
        require(sbt.id != 0, "SBTFactory: token does not exist");

        sbt.kycVerified = _kycVerified;
        sbt.amlCleared = _amlCleared;

        emit KYCStatusUpdated(_id, _kycVerified, _amlCleared);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ZK Proof Integration
    // ═══════════════════════════════════════════════════════════════════

    function linkZKProof(uint256 _id, bytes32 _zkProofHash) external onlyRole(ISSUER_ROLE) {
        SoulboundToken storage sbt = soulboundTokens[_id];
        require(sbt.id != 0, "SBTFactory: token does not exist");

        sbt.zkProofHash = _zkProofHash;
        emit ZKProofLinked(_id, _zkProofHash);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ENS Integration
    // ═══════════════════════════════════════════════════════════════════

    function linkENS(uint256 _id, string calldata _ensName) external onlyRole(ISSUER_ROLE) {
        SoulboundToken storage sbt = soulboundTokens[_id];
        require(sbt.id != 0, "SBTFactory: token does not exist");

        sbt.ensName = _ensName;
        emit ENSLinked(_id, _ensName);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Query Functions
    // ═══════════════════════════════════════════════════════════════════

    function isValid(uint256 _id) external view returns (bool) {
        SoulboundToken memory sbt = soulboundTokens[_id];
        return sbt.id != 0 && !sbt.revoked && sbt.expiresAt > block.timestamp;
    }

    function isEligibleForGovernance(address _holder) external view returns (bool) {
        uint256 voterId = holderTypeToken[_holder][SBTType.VOTER];
        if (voterId == 0) return false;
        SoulboundToken memory sbt = soulboundTokens[voterId];
        return !sbt.revoked && sbt.expiresAt > block.timestamp && sbt.kycVerified && sbt.amlCleared;
    }

    function getHolderTokens(address _holder) external view returns (uint256[] memory) {
        return holderTokens[_holder];
    }

    function getHolderSBTByType(address _holder, SBTType _sbtType) external view returns (uint256) {
        return holderTypeToken[_holder][_sbtType];
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Soulbound Enforcement (Non-transferable)
    // ═══════════════════════════════════════════════════════════════════

    // SBTs are stored as structs, not ERC-721 tokens, making them
    // inherently non-transferable. The holder address is immutable
    // once minted. Only revocation + re-issuance can change ownership.

    // ═══════════════════════════════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════════════════════════════

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
