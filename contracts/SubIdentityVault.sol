// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SubIdentityVault
 * @author GC-Agent.AI / NoblePort Construction
 * @notice On-chain subcontractor identity, credential, and compliance vault.
 *         Stores verified credentials (COI, licenses, lien waivers, W-9, OSHA)
 *         linked to wallet addresses and ENS DIDs.
 *
 * @dev Phase 1 — Risk Compression Infrastructure
 *
 *      Every subcontractor must be registered and credentialed before:
 *        - Being assigned to any job (JobFactory integration)
 *        - Receiving any payment (MilestoneEscrow integration)
 *        - Starting work on site (field app gate)
 *
 *      Credential Types:
 *        - COI (Certificate of Insurance) — with coverage limits and expiry
 *        - State License — MA CSL, HIC, etc.
 *        - OSHA Certification — 10-hr or 30-hr
 *        - W-9 / Tax ID — for 1099 compliance
 *        - Lien Waiver — conditional or unconditional
 *        - Workers Comp — policy verification
 *        - Bonding — payment and performance bonds
 *        - Trade Certification — trade-specific credentials
 *
 *      Integration Points:
 *        - ENS DID resolution for identity verification
 *        - IPFS document storage (hashes on-chain)
 *        - MilestoneEscrow checks credentials before payout
 *        - RetainageVault checks final lien waiver
 *        - JobFactory checks assignment eligibility
 *
 *      Performance Tracking:
 *        - On-time completion rate
 *        - Inspection pass rate
 *        - Safety incident count
 *        - Payment history
 *        - Overall reliability score (computed on-chain)
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract SubIdentityVault is AccessControl, Pausable {
    using Counters for Counters.Counter;

    // ============ Roles ============

    bytes32 public constant GC_ADMIN_ROLE = keccak256("GC_ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant SUB_ROLE = keccak256("SUB_ROLE");

    // ============ Enums ============

    enum CredentialType {
        COI,                    // Certificate of Insurance
        STATE_LICENSE,          // State contractor license
        OSHA_CERT,              // OSHA safety certification
        W9_TAX_ID,              // W-9 tax identification
        LIEN_WAIVER,            // Lien waiver (conditional or unconditional)
        WORKERS_COMP,           // Workers compensation policy
        BOND_PAYMENT,           // Payment bond
        BOND_PERFORMANCE,       // Performance bond
        TRADE_CERT,             // Trade-specific certification
        BACKGROUND_CHECK,       // Background check clearance
        DRUG_TEST,              // Drug test clearance
        EPA_CERT,               // EPA Lead/Asbestos certification
        OTHER                   // Other credential
    }

    enum CredentialStatus {
        PENDING,                // Submitted, awaiting verification
        VERIFIED,               // Verified by GC/admin
        EXPIRED,                // Past expiration date
        REVOKED,                // Manually revoked
        REJECTED                // Failed verification
    }

    enum SubStatus {
        PENDING_APPROVAL,       // Registered but not yet approved
        APPROVED,               // Approved to work on jobs
        SUSPENDED,              // Temporarily suspended
        BLACKLISTED,            // Permanently barred
        INACTIVE                // No longer active
    }

    // ============ Structs ============

    struct SubProfile {
        address wallet;
        string companyName;
        string ensDid;              // did:ens:company.nobleport.eth
        string primaryTrade;
        string[] additionalTrades;
        SubStatus status;

        // Contact
        string contactName;
        string contactEmail;
        string contactPhone;

        // Location
        string state;
        string jurisdiction;

        // Insurance minimums met
        uint256 glCoverageAmount;   // General liability coverage
        uint256 wcCoverageAmount;   // Workers comp coverage

        // Performance metrics
        uint256 jobsCompleted;
        uint256 jobsOnTime;
        uint256 inspectionsPassed;
        uint256 inspectionsFailed;
        uint256 safetyIncidents;
        uint256 totalPaymentsReceived;
        uint256 reliabilityScore;   // 0-10000 (basis points, 10000 = 100%)

        // Timestamps
        uint256 registeredAt;
        uint256 lastActiveAt;
        uint256 updatedAt;
    }

    struct Credential {
        uint256 id;
        address subWallet;
        CredentialType credType;
        CredentialStatus status;
        string description;         // Human-readable description
        string documentHash;        // IPFS hash of document
        bytes32 contentHash;        // keccak256 of document content
        string issuingAuthority;    // Who issued the credential
        string credentialNumber;    // License/policy number
        uint256 issuedAt;
        uint256 expiresAt;
        address verifiedBy;
        uint256 verifiedAt;
        string rejectionReason;
    }

    struct ComplianceGate {
        bool coiValid;
        bool licenseValid;
        bool oshaValid;
        bool w9OnFile;
        bool workersCompValid;
        bool backgroundClear;
        uint256 credentialCount;
        uint256 expiredCount;
        bool paymentEligible;       // All required gates passed
    }

    // ============ State ============

    Counters.Counter private _credentialCounter;

    mapping(address => SubProfile) public profiles;
    mapping(uint256 => Credential) public credentials;
    mapping(address => uint256[]) public subCredentials;  // wallet => credential IDs

    address[] public registeredSubs;

    // Required credentials for payment eligibility
    mapping(CredentialType => bool) public requiredForPayment;

    // ============ Events ============

    event SubRegistered(address indexed wallet, string companyName, string primaryTrade);
    event SubStatusChanged(address indexed wallet, SubStatus oldStatus, SubStatus newStatus);
    event CredentialSubmitted(address indexed wallet, uint256 indexed credId, CredentialType credType);
    event CredentialVerified(uint256 indexed credId, address verifiedBy);
    event CredentialRejected(uint256 indexed credId, string reason);
    event CredentialExpired(uint256 indexed credId, address wallet);
    event CredentialRevoked(uint256 indexed credId, string reason);
    event PerformanceUpdated(address indexed wallet, uint256 reliabilityScore);
    event ComplianceCheckResult(address indexed wallet, bool eligible);

    // ============ Constructor ============

    constructor(address gcAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, gcAdmin);
        _grantRole(GC_ADMIN_ROLE, gcAdmin);
        _grantRole(VERIFIER_ROLE, gcAdmin);

        // Set default required credentials for payment
        requiredForPayment[CredentialType.COI] = true;
        requiredForPayment[CredentialType.STATE_LICENSE] = true;
        requiredForPayment[CredentialType.W9_TAX_ID] = true;
        requiredForPayment[CredentialType.WORKERS_COMP] = true;
    }

    // ============ Registration ============

    function registerSub(
        string calldata companyName,
        string calldata ensDid,
        string calldata primaryTrade,
        string[] calldata additionalTrades,
        string calldata contactName,
        string calldata contactEmail,
        string calldata contactPhone,
        string calldata state,
        string calldata jurisdiction
    ) external returns (address) {
        require(profiles[msg.sender].registeredAt == 0, "SubIdentityVault: already registered");

        profiles[msg.sender] = SubProfile({
            wallet: msg.sender,
            companyName: companyName,
            ensDid: ensDid,
            primaryTrade: primaryTrade,
            additionalTrades: additionalTrades,
            status: SubStatus.PENDING_APPROVAL,
            contactName: contactName,
            contactEmail: contactEmail,
            contactPhone: contactPhone,
            state: state,
            jurisdiction: jurisdiction,
            glCoverageAmount: 0,
            wcCoverageAmount: 0,
            jobsCompleted: 0,
            jobsOnTime: 0,
            inspectionsPassed: 0,
            inspectionsFailed: 0,
            safetyIncidents: 0,
            totalPaymentsReceived: 0,
            reliabilityScore: 5000, // Start at 50%
            registeredAt: block.timestamp,
            lastActiveAt: block.timestamp,
            updatedAt: block.timestamp
        });

        registeredSubs.push(msg.sender);
        _grantRole(SUB_ROLE, msg.sender);

        emit SubRegistered(msg.sender, companyName, primaryTrade);
        return msg.sender;
    }

    function approveSub(address wallet) external onlyRole(GC_ADMIN_ROLE) {
        SubProfile storage profile = profiles[wallet];
        require(profile.registeredAt != 0, "SubIdentityVault: not registered");
        SubStatus old = profile.status;
        profile.status = SubStatus.APPROVED;
        profile.updatedAt = block.timestamp;
        emit SubStatusChanged(wallet, old, SubStatus.APPROVED);
    }

    function suspendSub(address wallet) external onlyRole(GC_ADMIN_ROLE) {
        SubProfile storage profile = profiles[wallet];
        require(profile.registeredAt != 0, "SubIdentityVault: not registered");
        SubStatus old = profile.status;
        profile.status = SubStatus.SUSPENDED;
        profile.updatedAt = block.timestamp;
        emit SubStatusChanged(wallet, old, SubStatus.SUSPENDED);
    }

    function blacklistSub(address wallet) external onlyRole(GC_ADMIN_ROLE) {
        SubProfile storage profile = profiles[wallet];
        require(profile.registeredAt != 0, "SubIdentityVault: not registered");
        SubStatus old = profile.status;
        profile.status = SubStatus.BLACKLISTED;
        profile.updatedAt = block.timestamp;
        emit SubStatusChanged(wallet, old, SubStatus.BLACKLISTED);
    }

    // ============ Credential Management ============

    function submitCredential(
        CredentialType credType,
        string calldata description,
        string calldata documentHash,
        bytes32 contentHash,
        string calldata issuingAuthority,
        string calldata credentialNumber,
        uint256 expiresAt
    ) external onlyRole(SUB_ROLE) returns (uint256) {
        require(profiles[msg.sender].registeredAt != 0, "SubIdentityVault: not registered");

        _credentialCounter.increment();
        uint256 credId = _credentialCounter.current();

        credentials[credId] = Credential({
            id: credId,
            subWallet: msg.sender,
            credType: credType,
            status: CredentialStatus.PENDING,
            description: description,
            documentHash: documentHash,
            contentHash: contentHash,
            issuingAuthority: issuingAuthority,
            credentialNumber: credentialNumber,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            verifiedBy: address(0),
            verifiedAt: 0,
            rejectionReason: ""
        });

        subCredentials[msg.sender].push(credId);
        emit CredentialSubmitted(msg.sender, credId, credType);
        return credId;
    }

    function verifyCredential(uint256 credId) external onlyRole(VERIFIER_ROLE) {
        Credential storage cred = credentials[credId];
        require(cred.id != 0, "SubIdentityVault: credential not found");
        require(cred.status == CredentialStatus.PENDING, "SubIdentityVault: not pending");

        cred.status = CredentialStatus.VERIFIED;
        cred.verifiedBy = msg.sender;
        cred.verifiedAt = block.timestamp;

        // Update insurance coverage amounts if applicable
        SubProfile storage profile = profiles[cred.subWallet];
        profile.updatedAt = block.timestamp;

        emit CredentialVerified(credId, msg.sender);
    }

    function rejectCredential(uint256 credId, string calldata reason) external onlyRole(VERIFIER_ROLE) {
        Credential storage cred = credentials[credId];
        require(cred.id != 0, "SubIdentityVault: credential not found");
        cred.status = CredentialStatus.REJECTED;
        cred.rejectionReason = reason;
        emit CredentialRejected(credId, reason);
    }

    function revokeCredential(uint256 credId, string calldata reason) external onlyRole(GC_ADMIN_ROLE) {
        Credential storage cred = credentials[credId];
        require(cred.id != 0, "SubIdentityVault: credential not found");
        cred.status = CredentialStatus.REVOKED;
        emit CredentialRevoked(credId, reason);
    }

    function markExpired(uint256 credId) external {
        Credential storage cred = credentials[credId];
        require(cred.id != 0, "SubIdentityVault: credential not found");
        require(cred.expiresAt > 0 && cred.expiresAt <= block.timestamp, "SubIdentityVault: not expired");
        cred.status = CredentialStatus.EXPIRED;
        emit CredentialExpired(credId, cred.subWallet);
    }

    // ============ Performance Tracking ============

    function recordJobCompletion(address wallet, bool onTime)
        external
        onlyRole(GC_ADMIN_ROLE)
    {
        SubProfile storage profile = profiles[wallet];
        require(profile.registeredAt != 0, "SubIdentityVault: not registered");

        profile.jobsCompleted++;
        if (onTime) profile.jobsOnTime++;
        profile.lastActiveAt = block.timestamp;
        profile.updatedAt = block.timestamp;

        _recalculateScore(wallet);
    }

    function recordInspectionResult(address wallet, bool passed)
        external
        onlyRole(GC_ADMIN_ROLE)
    {
        SubProfile storage profile = profiles[wallet];
        require(profile.registeredAt != 0, "SubIdentityVault: not registered");

        if (passed) {
            profile.inspectionsPassed++;
        } else {
            profile.inspectionsFailed++;
        }
        profile.updatedAt = block.timestamp;

        _recalculateScore(wallet);
    }

    function recordSafetyIncident(address wallet)
        external
        onlyRole(GC_ADMIN_ROLE)
    {
        SubProfile storage profile = profiles[wallet];
        require(profile.registeredAt != 0, "SubIdentityVault: not registered");
        profile.safetyIncidents++;
        profile.updatedAt = block.timestamp;

        _recalculateScore(wallet);
    }

    function recordPayment(address wallet, uint256 amount)
        external
        onlyRole(GC_ADMIN_ROLE)
    {
        SubProfile storage profile = profiles[wallet];
        require(profile.registeredAt != 0, "SubIdentityVault: not registered");
        profile.totalPaymentsReceived += amount;
        profile.lastActiveAt = block.timestamp;
        profile.updatedAt = block.timestamp;
    }

    function _recalculateScore(address wallet) internal {
        SubProfile storage profile = profiles[wallet];

        uint256 score = 5000; // Base: 50%

        // On-time bonus: up to +2000 (20%)
        if (profile.jobsCompleted > 0) {
            score += (profile.jobsOnTime * 2000) / profile.jobsCompleted;
        }

        // Inspection pass rate: up to +2000 (20%)
        uint256 totalInspections = profile.inspectionsPassed + profile.inspectionsFailed;
        if (totalInspections > 0) {
            score += (profile.inspectionsPassed * 2000) / totalInspections;
        }

        // Safety penalty: -500 per incident (up to -2500)
        uint256 safetyPenalty = profile.safetyIncidents * 500;
        if (safetyPenalty > 2500) safetyPenalty = 2500;
        if (score > safetyPenalty) {
            score -= safetyPenalty;
        } else {
            score = 0;
        }

        // Experience bonus: +100 per completed job (up to +1000)
        uint256 expBonus = profile.jobsCompleted * 100;
        if (expBonus > 1000) expBonus = 1000;
        score += expBonus;

        // Cap at 10000
        if (score > 10000) score = 10000;

        profile.reliabilityScore = score;
        emit PerformanceUpdated(wallet, score);
    }

    // ============ Compliance Checking ============

    function checkCompliance(address wallet) external view returns (ComplianceGate memory) {
        uint256[] storage credIds = subCredentials[wallet];
        ComplianceGate memory gate;
        uint256 now_ = block.timestamp;

        for (uint256 i = 0; i < credIds.length; i++) {
            Credential storage cred = credentials[credIds[i]];

            // Skip non-verified
            if (cred.status == CredentialStatus.EXPIRED) {
                gate.expiredCount++;
                continue;
            }
            if (cred.status != CredentialStatus.VERIFIED) continue;

            // Check expiry
            if (cred.expiresAt > 0 && cred.expiresAt <= now_) {
                gate.expiredCount++;
                continue;
            }

            gate.credentialCount++;

            if (cred.credType == CredentialType.COI) gate.coiValid = true;
            else if (cred.credType == CredentialType.STATE_LICENSE) gate.licenseValid = true;
            else if (cred.credType == CredentialType.OSHA_CERT) gate.oshaValid = true;
            else if (cred.credType == CredentialType.W9_TAX_ID) gate.w9OnFile = true;
            else if (cred.credType == CredentialType.WORKERS_COMP) gate.workersCompValid = true;
            else if (cred.credType == CredentialType.BACKGROUND_CHECK) gate.backgroundClear = true;
        }

        // Payment eligibility: all required credentials must be valid
        gate.paymentEligible = true;
        if (requiredForPayment[CredentialType.COI] && !gate.coiValid) gate.paymentEligible = false;
        if (requiredForPayment[CredentialType.STATE_LICENSE] && !gate.licenseValid) gate.paymentEligible = false;
        if (requiredForPayment[CredentialType.W9_TAX_ID] && !gate.w9OnFile) gate.paymentEligible = false;
        if (requiredForPayment[CredentialType.WORKERS_COMP] && !gate.workersCompValid) gate.paymentEligible = false;

        return gate;
    }

    function isPaymentEligible(address wallet) external view returns (bool) {
        uint256[] storage credIds = subCredentials[wallet];
        bool coiOk;
        bool licenseOk;
        bool w9Ok;
        bool wcOk;
        uint256 now_ = block.timestamp;

        for (uint256 i = 0; i < credIds.length; i++) {
            Credential storage cred = credentials[credIds[i]];
            if (cred.status != CredentialStatus.VERIFIED) continue;
            if (cred.expiresAt > 0 && cred.expiresAt <= now_) continue;

            if (cred.credType == CredentialType.COI) coiOk = true;
            else if (cred.credType == CredentialType.STATE_LICENSE) licenseOk = true;
            else if (cred.credType == CredentialType.W9_TAX_ID) w9Ok = true;
            else if (cred.credType == CredentialType.WORKERS_COMP) wcOk = true;
        }

        return (!requiredForPayment[CredentialType.COI] || coiOk) &&
               (!requiredForPayment[CredentialType.STATE_LICENSE] || licenseOk) &&
               (!requiredForPayment[CredentialType.W9_TAX_ID] || w9Ok) &&
               (!requiredForPayment[CredentialType.WORKERS_COMP] || wcOk);
    }

    // ============ Views ============

    function getSubCredentialIds(address wallet) external view returns (uint256[] memory) {
        return subCredentials[wallet];
    }

    function getRegisteredSubCount() external view returns (uint256) {
        return registeredSubs.length;
    }

    function getAllRegisteredSubs() external view returns (address[] memory) {
        return registeredSubs;
    }

    function getCredentialCount() external view returns (uint256) {
        return _credentialCounter.current();
    }

    function setRequiredForPayment(CredentialType credType, bool required)
        external
        onlyRole(GC_ADMIN_ROLE)
    {
        requiredForPayment[credType] = required;
    }

    // ============ Admin ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
