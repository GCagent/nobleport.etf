// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NoblePortConstructionEscrow
 * @author NoblePort ETF - Construction Payment Node (on-chain escrow layer)
 * @notice Human-approved USDC escrow for construction milestone payments. The
 *         blockchain layer is deliberately SUBORDINATE to NoblePort's existing
 *         approval chain — it holds funds and records authorizations, it does
 *         not decide. No tranche is ever released without explicit human sign-off.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  Governance posture (read this before deploying):
 *
 *  This contract implements the construction-escrow subset that the NoblePort
 *  smart-contract registry classifies as high-revenue / low-securities-risk and
 *  "buildable now" — `Progress Payment Escrow` + `Milestone Release Escrow`.
 *
 *  What it does:        deposit USDC, hold per-milestone tranches, release a
 *                       tranche to the contractor ONLY after a three-key human
 *                       gate, or refund the homeowner.
 *  What it must NOT do: release funds autonomously, act on an AI/agent decision,
 *                       or substitute any on-chain logic for a human approver.
 *
 *  Every release is gated by three independent human keys plus the existing
 *  off-chain HumanApprovalGateway financial decision:
 *
 *      Homeowner Approval                  (the payer signs off on the work)
 *    + NoblePort Approval                  (NOBLEPORT_APPROVER_ROLE)
 *    + Milestone Verification              (MILESTONE_VERIFIER_ROLE / inspector)
 *    + EXECUTED FINANCIAL gateway decision (licensed human quorum, off-chain)
 *    ────────────────────────────────────────────
 *    = Release Authorized
 *
 *  There is no bypass. There is no "AI authority" role. There is no timelock
 *  that auto-releases. Removing any one key blocks the release.
 *
 *  Mirrors the off-chain construction flow:
 *      Lead Intake → Estimate → Contract → Payment Node → Production → Closeout
 *
 *  Not legal advice. Construction-only. Testnet target until independently
 *  audited and cleared through governance.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev Minimal view into the HumanApprovalGateway used to confirm a financial
 *      decision reached human-approved, EXECUTED status before a release. Mirrors
 *      the interface already used by NBPTSecurityToken1400.sol so both contracts
 *      read the same gateway the same way.
 */
interface IHumanApprovalGateway {
    enum DecisionDomain { LEGAL, MEDICAL, FINANCIAL }
    enum DecisionStatus {
        PROPOSED, UNDER_REVIEW, APPROVED, REJECTED, EXECUTED, EXPIRED, ESCALATED, CANCELLED
    }

    function decisions(uint256 decisionId)
        external
        view
        returns (
            uint256 id,
            DecisionDomain domain,
            DecisionStatus status,
            uint8 urgency,
            address proposer,
            string memory title,
            string memory description,
            string memory rationale
        );
}

/**
 * @dev EIP-3009 surface exposed by USDC (Circle) on Base / Ethereum. We use
 *      `receiveWithAuthorization` for deposits: it requires `msg.sender == to`,
 *      which prevents the front-running window that plain `transferWithAuthorization`
 *      leaves open when a third party can submit the signed authorization. The
 *      homeowner signs ONE authorization per deposit — no persistent allowance,
 *      clean one-time audit trail — and this contract is the only address that
 *      can redeem it.
 */
