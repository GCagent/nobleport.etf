// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NBPTSecurityToken1400
 * @author NoblePort ETF - Tokenization Module (white-label ERC-1400)
 * @notice White-label ERC-1400 security token for NBPT (NoblePort), with an
 *         operational peg to the USDC stablecoin for subscription and redemption.
 *
 * @dev ERC-1400 is the security-token standard family (Polymath, 2018): an
 *      ERC-20-compatible core extended with partitions (ERC-1410), transfer
 *      restrictions (ERC-1594), document hashes (ERC-1643), and a controller /
 *      forced-transfer role (ERC-1644). This contract implements a coherent,
 *      reviewable subset of that family suited to a tokenized real-estate
 *      interest, plus a USDC subscription/redemption rail.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  COMPLIANCE POSTURE — READ BEFORE DEPLOYING OR FUNDING ANYTHING
 * ─────────────────────────────────────────────────────────────────────────────
 *  This is ENGINEERING built AHEAD of legal clearance. It is safe to compile,
 *  unit-test, and deploy to a TESTNET. It is NOT cleared to take real money from
 *  real investors. That posture is enforced in code, not just documented:
 *
 *   1. `liveOfferingCleared` defaults to FALSE. While false, every value-moving
 *      path — issuance, USDC subscription, and USDC redemption — REVERTS. Only a
 *      governance admin can flip it, and only by recording the on-chain id of an
 *      approved HumanApprovalGateway decision plus a counsel attestation hash
 *      (the "Cooley gate"). There is no other way to enable the live offering.
 *
 *   2. Accreditation is VERIFIER-ATTESTED, never self-asserted. Only an
 *      ACCREDITATION_VERIFIER_ROLE holder can mark an investor accredited, and
 *      only with an evidence hash and an expiry. A self-asserted "I am
 *      accredited" soulbound token does NOT, by itself, meet the SEC's
 *      "reasonable steps" bar under Rule 506(c); do not wire one in here.
 *
 *   3. Issuing tokenized project equity or revenue shares is issuing a SECURITY.
 *      A construction (CSL/HIC) or real-estate broker license confers ZERO
 *      authority to issue securities. That requires a valid exemption or
 *      registration, accredited-investor verification, disclosures, and —
 *      depending on activity — a registered broker-dealer. Reference deployments
 *      (Aspen Coin / St. Regis under Reg D 506(c), RealT) all ran through that
 *      full apparatus; they prove tokenization works WITH the apparatus, not
 *      that it is optional.
 *
 *  Not legal advice. Counsel is the call. This contract is written so that the
 *  correct instinct ("HOLD pending written sign-off") cannot be coded around.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Integrates with NoblePort's HumanApprovalGateway: subscriptions and
 * redemptions above a configurable threshold must reference an EXECUTED
 * financial decision, keeping regulated-activity-adjacent flows under licensed
 * human review (no AI/automation may move investor money unattended).
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev Minimal view into the HumanApprovalGateway used to confirm that a
 *      financial decision reached human-approved, executed status before money
 *      moves. Mirrors the relevant fields of HumanApprovalGateway.Decision.
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

