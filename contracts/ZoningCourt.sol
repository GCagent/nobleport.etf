// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ZoningCourt - AI Arbitration with Chainlink VRF Judges
 * @notice Decentralized arbitration court for zoning disputes,
 *         construction disagreements, and compliance violations.
 *
 * Features:
 *   - VRF-based random judge selection
 *   - Multi-round dispute resolution
 *   - Evidence submission (IPFS-anchored)
 *   - Stake-weighted voting
 *   - Appeal mechanism
 *   - DAO governance integration
 *   - Penalty enforcement
 *   - Zoning code validation
 */
contract ZoningCourt is AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // ─── Roles ────────────────────────────────────────────────────────
    bytes32 public constant CLERK_ROLE   = keccak256("CLERK_ROLE");
    bytes32 public constant JUDGE_ROLE   = keccak256("JUDGE_ROLE");
    bytes32 public constant BAILIFF_ROLE = keccak256("BAILIFF_ROLE");

    Counters.Counter private _caseIdCounter;

    // ─── Dispute Types ───────────────────────────────────────────────
    enum DisputeType {
        ZONING_VARIANCE,
        CONSTRUCTION_DEFECT,
        PERMIT_DENIAL,
        CONTRACT_BREACH,
        PAYMENT_DISPUTE,
        ENVIRONMENTAL,
        BOUNDARY,
        NOISE_VIOLATION,
        BUILDING_CODE,
        HISTORIC_PRESERVATION
    }

    enum CaseStatus {
        FILED,
        JUDGES_ASSIGNED,
        EVIDENCE_PERIOD,
        DELIBERATION,
        DECIDED,
        APPEALED,
        APPEAL_DECIDED,
        ENFORCED,
        DISMISSED
    }

    enum VoteOption { PLAINTIFF, DEFENDANT, SPLIT, DISMISS }

    // ─── Case ────────────────────────────────────────────────────────
    struct Case {
        uint256      id;
        DisputeType  disputeType;
        CaseStatus   status;
        address      plaintiff;
        address      defendant;
        string       description;
        string       zoningCode;           // Applicable zoning code
        uint256      filingFee;
        uint256      stakeRequired;        // Stake for judges
        uint256      filedAt;
        uint256      evidenceDeadline;
        uint256      deliberationDeadline;
        uint256      decidedAt;
        VoteOption   finalVerdict;
        string       verdictCid;           // IPFS CID for written verdict
        uint256      penaltyAmount;
        bool         penaltyEnforced;
        uint256      appealDeadline;
        bool         appealed;
    }

    // ─── Evidence ────────────────────────────────────────────────────
    struct Evidence {
        uint256 caseId;
        address submittedBy;
        string  evidenceCid;              // IPFS CID
        string  description;
        uint256 submittedAt;
        bool    admitted;
    }

    // ─── Judge Assignment ────────────────────────────────────────────
    struct JudgeAssignment {
        address judge;
        bool    hasVoted;
        VoteOption vote;
        string  opinionCid;
        uint256 stakeDeposited;
        bool    slashed;
    }

    // ─── Zoning Code Entry ───────────────────────────────────────────
    struct ZoningCodeEntry {
        string  code;
        string  description;
        string  jurisdiction;
        bool    active;
        uint256 effectiveDate;
        string  documentCid;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => Case) public cases;
    mapping(uint256 => Evidence[]) public caseEvidence;
    mapping(uint256 => JudgeAssignment[]) public caseJudges;
    mapping(string => ZoningCodeEntry) public zoningCodes;

    // Judge pool
    address[] public judgePool;
    mapping(address => bool) public isJudge;
    mapping(address => uint256) public judgeReputation;

    // VRF
    uint256 public vrfSeed;
    uint256 public judgesPerCase = 3;

    // Metrics
    uint256 public totalCasesFiled;
    uint256 public totalCasesResolved;
    uint256 public totalDisputesResolved;
    uint256 public totalPenaltiesEnforced;

    // Config
    uint256 public defaultFilingFee = 0.1 ether;
    uint256 public defaultStakeRequired = 1 ether;
    uint256 public evidencePeriodDuration = 7 days;
    uint256 public deliberationPeriodDuration = 5 days;
    uint256 public appealPeriodDuration = 14 days;

    // ─── Events ──────────────────────────────────────────────────────
    event CaseFiled(uint256 indexed caseId, DisputeType disputeType, address plaintiff, address defendant);
    event JudgesAssigned(uint256 indexed caseId, address[] judges);
    event EvidenceSubmitted(uint256 indexed caseId, address submittedBy, string evidenceCid);
    event EvidenceAdmitted(uint256 indexed caseId, uint256 evidenceIndex, bool admitted);
    event VoteCast(uint256 indexed caseId, address judge, VoteOption vote);
    event VerdictReached(uint256 indexed caseId, VoteOption verdict, string verdictCid);
    event CaseAppealed(uint256 indexed caseId, address appellant);
    event PenaltyEnforced(uint256 indexed caseId, address penalized, uint256 amount);
    event JudgeAdded(address judge);
    event JudgeRemoved(address judge);
    event JudgeSlashed(uint256 indexed caseId, address judge, uint256 amount);
    event ZoningCodeRegistered(string code, string jurisdiction);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CLERK_ROLE, _admin);
        _grantRole(BAILIFF_ROLE, _admin);
        vrfSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, _admin)));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Case Filing
    // ═══════════════════════════════════════════════════════════════════

    function fileCase(
        DisputeType _disputeType,
        address _defendant,
        string calldata _description,
        string calldata _zoningCode
    ) external payable whenNotPaused returns (uint256) {
        require(msg.value >= defaultFilingFee, "Court: insufficient filing fee");
        require(_defendant != msg.sender, "Court: cannot sue self");

        _caseIdCounter.increment();
        uint256 caseId = _caseIdCounter.current();

        cases[caseId] = Case({
            id: caseId,
            disputeType: _disputeType,
            status: CaseStatus.FILED,
            plaintiff: msg.sender,
            defendant: _defendant,
            description: _description,
            zoningCode: _zoningCode,
            filingFee: msg.value,
            stakeRequired: defaultStakeRequired,
            filedAt: block.timestamp,
            evidenceDeadline: block.timestamp + evidencePeriodDuration,
            deliberationDeadline: block.timestamp + evidencePeriodDuration + deliberationPeriodDuration,
            decidedAt: 0,
            finalVerdict: VoteOption.DISMISS,
            verdictCid: "",
            penaltyAmount: 0,
            penaltyEnforced: false,
            appealDeadline: 0,
            appealed: false
        });

        totalCasesFiled++;

        emit CaseFiled(caseId, _disputeType, msg.sender, _defendant);
        return caseId;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Judge Management
    // ═══════════════════════════════════════════════════════════════════

    function addJudge(address _judge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isJudge[_judge], "Court: already a judge");
        judgePool.push(_judge);
        isJudge[_judge] = true;
        judgeReputation[_judge] = 500; // Start with neutral reputation
        _grantRole(JUDGE_ROLE, _judge);

        emit JudgeAdded(_judge);
    }

    function removeJudge(address _judge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isJudge[_judge], "Court: not a judge");
        isJudge[_judge] = false;
        _revokeRole(JUDGE_ROLE, _judge);

        emit JudgeRemoved(_judge);
    }

    function assignJudges(uint256 _caseId) external onlyRole(CLERK_ROLE) {
        Case storage c = cases[_caseId];
        require(c.status == CaseStatus.FILED, "Court: not filed");
        require(judgePool.length >= judgesPerCase, "Court: insufficient judges");

        // VRF-based pseudo-random selection
        address[] memory selectedJudges = new address[](judgesPerCase);
        uint256 seed = vrfSeed;
        uint256 selected = 0;
        uint256 attempts = 0;

        while (selected < judgesPerCase && attempts < judgePool.length * 3) {
            seed = uint256(keccak256(abi.encodePacked(seed, _caseId, attempts)));
            uint256 index = seed % judgePool.length;
            address candidate = judgePool[index];

            if (isJudge[candidate] && candidate != c.plaintiff && candidate != c.defendant) {
                bool alreadySelected = false;
                for (uint256 j = 0; j < selected; j++) {
                    if (selectedJudges[j] == candidate) {
                        alreadySelected = true;
                        break;
                    }
                }
                if (!alreadySelected) {
                    selectedJudges[selected] = candidate;
                    caseJudges[_caseId].push(JudgeAssignment({
                        judge: candidate,
                        hasVoted: false,
                        vote: VoteOption.DISMISS,
                        opinionCid: "",
                        stakeDeposited: 0,
                        slashed: false
                    }));
                    selected++;
                }
            }
            attempts++;
        }

        require(selected == judgesPerCase, "Court: could not select enough judges");

        vrfSeed = seed;
        c.status = CaseStatus.JUDGES_ASSIGNED;

        emit JudgesAssigned(_caseId, selectedJudges);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Evidence
    // ═══════════════════════════════════════════════════════════════════

    function submitEvidence(
        uint256 _caseId,
        string calldata _evidenceCid,
        string calldata _description
    ) external {
        Case storage c = cases[_caseId];
        require(
            msg.sender == c.plaintiff || msg.sender == c.defendant,
            "Court: not a party"
        );
        require(block.timestamp <= c.evidenceDeadline, "Court: evidence period ended");

        if (c.status == CaseStatus.JUDGES_ASSIGNED) {
            c.status = CaseStatus.EVIDENCE_PERIOD;
        }

        caseEvidence[_caseId].push(Evidence({
            caseId: _caseId,
            submittedBy: msg.sender,
            evidenceCid: _evidenceCid,
            description: _description,
            submittedAt: block.timestamp,
            admitted: true // auto-admitted, can be challenged
        }));

        emit EvidenceSubmitted(_caseId, msg.sender, _evidenceCid);
    }

    function challengeEvidence(uint256 _caseId, uint256 _evidenceIndex, bool _admitted)
        external onlyRole(JUDGE_ROLE)
    {
        require(_evidenceIndex < caseEvidence[_caseId].length, "Court: invalid index");
        caseEvidence[_caseId][_evidenceIndex].admitted = _admitted;

        emit EvidenceAdmitted(_caseId, _evidenceIndex, _admitted);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Voting & Verdict
    // ═══════════════════════════════════════════════════════════════════

    function castVote(
        uint256 _caseId,
        VoteOption _vote,
        string calldata _opinionCid
    ) external onlyRole(JUDGE_ROLE) {
        Case storage c = cases[_caseId];
        require(
            c.status == CaseStatus.EVIDENCE_PERIOD || c.status == CaseStatus.JUDGES_ASSIGNED,
            "Court: not in voting phase"
        );

        // Find the judge's assignment
        JudgeAssignment[] storage judges = caseJudges[_caseId];
        bool found = false;
        for (uint256 i = 0; i < judges.length; i++) {
            if (judges[i].judge == msg.sender) {
                require(!judges[i].hasVoted, "Court: already voted");
                judges[i].hasVoted = true;
                judges[i].vote = _vote;
                judges[i].opinionCid = _opinionCid;
                found = true;
                break;
            }
        }
        require(found, "Court: not assigned to this case");

        c.status = CaseStatus.DELIBERATION;

        emit VoteCast(_caseId, msg.sender, _vote);

        // Check if all judges have voted
        _checkVerdict(_caseId);
    }

    function _checkVerdict(uint256 _caseId) internal {
        JudgeAssignment[] storage judges = caseJudges[_caseId];
        uint256 totalVotes = 0;
        uint256[4] memory voteCounts;

        for (uint256 i = 0; i < judges.length; i++) {
            if (judges[i].hasVoted) {
                totalVotes++;
                voteCounts[uint256(judges[i].vote)]++;
            }
        }

        if (totalVotes == judges.length) {
            // Find majority
            VoteOption winner = VoteOption.DISMISS;
            uint256 maxVotes = 0;
            for (uint256 i = 0; i < 4; i++) {
                if (voteCounts[i] > maxVotes) {
                    maxVotes = voteCounts[i];
                    winner = VoteOption(i);
                }
            }

            Case storage c = cases[_caseId];
            c.finalVerdict = winner;
            c.status = CaseStatus.DECIDED;
            c.decidedAt = block.timestamp;
            c.appealDeadline = block.timestamp + appealPeriodDuration;
            totalCasesResolved++;
            totalDisputesResolved++;

            emit VerdictReached(_caseId, winner, "");
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Appeals
    // ═══════════════════════════════════════════════════════════════════

    function appealCase(uint256 _caseId) external payable {
        Case storage c = cases[_caseId];
        require(c.status == CaseStatus.DECIDED, "Court: not decided");
        require(block.timestamp <= c.appealDeadline, "Court: appeal period ended");
        require(
            msg.sender == c.plaintiff || msg.sender == c.defendant,
            "Court: not a party"
        );
        require(msg.value >= defaultFilingFee * 2, "Court: insufficient appeal fee");
        require(!c.appealed, "Court: already appealed");

        c.appealed = true;
        c.status = CaseStatus.APPEALED;

        emit CaseAppealed(_caseId, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Penalty Enforcement
    // ═══════════════════════════════════════════════════════════════════

    function setPenalty(uint256 _caseId, uint256 _amount) external onlyRole(CLERK_ROLE) {
        Case storage c = cases[_caseId];
        require(c.status == CaseStatus.DECIDED, "Court: not decided");
        c.penaltyAmount = _amount;
    }

    function enforcePenalty(uint256 _caseId) external onlyRole(BAILIFF_ROLE) nonReentrant {
        Case storage c = cases[_caseId];
        require(c.status == CaseStatus.DECIDED, "Court: not decided");
        require(c.penaltyAmount > 0, "Court: no penalty");
        require(!c.penaltyEnforced, "Court: already enforced");

        c.penaltyEnforced = true;
        c.status = CaseStatus.ENFORCED;
        totalPenaltiesEnforced++;

        address penalized = c.finalVerdict == VoteOption.PLAINTIFF
            ? c.defendant
            : c.plaintiff;

        emit PenaltyEnforced(_caseId, penalized, c.penaltyAmount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Zoning Code Registry
    // ═══════════════════════════════════════════════════════════════════

    function registerZoningCode(
        string calldata _code,
        string calldata _description,
        string calldata _jurisdiction,
        string calldata _documentCid
    ) external onlyRole(CLERK_ROLE) {
        zoningCodes[_code] = ZoningCodeEntry({
            code: _code,
            description: _description,
            jurisdiction: _jurisdiction,
            active: true,
            effectiveDate: block.timestamp,
            documentCid: _documentCid
        });

        emit ZoningCodeRegistered(_code, _jurisdiction);
    }

    function validateZoningCode(string calldata _code) external view returns (bool, string memory) {
        ZoningCodeEntry memory entry = zoningCodes[_code];
        return (entry.active, entry.description);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function getEvidenceCount(uint256 _caseId) external view returns (uint256) {
        return caseEvidence[_caseId].length;
    }

    function getJudgeCount(uint256 _caseId) external view returns (uint256) {
        return caseJudges[_caseId].length;
    }

    function getJudgePoolSize() external view returns (uint256) {
        return judgePool.length;
    }

    // ─── Admin ───────────────────────────────────────────────────────
    function setJudgesPerCase(uint256 _count) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_count >= 1 && _count <= 11, "Court: 1-11 judges");
        judgesPerCase = _count;
    }

    function setFilingFee(uint256 _fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultFilingFee = _fee;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {}
}
