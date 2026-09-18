// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AuditBeacon - Certik & Trail of Bits Notarization
 * @notice On-chain audit notarization and security attestation beacon
 *         for the NoblePort ecosystem.
 *
 * Features:
 *   - Audit report notarization (IPFS-anchored)
 *   - Multi-auditor attestation
 *   - Vulnerability severity tracking
 *   - Remediation verification
 *   - Continuous monitoring alerts
 *   - DAO-linked audit approvals
 *   - Arweave permanent storage references
 *   - Security score computation
 */
contract AuditBeacon is AccessControl, Pausable {
    using Counters for Counters.Counter;

    // ─── Roles ────────────────────────────────────────────────────────
    bytes32 public constant AUDITOR_ROLE     = keccak256("AUDITOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE   = keccak256("REGISTRAR_ROLE");

    Counters.Counter private _auditIdCounter;
    Counters.Counter private _findingIdCounter;

    // ─── Audit Types ─────────────────────────────────────────────────
    enum AuditType { SMART_CONTRACT, INFRASTRUCTURE, PENETRATION_TEST, CODE_REVIEW, COMPLIANCE, ECONOMIC }
    enum AuditStatus { INITIATED, IN_PROGRESS, DRAFT_REPORT, FINAL_REPORT, REMEDIATION, VERIFIED, EXPIRED }
    enum Severity { INFORMATIONAL, LOW, MEDIUM, HIGH, CRITICAL }
    enum FindingStatus { OPEN, ACKNOWLEDGED, REMEDIATED, VERIFIED, WONT_FIX, FALSE_POSITIVE }

    // ─── Audit Report ────────────────────────────────────────────────
    struct AuditReport {
        uint256     id;
        AuditType   auditType;
        AuditStatus status;
        address     auditor;
        string      auditorName;        // "Certik", "Trail of Bits", etc.
        address     target;             // Contract/system being audited
        string      targetDescription;
        string      reportIpfsCid;      // Full report on IPFS
        string      reportArweaveTx;    // Permanent copy on Arweave
        bytes32     reportHash;         // keccak256 of report content
        uint256     initiatedAt;
        uint256     completedAt;
        uint256     expiresAt;          // Audit validity period
        uint256     securityScore;      // 0-100
        uint256     totalFindings;
        uint256     criticalFindings;
        uint256     highFindings;
        uint256     mediumFindings;
        uint256     lowFindings;
        bool        daoApproved;
        uint256     daoProposalId;
    }

    // ─── Finding ─────────────────────────────────────────────────────
    struct Finding {
        uint256       id;
        uint256       auditId;
        Severity      severity;
        FindingStatus status;
        string        title;
        string        description;
        string        recommendation;
        string        findingCid;       // Detailed finding on IPFS
        uint256       reportedAt;
        uint256       remediatedAt;
        address       remediatedBy;
        string        remediationCid;
    }

    // ─── Attestation ─────────────────────────────────────────────────
    struct AuditorAttestation {
        address auditor;
        string  statement;
        uint256 timestamp;
        bytes32 signatureHash;
    }

    // ─── Monitoring Alert ────────────────────────────────────────────
    struct MonitoringAlert {
        uint256 auditId;
        string  alertType;             // "vulnerability_detected", "anomaly", "threshold_breach"
        Severity severity;
        string  description;
        uint256 timestamp;
        bool    resolved;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => AuditReport) public audits;
    mapping(uint256 => Finding[]) public findings;
    mapping(uint256 => AuditorAttestation[]) public attestations;
    mapping(uint256 => MonitoringAlert[]) public alerts;
    mapping(address => uint256[]) public auditorHistory;
    mapping(address => uint256[]) public targetHistory;

    // Metrics
    uint256 public totalAudits;
    uint256 public totalFindings;
    uint256 public totalRemediations;
    uint256 public averageSecurityScore;
    uint256 private _scoreSum;

    // ─── Events ──────────────────────────────────────────────────────
    event AuditInitiated(uint256 indexed id, AuditType auditType, address auditor, address target);
    event AuditCompleted(uint256 indexed id, uint256 securityScore, string reportIpfsCid);
    event AuditStatusChanged(uint256 indexed id, AuditStatus oldStatus, AuditStatus newStatus);
    event FindingReported(uint256 indexed auditId, uint256 findingId, Severity severity, string title);
    event FindingRemediated(uint256 indexed auditId, uint256 findingIndex, address remediatedBy);
    event FindingVerified(uint256 indexed auditId, uint256 findingIndex);
    event AttestationSubmitted(uint256 indexed auditId, address auditor, string statement);
    event AlertRaised(uint256 indexed auditId, string alertType, Severity severity);
    event AlertResolved(uint256 indexed auditId, uint256 alertIndex);
    event DAOApproval(uint256 indexed auditId, uint256 proposalId);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(REGISTRAR_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Audit Lifecycle
    // ═══════════════════════════════════════════════════════════════════

    function initiateAudit(
        AuditType _auditType,
        address _auditor,
        string calldata _auditorName,
        address _target,
        string calldata _targetDescription,
        uint256 _validityPeriod
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        _auditIdCounter.increment();
        uint256 id = _auditIdCounter.current();

        audits[id] = AuditReport({
            id: id,
            auditType: _auditType,
            status: AuditStatus.INITIATED,
            auditor: _auditor,
            auditorName: _auditorName,
            target: _target,
            targetDescription: _targetDescription,
            reportIpfsCid: "",
            reportArweaveTx: "",
            reportHash: bytes32(0),
            initiatedAt: block.timestamp,
            completedAt: 0,
            expiresAt: block.timestamp + _validityPeriod,
            securityScore: 0,
            totalFindings: 0,
            criticalFindings: 0,
            highFindings: 0,
            mediumFindings: 0,
            lowFindings: 0,
            daoApproved: false,
            daoProposalId: 0
        });

        _grantRole(AUDITOR_ROLE, _auditor);
        auditorHistory[_auditor].push(id);
        targetHistory[_target].push(id);
        totalAudits++;

        emit AuditInitiated(id, _auditType, _auditor, _target);
        return id;
    }

    function completeAudit(
        uint256 _id,
        string calldata _reportIpfsCid,
        string calldata _reportArweaveTx,
        bytes32 _reportHash,
        uint256 _securityScore
    ) external onlyRole(AUDITOR_ROLE) {
        AuditReport storage audit = audits[_id];
        require(audit.auditor == msg.sender, "Beacon: not the auditor");
        require(_securityScore <= 100, "Beacon: score 0-100");

        AuditStatus old = audit.status;
        audit.status = AuditStatus.FINAL_REPORT;
        audit.reportIpfsCid = _reportIpfsCid;
        audit.reportArweaveTx = _reportArweaveTx;
        audit.reportHash = _reportHash;
        audit.securityScore = _securityScore;
        audit.completedAt = block.timestamp;

        _scoreSum += _securityScore;
        averageSecurityScore = _scoreSum / totalAudits;

        emit AuditCompleted(_id, _securityScore, _reportIpfsCid);
        emit AuditStatusChanged(_id, old, AuditStatus.FINAL_REPORT);
    }

    function updateAuditStatus(uint256 _id, AuditStatus _newStatus)
        external onlyRole(REGISTRAR_ROLE)
    {
        AuditStatus old = audits[_id].status;
        audits[_id].status = _newStatus;
        emit AuditStatusChanged(_id, old, _newStatus);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Findings
    // ═══════════════════════════════════════════════════════════════════

    function reportFinding(
        uint256 _auditId,
        Severity _severity,
        string calldata _title,
        string calldata _description,
        string calldata _recommendation,
        string calldata _findingCid
    ) external onlyRole(AUDITOR_ROLE) returns (uint256) {
        require(audits[_auditId].id != 0, "Beacon: audit not found");

        _findingIdCounter.increment();
        uint256 findingId = _findingIdCounter.current();

        findings[_auditId].push(Finding({
            id: findingId,
            auditId: _auditId,
            severity: _severity,
            status: FindingStatus.OPEN,
            title: _title,
            description: _description,
            recommendation: _recommendation,
            findingCid: _findingCid,
            reportedAt: block.timestamp,
            remediatedAt: 0,
            remediatedBy: address(0),
            remediationCid: ""
        }));

        AuditReport storage audit = audits[_auditId];
        audit.totalFindings++;
        totalFindings++;

        if (_severity == Severity.CRITICAL) audit.criticalFindings++;
        else if (_severity == Severity.HIGH) audit.highFindings++;
        else if (_severity == Severity.MEDIUM) audit.mediumFindings++;
        else if (_severity == Severity.LOW) audit.lowFindings++;

        emit FindingReported(_auditId, findingId, _severity, _title);
        return findingId;
    }

    function remediateFinding(
        uint256 _auditId,
        uint256 _findingIndex,
        string calldata _remediationCid
    ) external {
        require(_findingIndex < findings[_auditId].length, "Beacon: invalid index");
        Finding storage f = findings[_auditId][_findingIndex];

        f.status = FindingStatus.REMEDIATED;
        f.remediatedAt = block.timestamp;
        f.remediatedBy = msg.sender;
        f.remediationCid = _remediationCid;
        totalRemediations++;

        emit FindingRemediated(_auditId, _findingIndex, msg.sender);
    }

    function verifyRemediation(uint256 _auditId, uint256 _findingIndex)
        external onlyRole(AUDITOR_ROLE)
    {
        require(_findingIndex < findings[_auditId].length, "Beacon: invalid index");
        Finding storage f = findings[_auditId][_findingIndex];
        require(f.status == FindingStatus.REMEDIATED, "Beacon: not remediated");

        f.status = FindingStatus.VERIFIED;
        emit FindingVerified(_auditId, _findingIndex);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Attestations
    // ═══════════════════════════════════════════════════════════════════

    function submitAttestation(
        uint256 _auditId,
        string calldata _statement,
        bytes32 _signatureHash
    ) external onlyRole(AUDITOR_ROLE) {
        attestations[_auditId].push(AuditorAttestation({
            auditor: msg.sender,
            statement: _statement,
            timestamp: block.timestamp,
            signatureHash: _signatureHash
        }));

        emit AttestationSubmitted(_auditId, msg.sender, _statement);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Monitoring Alerts
    // ═══════════════════════════════════════════════════════════════════

    function raiseAlert(
        uint256 _auditId,
        string calldata _alertType,
        Severity _severity,
        string calldata _description
    ) external onlyRole(AUDITOR_ROLE) {
        alerts[_auditId].push(MonitoringAlert({
            auditId: _auditId,
            alertType: _alertType,
            severity: _severity,
            description: _description,
            timestamp: block.timestamp,
            resolved: false
        }));

        emit AlertRaised(_auditId, _alertType, _severity);
    }

    function resolveAlert(uint256 _auditId, uint256 _alertIndex)
        external onlyRole(AUDITOR_ROLE)
    {
        require(_alertIndex < alerts[_auditId].length, "Beacon: invalid index");
        alerts[_auditId][_alertIndex].resolved = true;

        emit AlertResolved(_auditId, _alertIndex);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  DAO Integration
    // ═══════════════════════════════════════════════════════════════════

    function recordDAOApproval(uint256 _auditId, uint256 _proposalId)
        external onlyRole(REGISTRAR_ROLE)
    {
        audits[_auditId].daoApproved = true;
        audits[_auditId].daoProposalId = _proposalId;

        emit DAOApproval(_auditId, _proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function isAuditValid(uint256 _id) external view returns (bool) {
        AuditReport memory a = audits[_id];
        return a.id != 0 &&
            a.status == AuditStatus.FINAL_REPORT &&
            a.expiresAt > block.timestamp;
    }

    function getFindingsCount(uint256 _auditId) external view returns (uint256) {
        return findings[_auditId].length;
    }

    function getAttestationCount(uint256 _auditId) external view returns (uint256) {
        return attestations[_auditId].length;
    }

    function getAlertCount(uint256 _auditId) external view returns (uint256) {
        return alerts[_auditId].length;
    }

    function getAuditorHistory(address _auditor) external view returns (uint256[] memory) {
        return auditorHistory[_auditor];
    }

    function getTargetHistory(address _target) external view returns (uint256[] memory) {
        return targetHistory[_target];
    }

    // ─── Admin ───────────────────────────────────────────────────────
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