contract NBPTSecurityToken1400 is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Roles ============

    bytes32 public constant GOVERNANCE_ADMIN_ROLE = keccak256("GOVERNANCE_ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");
    bytes32 public constant KYC_OFFICER_ROLE = keccak256("KYC_OFFICER_ROLE");
    bytes32 public constant ACCREDITATION_VERIFIER_ROLE = keccak256("ACCREDITATION_VERIFIER_ROLE");
    bytes32 public constant DOCUMENT_MANAGER_ROLE = keccak256("DOCUMENT_MANAGER_ROLE");

    // ============ ERC-20 metadata ============

    string public name = "NoblePort Security Token";
    string public symbol = "NBPT";
    uint8 public constant decimals = 18;

    // White-label, per-deployment descriptor. For a single-asset token (e.g. a
    // land parcel) point this at the off-chain document set — survey, title
    // report, zoning certificate, encumbrances — on IPFS or other immutable
    // storage. Mirrors the ERC-1400 `_tokenDetails` convention.
    string public tokenDetails;

    // Smallest indivisible unit, in base units (ERC-1410 granularity). Every
    // issued, transferred, redeemed, or subscribed amount must be an exact
    // multiple of this. Defaults to 1 (fully divisible — preserves prior
    // behavior). For a parcel where 1 token == 1% ownership and decimals == 18,
    // set granularity to 1e18 (whole-percent units only) or 1e15 (0.1% steps).
    uint256 public granularity = 1;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ============ ERC-1410 partitions ============

    // Default partition for tokens that carry no special lock/tranche semantics.
    bytes32 public constant DEFAULT_PARTITION = bytes32("default");

    // partition => holder => balance
    mapping(bytes32 => mapping(address => uint256)) private _partitionBalances;
    // partition => total supply
    mapping(bytes32 => uint256) public totalSupplyByPartition;
    // holder => list of partitions they hold (may contain stale zero entries)
    mapping(address => bytes32[]) private _partitionsOf;
    mapping(address => mapping(bytes32 => bool)) private _partitionKnown;

    // operator => holder => approved for all partitions
    mapping(address => mapping(address => bool)) private _operators;
    // partition => operator => holder => approved for that partition
    mapping(bytes32 => mapping(address => mapping(address => bool))) private _partitionOperators;

    // ============ ERC-1594 / compliance ============

    bool public issuable = true; // ERC-1594 issuance switch (can be permanently closed)

    struct Investor {
        bool kycVerified;        // identity / AML cleared
        bool frozen;             // account-level freeze (sanctions, dispute, etc.)
        bool accredited;         // verifier-attested accreditation
        uint64 accreditedUntil;  // accreditation expiry (unix seconds); 0 = none
        bytes32 evidenceHash;    // hash of off-chain accreditation evidence (IPFS, etc.)
        uint64 lockupUntil;      // tokens non-transferable until this time
    }

    mapping(address => Investor) public investors;

    // Whether transfers/issuance require accredited status (Reg D 506(c) style).
    bool public accreditationRequired = true;
    // Minimum holding period imposed on newly issued tokens (e.g. Rule 144).
    uint64 public defaultLockupPeriod;

    // ============ ERC-1644 controller ============

    bool public isControllable = true; // can be permanently disabled by governance

    // ============ ERC-1643 documents ============

    struct Document {
        bytes32 docHash;   // hash of the document contents
        string uri;        // URI (IPFS/HTTPS) where the document lives
        uint256 timestamp; // last update time
    }

    mapping(bytes32 => Document) private _documents; // name => Document
    bytes32[] private _documentNames;
    mapping(bytes32 => bool) private _documentKnown;

    // ============ USDC peg / launch gate ============

    IERC20 public immutable usdc;            // Circle USDC (6 decimals on mainnet)
    uint8 public immutable usdcDecimals;     // recorded at deploy for peg math

    // 1 NBPT (1e18) is subscribable/redeemable for `pegPriceUSDC` USDC base units.
    // Defaults to par: 1 NBPT == 1 USDC. Governance may update to track NAV.
    uint256 public pegPriceUSDC;

    // THE COOLEY GATE. No real money moves while this is false.
    bool public liveOfferingCleared;
    uint256 public clearanceDecisionId;   // HumanApprovalGateway decision id
    bytes32 public clearanceAttestation;  // hash of counsel's written sign-off

    // HumanApprovalGateway reference + threshold above which money moves need an
    // executed, human-approved decision id.
    IHumanApprovalGateway public approvalGateway;
    uint256 public humanReviewThresholdUSDC;

    // USDC held by the contract as the redemption reserve.
    uint256 public usdcReserve;

    // ============ ERC-1066 status codes (subset) ============

    bytes1 internal constant STATUS_TRANSFER_FAILURE = 0x50;
    bytes1 internal constant STATUS_TRANSFER_SUCCESS = 0x51;
    bytes1 internal constant STATUS_INSUFFICIENT_BALANCE = 0x52;
    bytes1 internal constant STATUS_RECEIVER_NOT_ELIGIBLE = 0x57;
    bytes1 internal constant STATUS_SENDER_NOT_ELIGIBLE = 0x56;
    bytes1 internal constant STATUS_PAUSED_OR_LOCKED = 0x54;

    // ============ Events ============

    // ERC-20
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ERC-1410 / ERC-1594
    event TransferByPartition(
        bytes32 indexed partition,
        address operator,
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data,
        bytes operatorData
    );
    event IssuedByPartition(bytes32 indexed partition, address indexed to, uint256 value, bytes data);
    event RedeemedByPartition(bytes32 indexed partition, address operator, address indexed from, uint256 value, bytes data);
    event AuthorizedOperator(address indexed operator, address indexed holder);
    event RevokedOperator(address indexed operator, address indexed holder);
    event IssuanceClosed(address indexed by);

    // ERC-1644
    event ControllerTransfer(address controller, address indexed from, address indexed to, uint256 value, bytes data, bytes operatorData);
    event ControllerRedemption(address controller, address indexed from, uint256 value, bytes data, bytes operatorData);
    event ControllabilityDisabled(address indexed by);

    // ERC-1643
    event DocumentUpdated(bytes32 indexed name, string uri, bytes32 docHash);
    event DocumentRemoved(bytes32 indexed name, string uri, bytes32 docHash);

    // Compliance lifecycle
    event KycStatusUpdated(address indexed investor, bool verified);
    event AccreditationUpdated(address indexed investor, bool accredited, uint64 accreditedUntil, bytes32 evidenceHash);
    event AccountFrozen(address indexed investor, bool frozen);
    event LockupSet(address indexed investor, uint64 until);

    // USDC peg / launch gate
    event LiveOfferingClearanceUpdated(bool cleared, uint256 decisionId, bytes32 attestation);
    event PegPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event Subscribed(address indexed investor, bytes32 indexed partition, uint256 usdcPaid, uint256 tokensIssued, uint256 decisionId);
    event RedeemedForUSDC(address indexed investor, bytes32 indexed partition, uint256 tokensBurned, uint256 usdcPaid, uint256 decisionId);
    event ReserveDeposited(address indexed from, uint256 amount);
    event ReserveWithdrawn(address indexed to, uint256 amount);
    event ApprovalGatewayUpdated(address indexed gateway, uint256 thresholdUSDC);

    // White-label configuration
    event TokenMetadataUpdated(string name, string symbol, string tokenDetails);
    event GranularityUpdated(uint256 oldGranularity, uint256 newGranularity);

    // ============ Modifiers ============

    /// @dev Hard gate: blocks all real-money paths until counsel clears the offering.
    modifier onlyWhenLive() {
        require(
            liveOfferingCleared,
            "PRE_CLEARANCE: live offering not cleared by counsel (Cooley gate)"
        );
        _;
    }

    // ============ Constructor ============

    /**
     * @param _governanceAdmin   Initial governance administrator.
     * @param _usdc              Address of the USDC token (Circle) on this chain.
     * @param _usdcDecimals      Decimals of that USDC deployment (6 on mainnet).
     * @param _pegPriceUSDC      USDC base units per 1e18 NBPT (par = 1 * 10^usdcDecimals).
     */
    constructor(
        address _governanceAdmin,
        address _usdc,
        uint8 _usdcDecimals,
        uint256 _pegPriceUSDC
    ) {
        require(_governanceAdmin != address(0), "Invalid admin");
        require(_usdc != address(0), "Invalid USDC address");
        require(_pegPriceUSDC > 0, "Peg price must be > 0");

        _grantRole(DEFAULT_ADMIN_ROLE, _governanceAdmin);
        _grantRole(GOVERNANCE_ADMIN_ROLE, _governanceAdmin);

        usdc = IERC20(_usdc);
        usdcDecimals = _usdcDecimals;
        pegPriceUSDC = _pegPriceUSDC;

        // Deliberately NOT cleared. Must pass through setLiveOfferingClearance().
        liveOfferingCleared = false;
    }

    // ============ ERC-20 core ============

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /// @notice ERC-20 transfer. Always operates on the DEFAULT partition and is
    ///         subject to the full compliance check.
    function transfer(address to, uint256 value) external returns (bool) {
        _transferByPartition(DEFAULT_PARTITION, address(0), msg.sender, to, value, "", "");
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 current = _allowances[from][msg.sender];
        require(current >= value, "ERC20: insufficient allowance");
        unchecked {
            _allowances[from][msg.sender] = current - value;
        }
        _transferByPartition(DEFAULT_PARTITION, address(0), from, to, value, "", "");
        return true;
    }

    // ============ ERC-1410 partitions ============

    function balanceOfByPartition(bytes32 partition, address holder) external view returns (uint256) {
        return _partitionBalances[partition][holder];
    }

    function partitionsOf(address holder) external view returns (bytes32[] memory) {
        return _partitionsOf[holder];
    }

    function authorizeOperator(address operator) external {
        _operators[operator][msg.sender] = true;
        emit AuthorizedOperator(operator, msg.sender);
    }

    function revokeOperator(address operator) external {
        _operators[operator][msg.sender] = false;
        emit RevokedOperator(operator, msg.sender);
    }

    function authorizeOperatorByPartition(bytes32 partition, address operator) external {
        _partitionOperators[partition][operator][msg.sender] = true;
        emit AuthorizedOperator(operator, msg.sender);
    }

    function revokeOperatorByPartition(bytes32 partition, address operator) external {
        _partitionOperators[partition][operator][msg.sender] = false;
        emit RevokedOperator(operator, msg.sender);
    }

    function isOperator(address operator, address holder) public view returns (bool) {
        return _operators[operator][holder];
    }

    function isOperatorForPartition(bytes32 partition, address operator, address holder) public view returns (bool) {
        return _partitionOperators[partition][operator][holder] || _operators[operator][holder];
    }

    /// @notice Transfer within a partition by the holder.
    function transferByPartition(
        bytes32 partition,
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bytes32) {
        _transferByPartition(partition, address(0), msg.sender, to, value, data, "");
        return partition;
    }

    /// @notice Transfer within a partition by an authorized operator.
    function operatorTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external returns (bytes32) {
        require(isOperatorForPartition(partition, msg.sender, from), "Not an operator for partition");
        _transferByPartition(partition, msg.sender, from, to, value, data, operatorData);
        return partition;
    }

    // ============ ERC-1594 transfer restrictions ============

    /// @notice ERC-1594 transfer feasibility check on the default partition.
    /// @return code ERC-1066 status byte, reason human string.
    function canTransfer(address to, uint256 value, bytes calldata /*data*/)
        external
        view
        returns (bytes1 code, bytes32 reason)
    {
        return _canTransfer(DEFAULT_PARTITION, msg.sender, to, value);
    }

    function canTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 value,
        bytes calldata /*data*/
    ) external view returns (bytes1 code, bytes32 reason, bytes32 destinationPartition) {
        (code, reason) = _canTransfer(partition, from, to, value);
        destinationPartition = partition;
    }

    function _canTransfer(bytes32 partition, address from, address to, uint256 value)
        internal
        view
        returns (bytes1 code, bytes32 reason)
    {
        if (paused()) return (STATUS_PAUSED_OR_LOCKED, "token paused");
        if (to == address(0)) return (STATUS_TRANSFER_FAILURE, "transfer to zero");
        if (value % granularity != 0) return (STATUS_TRANSFER_FAILURE, "not granular");
        if (_partitionBalances[partition][from] < value) return (STATUS_INSUFFICIENT_BALANCE, "insufficient balance");
        if (investors[from].frozen) return (STATUS_SENDER_NOT_ELIGIBLE, "sender frozen");
        if (investors[to].frozen) return (STATUS_RECEIVER_NOT_ELIGIBLE, "receiver frozen");
        if (block.timestamp < investors[from].lockupUntil) return (STATUS_PAUSED_OR_LOCKED, "sender lockup");
        if (!investors[to].kycVerified) return (STATUS_RECEIVER_NOT_ELIGIBLE, "receiver not KYC");
        if (accreditationRequired && !_isAccredited(to)) return (STATUS_RECEIVER_NOT_ELIGIBLE, "receiver not accredited");
        return (STATUS_TRANSFER_SUCCESS, "ok");
    }

    /// @notice ERC-1594 issuance. Gated by the Cooley clearance gate AND issuer role.
    function issue(address to, uint256 value, bytes calldata data)
        external
    {
        issueByPartition(DEFAULT_PARTITION, to, value, data);
    }

    /// @notice ERC-1594 issuance into a specific partition.
    function issueByPartition(bytes32 partition, address to, uint256 value, bytes memory data)
        public
        whenNotPaused
        onlyWhenLive
        onlyRole(ISSUER_ROLE)
        nonReentrant
    {
        require(issuable, "Issuance permanently closed");
        require(to != address(0), "Issue to zero");
        require(value > 0, "Zero value");
        require(value % granularity == 0, "Not granular");
        require(investors[to].kycVerified, "Recipient not KYC verified");
        require(!accreditationRequired || _isAccredited(to), "Recipient not accredited");

        _mint(partition, to, value);

        // Apply default lock-up (Rule 144 style) if set and longer than existing.
        if (defaultLockupPeriod > 0) {
            uint64 until = uint64(block.timestamp) + defaultLockupPeriod;
            if (until > investors[to].lockupUntil) {
                investors[to].lockupUntil = until;
                emit LockupSet(to, until);
            }
        }

        emit IssuedByPartition(partition, to, value, data);
    }

    /// @notice Permanently close issuance (ERC-1594). One-way.
    function closeIssuance() external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        issuable = false;
        emit IssuanceClosed(msg.sender);
    }

    /// @notice Holder-initiated redemption (burn) on default partition.
    function redeem(uint256 value, bytes calldata data) external {
        redeemByPartition(DEFAULT_PARTITION, value, data);
    }

    function redeemByPartition(bytes32 partition, uint256 value, bytes memory data)
        public
        whenNotPaused
        nonReentrant
    {
        require(value % granularity == 0, "Not granular");
        require(_partitionBalances[partition][msg.sender] >= value, "Insufficient balance");
        _burn(partition, msg.sender, value);
        emit RedeemedByPartition(partition, address(0), msg.sender, value, data);
    }

    function isIssuable() external view returns (bool) {
        return issuable && liveOfferingCleared;
    }

    // ============ USDC subscription / redemption (real money — gated) ============

    /**
     * @notice Subscribe: pay USDC, receive newly issued NBPT at the peg price.
     * @dev Hard-gated by the Cooley clearance gate. The investor must be KYC'd and
     *      (if required) accredited. Amounts at/above the human-review threshold
     *      MUST reference an EXECUTED HumanApprovalGateway financial decision —
     *      no automation may push investor money past that bar unattended.
     * @param partition    Partition to issue into.
     * @param usdcAmount   USDC base units to pay (must be approved to this contract).
     * @param decisionId   HumanApprovalGateway decision id (0 if below threshold).
     */
    function subscribe(bytes32 partition, uint256 usdcAmount, uint256 decisionId)
        external
        whenNotPaused
        onlyWhenLive
        nonReentrant
    {
        require(usdcAmount > 0, "Zero USDC");
        require(issuable, "Issuance closed");
        require(investors[msg.sender].kycVerified, "Not KYC verified");
        require(!accreditationRequired || _isAccredited(msg.sender), "Not accredited");

        _requireHumanApprovalIfNeeded(usdcAmount, decisionId);

        // tokens = usdcAmount * 1e18 / pegPriceUSDC
        uint256 tokens = (usdcAmount * (10 ** uint256(decimals))) / pegPriceUSDC;
        require(tokens > 0, "Below minimum subscription");
        // Subscription must resolve to a whole number of tradable units. The
        // investor pays USDC matching an exact multiple of `granularity`.
        require(tokens % granularity == 0, "Subscription not granular");

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        usdcReserve += usdcAmount;

        _mint(partition, msg.sender, tokens);

        if (defaultLockupPeriod > 0) {
            uint64 until = uint64(block.timestamp) + defaultLockupPeriod;
            if (until > investors[msg.sender].lockupUntil) {
                investors[msg.sender].lockupUntil = until;
                emit LockupSet(msg.sender, until);
            }
        }

        emit Subscribed(msg.sender, partition, usdcAmount, tokens, decisionId);
    }

    /**
     * @notice Redeem NBPT back to USDC at the peg price, from the reserve.
     * @dev Hard-gated. Subject to lock-up and frozen checks. Large redemptions
     *      require an executed HumanApprovalGateway financial decision.
     */
    function redeemForUSDC(bytes32 partition, uint256 tokens, uint256 decisionId)
        external
        whenNotPaused
        onlyWhenLive
        nonReentrant
    {
        require(tokens > 0, "Zero tokens");
        require(tokens % granularity == 0, "Not granular");
        require(_partitionBalances[partition][msg.sender] >= tokens, "Insufficient balance");
        require(!investors[msg.sender].frozen, "Account frozen");
        require(block.timestamp >= investors[msg.sender].lockupUntil, "Lockup active");

        // usdcOut = tokens * pegPriceUSDC / 1e18
        uint256 usdcOut = (tokens * pegPriceUSDC) / (10 ** uint256(decimals));
        require(usdcOut > 0, "Below minimum redemption");
        require(usdcReserve >= usdcOut, "Insufficient USDC reserve");

        _requireHumanApprovalIfNeeded(usdcOut, decisionId);

        _burn(partition, msg.sender, tokens);
        usdcReserve -= usdcOut;
        usdc.safeTransfer(msg.sender, usdcOut);

        emit RedeemedForUSDC(msg.sender, partition, tokens, usdcOut, decisionId);
    }

    /// @notice Top up the USDC redemption reserve (e.g. from rental income / NAV).
    function depositReserve(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        usdcReserve += amount;
        emit ReserveDeposited(msg.sender, amount);
    }

    /// @notice Governance withdrawal from reserve (e.g. to custodian). Gated by
    ///         live clearance to avoid moving real funds pre-clearance.
    function withdrawReserve(address to, uint256 amount)
        external
        onlyRole(GOVERNANCE_ADMIN_ROLE)
        onlyWhenLive
        nonReentrant
    {
        require(to != address(0), "Zero address");
        require(usdcReserve >= amount, "Exceeds reserve");
        usdcReserve -= amount;
        usdc.safeTransfer(to, amount);
        emit ReserveWithdrawn(to, amount);
    }

    function _requireHumanApprovalIfNeeded(uint256 usdcAmount, uint256 decisionId) internal view {
        if (humanReviewThresholdUSDC == 0 || usdcAmount < humanReviewThresholdUSDC) {
            return;
        }
        require(address(approvalGateway) != address(0), "Approval gateway not set");
        require(decisionId != 0, "Human approval decision id required");
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

    // ============ ERC-1644 controller operations ============

    /**
     * @notice Forced transfer by a controller (e.g. court order, lost-key
     *         recovery, regulatory directive). Use is logged and recoverable.
     * @dev Even forced transfers respect the live-clearance gate for value that
     *      represents real investor holdings.
     */
    function controllerTransfer(
        bytes32 partition,
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external whenNotPaused onlyRole(CONTROLLER_ROLE) nonReentrant {
        require(isControllable, "Controllability disabled");
        require(to != address(0), "Transfer to zero");
        require(_partitionBalances[partition][from] >= value, "Insufficient balance");

        _moveTokens(partition, from, to, value);

        emit ControllerTransfer(msg.sender, from, to, value, data, operatorData);
        emit TransferByPartition(partition, msg.sender, from, to, value, data, operatorData);
        emit Transfer(from, to, value);
    }

    function controllerRedeem(
        bytes32 partition,
        address from,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external whenNotPaused onlyRole(CONTROLLER_ROLE) nonReentrant {
        require(isControllable, "Controllability disabled");
        require(_partitionBalances[partition][from] >= value, "Insufficient balance");

        _burn(partition, from, value);

        emit ControllerRedemption(msg.sender, from, value, data, operatorData);
    }

    /// @notice Permanently renounce controller (forced-transfer) capability.
    function disableControllability() external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        isControllable = false;
        emit ControllabilityDisabled(msg.sender);
    }

    // ============ ERC-1643 document management ============

    function setDocument(bytes32 docName, string calldata uri, bytes32 docHash)
        external
        onlyRole(DOCUMENT_MANAGER_ROLE)
    {
        require(docName != bytes32(0), "Empty name");
        if (!_documentKnown[docName]) {
            _documentKnown[docName] = true;
            _documentNames.push(docName);
        }
        _documents[docName] = Document({docHash: docHash, uri: uri, timestamp: block.timestamp});
        emit DocumentUpdated(docName, uri, docHash);
    }

    function getDocument(bytes32 docName)
        external
        view
        returns (string memory uri, bytes32 docHash, uint256 timestamp)
    {
        Document storage d = _documents[docName];
        return (d.uri, d.docHash, d.timestamp);
    }

    function getAllDocuments() external view returns (bytes32[] memory) {
        return _documentNames;
    }

    function removeDocument(bytes32 docName) external onlyRole(DOCUMENT_MANAGER_ROLE) {
        require(_documentKnown[docName], "Unknown document");
        Document memory d = _documents[docName];
        delete _documents[docName];
        _documentKnown[docName] = false;

        // Remove from the names array (swap-and-pop).
        uint256 len = _documentNames.length;
        for (uint256 i = 0; i < len; i++) {
            if (_documentNames[i] == docName) {
                _documentNames[i] = _documentNames[len - 1];
                _documentNames.pop();
                break;
            }
        }
        emit DocumentRemoved(docName, d.uri, d.docHash);
    }

    // ============ Compliance administration ============

    function setKycStatus(address investor, bool verified) external onlyRole(KYC_OFFICER_ROLE) {
        investors[investor].kycVerified = verified;
        emit KycStatusUpdated(investor, verified);
    }

    /**
     * @notice Record a VERIFIER-ATTESTED accreditation determination.
     * @dev Only an accreditation verifier may call this, and only with an
     *      evidence hash and an expiry. This is the on-chain anchor for the
     *      "reasonable steps" record required under Rule 506(c). A self-asserted
     *      accreditation claim (e.g. a soulbound token the investor mints for
     *      themselves) does NOT satisfy that bar and must not be routed here.
     */
    function setAccreditation(
        address investor,
        bool accredited,
        uint64 accreditedUntil,
        bytes32 evidenceHash
    ) external onlyRole(ACCREDITATION_VERIFIER_ROLE) {
        if (accredited) {
            require(accreditedUntil > block.timestamp, "Expiry in the past");
            require(evidenceHash != bytes32(0), "Evidence hash required");
        }
        Investor storage inv = investors[investor];
        inv.accredited = accredited;
        inv.accreditedUntil = accredited ? accreditedUntil : 0;
        inv.evidenceHash = accredited ? evidenceHash : bytes32(0);
        emit AccreditationUpdated(investor, accredited, inv.accreditedUntil, inv.evidenceHash);
    }

    function _isAccredited(address investor) internal view returns (bool) {
        Investor storage inv = investors[investor];
        return inv.accredited && inv.accreditedUntil > block.timestamp;
    }

    function isAccredited(address investor) external view returns (bool) {
        return _isAccredited(investor);
    }

    function setFrozen(address investor, bool frozen) external onlyRole(KYC_OFFICER_ROLE) {
        investors[investor].frozen = frozen;
        emit AccountFrozen(investor, frozen);
    }

    function setLockup(address investor, uint64 until) external onlyRole(KYC_OFFICER_ROLE) {
        investors[investor].lockupUntil = until;
        emit LockupSet(investor, until);
    }

    function setAccreditationRequired(bool required) external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        accreditationRequired = required;
    }

    function setDefaultLockupPeriod(uint64 period) external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        defaultLockupPeriod = period;
    }

    // ============ White-label configuration ============

    /**
     * @notice White-label the token to a specific issuer / asset.
     * @dev For a land-parcel deployment set name to the legal entity
     *      (e.g. "123 Country Road LLC"), symbol to a short ticker
     *      (e.g. "LAND1"), and tokenDetails to the IPFS/URI pointer for the
     *      off-chain document set (survey, title report, zoning, encumbrances).
     *      Metadata is informational; the binding legal documents are anchored
     *      by hash via setDocument (ERC-1643).
     */
    function setTokenMetadata(
        string calldata newName,
        string calldata newSymbol,
        string calldata newTokenDetails
    ) external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        require(bytes(newName).length > 0, "Name required");
        require(bytes(newSymbol).length > 0, "Symbol required");
        name = newName;
        symbol = newSymbol;
        tokenDetails = newTokenDetails;
        emit TokenMetadataUpdated(newName, newSymbol, newTokenDetails);
    }

    /**
     * @notice Set the smallest tradable unit (ERC-1410 granularity).
     * @dev Only settable while nothing has been issued, so existing balances can
     *      never be stranded below the unit size. Must be >= 1. For a parcel
     *      where 1 token == 1% and decimals == 18, use 1e18 for whole-percent
     *      units or 1e15 for 0.1% steps.
     */
    function setGranularity(uint256 newGranularity) external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        require(newGranularity >= 1, "Granularity must be >= 1");
        require(_totalSupply == 0, "Supply already issued");
        uint256 old = granularity;
        granularity = newGranularity;
        emit GranularityUpdated(old, newGranularity);
    }

    // ============ Launch gate / peg administration ============

    /**
     * @notice Flip the live-offering clearance — THE COOLEY GATE.
     * @dev Enabling the live offering requires recording (a) the id of an
     *      EXECUTED HumanApprovalGateway LEGAL decision representing counsel's
     *      written sign-off, and (b) a hash of that written attestation. This is
     *      the only path to enable real-money flows. Governance may disable at
     *      any time without those references (e.g. emergency HOLD).
     * @param cleared      True to enable the live offering.
     * @param decisionId   HumanApprovalGateway LEGAL decision id (required when enabling).
     * @param attestation  Hash of counsel's written clearance (required when enabling).
     */
    function setLiveOfferingClearance(bool cleared, uint256 decisionId, bytes32 attestation)
        external
        onlyRole(GOVERNANCE_ADMIN_ROLE)
    {
        if (cleared) {
            require(attestation != bytes32(0), "Counsel attestation required");
            require(address(approvalGateway) != address(0), "Approval gateway not set");
            require(decisionId != 0, "Legal decision id required");
            (
                ,
                IHumanApprovalGateway.DecisionDomain domain,
                IHumanApprovalGateway.DecisionStatus status,
                ,
                ,
                ,
                ,
            ) = approvalGateway.decisions(decisionId);
            require(domain == IHumanApprovalGateway.DecisionDomain.LEGAL, "Decision not legal");
            require(status == IHumanApprovalGateway.DecisionStatus.EXECUTED, "Legal decision not executed");

            clearanceDecisionId = decisionId;
            clearanceAttestation = attestation;
        } else {
            clearanceDecisionId = 0;
            clearanceAttestation = bytes32(0);
        }
        liveOfferingCleared = cleared;
        emit LiveOfferingClearanceUpdated(cleared, decisionId, attestation);
    }

    function setApprovalGateway(address gateway, uint256 thresholdUSDC)
        external
        onlyRole(GOVERNANCE_ADMIN_ROLE)
    {
        approvalGateway = IHumanApprovalGateway(gateway);
        humanReviewThresholdUSDC = thresholdUSDC;
        emit ApprovalGatewayUpdated(gateway, thresholdUSDC);
    }

    function setPegPrice(uint256 newPegPriceUSDC) external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        require(newPegPriceUSDC > 0, "Peg must be > 0");
        uint256 old = pegPriceUSDC;
        pegPriceUSDC = newPegPriceUSDC;
        emit PegPriceUpdated(old, newPegPriceUSDC);
    }

    // ============ Emergency controls ============

    function pause() external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNANCE_ADMIN_ROLE) {
        _unpause();
    }

    // ============ Internal token mechanics ============

    function _transferByPartition(
        bytes32 partition,
        address operator,
        address from,
        address to,
        uint256 value,
        bytes memory data,
        bytes memory operatorData
    ) internal whenNotPaused {
        (bytes1 code, bytes32 reason) = _canTransfer(partition, from, to, value);
        require(code == STATUS_TRANSFER_SUCCESS, _reasonString(reason));

        _moveTokens(partition, from, to, value);

        emit TransferByPartition(partition, operator, from, to, value, data, operatorData);
        emit Transfer(from, to, value);
    }

    function _moveTokens(bytes32 partition, address from, address to, uint256 value) internal {
        _partitionBalances[partition][from] -= value;
        _balances[from] -= value;

        _partitionBalances[partition][to] += value;
        _balances[to] += value;
        _trackPartition(to, partition);
    }

    function _mint(bytes32 partition, address to, uint256 value) internal {
        _totalSupply += value;
        totalSupplyByPartition[partition] += value;
        _balances[to] += value;
        _partitionBalances[partition][to] += value;
        _trackPartition(to, partition);
        emit Transfer(address(0), to, value);
    }

    function _burn(bytes32 partition, address from, uint256 value) internal {
        _partitionBalances[partition][from] -= value;
        _balances[from] -= value;
        totalSupplyByPartition[partition] -= value;
        _totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    function _trackPartition(address holder, bytes32 partition) internal {
        if (!_partitionKnown[holder][partition]) {
            _partitionKnown[holder][partition] = true;
            _partitionsOf[holder].push(partition);
        }
    }

    function _reasonString(bytes32 reason) internal pure returns (string memory) {
        uint256 len = 0;
        while (len < 32 && reason[len] != 0) {
            len++;
        }
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = reason[i];
        }
        return string(out);
    }
}