interface IEIP3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract NoblePortConstructionEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Roles ============

    bytes32 public constant GOVERNANCE_ADMIN_ROLE = keccak256("GOVERNANCE_ADMIN_ROLE");
    // NoblePort's operational sign-off (the "Payment Node" human approver).
    bytes32 public constant NOBLEPORT_APPROVER_ROLE = keccak256("NOBLEPORT_APPROVER_ROLE");
    // Independent milestone verification (site inspector / project manager).
    bytes32 public constant MILESTONE_VERIFIER_ROLE = keccak256("MILESTONE_VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ Token + gateway ============

    // USDC (or any 6-decimal USD stablecoin). Immutable for the life of the
    // deployment so the unit of account can never be silently swapped.
    IERC20 public immutable usdc;

    // Off-chain human-in-the-loop gateway. Releases must reference an EXECUTED
    // FINANCIAL decision recorded here. Configurable by governance (e.g. when the
    // gateway is itself redeployed) but can never be set to the zero address.
    IHumanApprovalGateway public approvalGateway;

    // ============ Data model ============

    enum MilestoneState {
        PENDING,    // created, not yet funded
        FUNDED,     // USDC deposited into escrow for this tranche
        RELEASED,   // paid out to the contractor
        REFUNDED    // returned to the homeowner
    }

    // A single construction milestone / payment tranche. Mirrors the contract
    // payment schedule (e.g. 10% permit deposit, 25% foundation, …).
    struct Milestone {
        string label;             // human label, e.g. "Foundation"
        uint256 amount;           // USDC base units (6 decimals) for this tranche
        MilestoneState state;

        // ---- The three human keys (all required to release) ----
        bool homeownerApproved;   // payer signs off on the completed work
        bool nobleportApproved;   // NoblePort Payment Node sign-off
        bool milestoneVerified;   // independent verification the work is done

        // The EXECUTED FINANCIAL HumanApprovalGateway decision authorizing this
        // release. Recorded for the audit trail; verified live at release time.
        uint256 releaseDecisionId;

        uint256 fundedAt;
        uint256 releasedAt;
    }

    // A construction project escrow: one homeowner, one contractor, N tranches.
    struct Project {
        bytes32 ref;              // external reference (e.g. job id / address hash)
        address homeowner;        // payer — receives refunds
        address contractor;       // payee — receives releases
        bool exists;
        bool cancelled;           // no further deposits/releases once true
        uint256 totalScheduled;   // sum of all milestone amounts
        uint256 totalReleased;    // sum released to the contractor so far
        uint256 totalRefunded;    // sum refunded to the homeowner so far
        uint256 createdAt;
    }

    // projectId => Project
    mapping(uint256 => Project) private _projects;
    // projectId => milestones
    mapping(uint256 => Milestone[]) private _milestones;
    // monotonically increasing project id (id 0 is never used)
    uint256 public projectCount;

    // USDC currently held in escrow and earmarked to a funded, unreleased
    // milestone. Lets governance distinguish escrowed funds from any stray
    // tokens sent to the contract by mistake (rescuable, escrow is not).
    uint256 public totalEscrowed;

    // ============ Events ============

    event ProjectCreated(
        uint256 indexed projectId,
        bytes32 indexed ref,
        address indexed homeowner,
        address contractor,
        uint256 milestoneCount,
        uint256 totalScheduled
    );
    event MilestoneFunded(uint256 indexed projectId, uint256 indexed milestoneIndex, uint256 amount);
    event HomeownerApproved(uint256 indexed projectId, uint256 indexed milestoneIndex, address by);
    event NoblePortApproved(uint256 indexed projectId, uint256 indexed milestoneIndex, address by);
    event MilestoneVerified(uint256 indexed projectId, uint256 indexed milestoneIndex, address by);
    event ApprovalRevoked(uint256 indexed projectId, uint256 indexed milestoneIndex, string key, address by);
    event MilestoneReleased(
        uint256 indexed projectId,
        uint256 indexed milestoneIndex,
        address indexed contractor,
        uint256 amount,
        uint256 decisionId
    );
    event MilestoneRefunded(
        uint256 indexed projectId,
        uint256 indexed milestoneIndex,
        address indexed homeowner,
        uint256 amount
    );
    event ProjectCancelled(uint256 indexed projectId, address by);
    event GatewayUpdated(address indexed gateway);
    event StrayTokensRescued(address indexed token, address indexed to, uint256 amount);

    // ============ Constructor ============

    /**
     * @param usdcToken   USDC (6-decimal stablecoin) address on the target chain
     *                    (Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
     * @param gateway     HumanApprovalGateway address.
     * @param admin       Governance admin (use a multisig). Receives every role
     *                    by default; split them out to dedicated signers after.
     */
    constructor(address usdcToken, address gateway, address admin) {
        require(usdcToken != address(0), "USDC zero address");
        require(gateway != address(0), "Gateway zero address");
        require(admin != address(0), "Admin zero address");

        usdc = IERC20(usdcToken);
        approvalGateway = IHumanApprovalGateway(gateway);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ADMIN_ROLE, admin);
        _grantRole(NOBLEPORT_APPROVER_ROLE, admin);
        _grantRole(MILESTONE_VERIFIER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        emit GatewayUpdated(gateway);
    }

    // ============ Project setup ============

    /**
     * @notice Create a project escrow with its milestone schedule. Created by
     *         NoblePort once the contract is signed (mirrors the off-chain
     *         Contract → Payment Node hand-off). Funding is a separate, explicit
     *         step so nothing is pulled before the homeowner authorizes it.
     * @param ref            External reference (e.g. keccak of the job id / address).
     * @param homeowner      Payer; refunds return here.
     * @param contractor     Payee; releases pay here.
     * @param labels         Milestone labels, in order.
     * @param amounts        Milestone amounts (USDC base units), index-aligned to labels.
     * @return projectId     The new project id.
     */
    function createProject(
        bytes32 ref,
        address homeowner,
        address contractor,
        string[] calldata labels,
        uint256[] calldata amounts
    ) external whenNotPaused onlyRole(NOBLEPORT_APPROVER_ROLE) returns (uint256 projectId) {
        require(homeowner != address(0), "Homeowner zero address");
        require(contractor != address(0), "Contractor zero address");
        require(homeowner != contractor, "Homeowner == contractor");
        require(labels.length == amounts.length, "labels/amounts length mismatch");
        require(labels.length > 0, "No milestones");

        projectId = ++projectCount;

        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Milestone amount zero");
            total += amounts[i];
            _milestones[projectId].push(
                Milestone({
                    label: labels[i],
                    amount: amounts[i],
                    state: MilestoneState.PENDING,
                    homeownerApproved: false,
                    nobleportApproved: false,
                    milestoneVerified: false,
                    releaseDecisionId: 0,
                    fundedAt: 0,
                    releasedAt: 0
                })
            );
        }

        _projects[projectId] = Project({
            ref: ref,
            homeowner: homeowner,
            contractor: contractor,
            exists: true,
            cancelled: false,
            totalScheduled: total,
            totalReleased: 0,
            totalRefunded: 0,
            createdAt: block.timestamp
        });

        emit ProjectCreated(projectId, ref, homeowner, contractor, labels.length, total);
    }

    // ============ Funding (Layer 3 — USDC authorization) ============

    /**
     * @notice Fund a milestone by pulling exactly its amount of USDC from the
     *         caller via a standard ERC-20 allowance. Caller must have approved
     *         this contract for at least the milestone amount first.
     * @dev    Anyone may fund (typically the homeowner, or NoblePort on their
     *         behalf after collecting fiat) — funding never moves money OUT, so
     *         it carries no release authority. Release is separately gated.
     */
    function fundMilestone(uint256 projectId, uint256 milestoneIndex)
        external
        nonReentrant
        whenNotPaused
    {
        Milestone storage m = _requireFundable(projectId, milestoneIndex);

        uint256 amount = m.amount;
        m.state = MilestoneState.FUNDED;
        m.fundedAt = block.timestamp;
        totalEscrowed += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit MilestoneFunded(projectId, milestoneIndex, amount);
    }

    /**
     * @notice Fund a milestone using an EIP-3009 signed authorization (USDC
     *         `receiveWithAuthorization`). The homeowner signs a one-time
     *         authorization off-chain (no persistent allowance); NoblePort or
     *         any relayer submits it. `to` is enforced as this contract, so the
     *         signed authorization can only ever fund this escrow.
     * @dev    `value` must equal the milestone amount exactly — partial or
     *         over-funding is rejected so the escrowed total always matches the
     *         schedule.
     */
    function fundMilestoneWithAuthorization(
        uint256 projectId,
        uint256 milestoneIndex,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        Milestone storage m = _requireFundable(projectId, milestoneIndex);
        require(value == m.amount, "Authorization != milestone amount");

        m.state = MilestoneState.FUNDED;
        m.fundedAt = block.timestamp;
        totalEscrowed += value;

        uint256 balanceBefore = usdc.balanceOf(address(this));
        // `to` is hardcoded to this contract — the signed authorization cannot
        // be redirected elsewhere even if the relayer is hostile.
        IEIP3009(address(usdc)).receiveWithAuthorization(
            from, address(this), value, validAfter, validBefore, nonce, v, r, s
        );
        // Defend against non-standard token behaviour: confirm we actually
        // received the full amount before treating the tranche as funded.
        require(
            usdc.balanceOf(address(this)) - balanceBefore == value,
            "USDC not received in full"
        );

        emit MilestoneFunded(projectId, milestoneIndex, value);
    }

    // ============ Layer 2 — the human approval gate ============
    //
    // Three independent keys, each set by a different party. Each is idempotent
    // and individually revocable while the tranche is still in escrow. None of
    // them moves money; they only authorize a later, explicit release call.

    /// @notice Homeowner key. Only the project's homeowner may set it.
    function homeownerApprove(uint256 projectId, uint256 milestoneIndex)
        external
        whenNotPaused
    {
        Project storage p = _requireProject(projectId);
        require(msg.sender == p.homeowner, "Not the homeowner");
        Milestone storage m = _requireFundedMilestone(projectId, milestoneIndex);
        m.homeownerApproved = true;
        emit HomeownerApproved(projectId, milestoneIndex, msg.sender);
    }

    /// @notice NoblePort Payment Node key.
    function nobleportApprove(uint256 projectId, uint256 milestoneIndex)
        external
        whenNotPaused
        onlyRole(NOBLEPORT_APPROVER_ROLE)
    {
        Milestone storage m = _requireFundedMilestone(projectId, milestoneIndex);
        m.nobleportApproved = true;
        emit NoblePortApproved(projectId, milestoneIndex, msg.sender);
    }

    /// @notice Independent milestone verification key (site inspector / PM).
    function verifyMilestone(uint256 projectId, uint256 milestoneIndex)
        external
        whenNotPaused
        onlyRole(MILESTONE_VERIFIER_ROLE)
    {
        Milestone storage m = _requireFundedMilestone(projectId, milestoneIndex);
        m.milestoneVerified = true;
        emit MilestoneVerified(projectId, milestoneIndex, msg.sender);
    }

    /**
     * @notice Revoke a previously granted key while the tranche is still in
     *         escrow (e.g. a defect is found after sign-off but before release).
     *         The homeowner may revoke their own key; NoblePort/verifier roles
     *         and governance may revoke the keys they are responsible for.
     * @param key one of "homeowner", "nobleport", "verify".
     */
    function revokeApproval(uint256 projectId, uint256 milestoneIndex, string calldata key)
        external
        whenNotPaused
    {
        Project storage p = _requireProject(projectId);
        Milestone storage m = _requireFundedMilestone(projectId, milestoneIndex);
        bytes32 k = keccak256(bytes(key));

        if (k == keccak256("homeowner")) {
            require(
                msg.sender == p.homeowner || hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender),
                "Not authorized to revoke homeowner key"
            );
            m.homeownerApproved = false;
        } else if (k == keccak256("nobleport")) {
            require(
                hasRole(NOBLEPORT_APPROVER_ROLE, msg.sender) || hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender),
                "Not authorized to revoke nobleport key"
            );
            m.nobleportApproved = false;
        } else if (k == keccak256("verify")) {
            require(
                hasRole(MILESTONE_VERIFIER_ROLE, msg.sender) || hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender),
                "Not authorized to revoke verification key"
            );
            m.milestoneVerified = false;
        } else {
            revert("Unknown key");
        }

        emit ApprovalRevoked(projectId, milestoneIndex, key, msg.sender);
    }

    // ============ Layer 1 — release / refund (no autonomous path) ============

    /**
     * @notice Release a fully-approved milestone to the contractor. Callable by
     *         NoblePort, but ONLY when all four human gates are satisfied:
     *         homeowner + NoblePort + verification keys, AND a live EXECUTED
     *         FINANCIAL HumanApprovalGateway decision. There is no time-based or
     *         automated release — a human must call this with a valid decision id.
     * @param decisionId  An EXECUTED FINANCIAL decision in the HumanApprovalGateway
     *                    authorizing this specific payout.
     */
    function releaseMilestone(uint256 projectId, uint256 milestoneIndex, uint256 decisionId)
        external
        nonReentrant
        whenNotPaused
        onlyRole(NOBLEPORT_APPROVER_ROLE)
    {
        Project storage p = _requireProject(projectId);
        require(!p.cancelled, "Project cancelled");
        Milestone storage m = _requireFundedMilestone(projectId, milestoneIndex);

        // The three on-chain human keys.
        require(m.homeownerApproved, "Homeowner approval missing");
        require(m.nobleportApproved, "NoblePort approval missing");
        require(m.milestoneVerified, "Milestone verification missing");

        // The off-chain licensed-human gate. Verified live, not trusted from
        // storage — the decision must be FINANCIAL and EXECUTED right now.
        _requireExecutedFinancialDecision(decisionId);

        uint256 amount = m.amount;
        m.state = MilestoneState.RELEASED;
        m.releaseDecisionId = decisionId;
        m.releasedAt = block.timestamp;
        p.totalReleased += amount;
        totalEscrowed -= amount;

        usdc.safeTransfer(p.contractor, amount);

        emit MilestoneReleased(projectId, milestoneIndex, p.contractor, amount, decisionId);
    }

    /**
     * @notice Refund a funded-but-unreleased milestone to the homeowner (scope
     *         cancelled, project terminated, dispute resolved in the homeowner's
     *         favour). Dual-controlled: requires BOTH the homeowner's consent and
     *         a NoblePort/governance signer, so neither side can unilaterally
     *         claw back escrowed funds.
     * @dev    Two-path: the homeowner calls to request, a NoblePort approver
     *         confirms — or governance executes a resolved dispute directly. We
     *         keep it to a single guarded call: only NOBLEPORT_APPROVER_ROLE or
     *         GOVERNANCE_ADMIN_ROLE may execute, and `homeownerConsents` records
     *         the homeowner-side agreement on-chain for the audit trail.
     */
    function refundMilestone(
        uint256 projectId,
        uint256 milestoneIndex,
        bool homeownerConsents
    ) external nonReentrant whenNotPaused {
        require(
            hasRole(NOBLEPORT_APPROVER_ROLE, msg.sender) || hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender),
            "Not authorized to refund"
        );
        Project storage p = _requireProject(projectId);
        Milestone storage m = _requireFundedMilestone(projectId, milestoneIndex);

        // Homeowner consent is required unless governance is executing a resolved
        // dispute (which carries its own off-chain record).
        require(
            homeownerConsents || hasRole(GOVERNANCE_ADMIN_ROLE, msg.sender),
            "Homeowner consent required"
        );

        uint256 amount = m.amount;
        m.state = MilestoneState.REFUNDED;
        p.totalRefunded += amount;
        totalEscrowed -= amount;

        usdc.safeTransfer(p.homeowner, amount);

        emit MilestoneRefunded(projectId, milestoneIndex, p.homeowner, amount);
    }

    /**
     * @notice Cancel a project: no new milestones can be funded. Already-funded
     *         tranches remain in escrow and must be released or refunded through
     *         the normal gates — cancellation never strands or seizes funds.
     */
    function cancelProject(uint256 projectId)
        external
        whenNotPaused
        onlyRole(GOVERNANCE_ADMIN_ROLE)
    {
        Project storage p = _requireProject(projectId);
        require(!p.cancelled, "Already cancelled");
        p.cancelled = true;
        emit ProjectCancelled(projectId, msg.sender);
    }

    // ============ Governance / admin ============

    function setApprovalGateway(address gateway)
        external
        onlyRole(GOVERNANCE_ADMIN_ROLE)
    {
        require(gateway != address(0), "Gateway zero address");
        approvalGateway = IHumanApprovalGateway(gateway);
        emit GatewayUpdated(gateway);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Rescue tokens accidentally sent to this contract. CANNOT touch
     *         escrowed USDC: for USDC, only the balance above `totalEscrowed` is
     *         rescuable, so funds backing live milestones can never be swept.
     */
    function rescueStrayTokens(address token, address to, uint256 amount)
        external
        onlyRole(GOVERNANCE_ADMIN_ROLE)
    {
        require(to != address(0), "Rescue to zero address");
        if (token == address(usdc)) {
            uint256 free = usdc.balanceOf(address(this)) - totalEscrowed;
            require(amount <= free, "Cannot rescue escrowed USDC");
        }
        IERC20(token).safeTransfer(to, amount);
        emit StrayTokensRescued(token, to, amount);
    }

    // ============ Views ============

    function getProject(uint256 projectId)
        external
        view
        returns (Project memory)
    {
        require(_projects[projectId].exists, "No such project");
        return _projects[projectId];
    }

    function getMilestone(uint256 projectId, uint256 milestoneIndex)
        external
        view
        returns (Milestone memory)
    {
        require(_projects[projectId].exists, "No such project");
        require(milestoneIndex < _milestones[projectId].length, "No such milestone");
        return _milestones[projectId][milestoneIndex];
    }

    function milestoneCount(uint256 projectId) external view returns (uint256) {
        require(_projects[projectId].exists, "No such project");
        return _milestones[projectId].length;
    }

    /**
     * @notice True only if every human key is set for this milestone. Does NOT
     *         check the gateway decision (that is time-sensitive and verified at
     *         release). UIs use this to show "ready to authorize release".
     */
    function isReleaseAuthorized(uint256 projectId, uint256 milestoneIndex)
        external
        view
        returns (bool)
    {
        require(_projects[projectId].exists, "No such project");
        require(milestoneIndex < _milestones[projectId].length, "No such milestone");
        Milestone storage m = _milestones[projectId][milestoneIndex];
        return
            m.state == MilestoneState.FUNDED &&
            m.homeownerApproved &&
            m.nobleportApproved &&
            m.milestoneVerified;
    }

    // ============ Internal helpers ============

    function _requireProject(uint256 projectId) internal view returns (Project storage p) {
        p = _projects[projectId];
        require(p.exists, "No such project");
    }

    function _requireFundable(uint256 projectId, uint256 milestoneIndex)
        internal
        view
        returns (Milestone storage m)
    {
        Project storage p = _requireProject(projectId);
        require(!p.cancelled, "Project cancelled");
        require(milestoneIndex < _milestones[projectId].length, "No such milestone");
        m = _milestones[projectId][milestoneIndex];
        require(m.state == MilestoneState.PENDING, "Milestone not fundable");
    }

    function _requireFundedMilestone(uint256 projectId, uint256 milestoneIndex)
        internal
        view
        returns (Milestone storage m)
    {
        require(milestoneIndex < _milestones[projectId].length, "No such milestone");
        m = _milestones[projectId][milestoneIndex];
        require(m.state == MilestoneState.FUNDED, "Milestone not in escrow");
    }

    /**
     * @dev Reverts unless `decisionId` is a FINANCIAL decision currently in the
     *      EXECUTED state on the HumanApprovalGateway. This is the on-chain
     *      enforcement that a licensed human quorum signed off — not an AI, not
     *      automation, not this contract's own logic.
     */
    function _requireExecutedFinancialDecision(uint256 decisionId) internal view {
        (
            ,
            IHumanApprovalGateway.DecisionDomain domain,
            IHumanApprovalGateway.DecisionStatus status,
            ,
            ,
            ,
            ,
        ) = approvalGateway.decisions(decisionId);
        require(domain == IHumanApprovalGateway.DecisionDomain.FINANCIAL, "Decision not financial");
        require(status == IHumanApprovalGateway.DecisionStatus.EXECUTED, "Decision not executed");
    }
}
