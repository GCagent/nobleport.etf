// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/INBPT.sol";

/**
 * @title RevenueBridge
 * @author NoblePort Engineering
 * @notice Connects off-chain billing systems (Stripe, Mercury, etc.) to on-chain NBPT partition issuance
 * @dev Production-grade bridge for revenue recognition with full audit trail
 *
 * Architecture:
 * ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
 * │  Stripe/Mercury │────▶│  RevenueBridge   │────▶│  NBPT Token     │
 * │  (Off-chain)    │     │  (This Contract) │     │  (Partitions)   │
 * └─────────────────┘     └──────────────────┘     └─────────────────┘
 *
 * Security Considerations:
 * - Only authorized operators can bridge revenue
 * - Duplicate invoice protection prevents double-counting
 * - Reversals require explicit authorization
 * - All operations emit events for The Graph / Dune indexing
 */
contract RevenueBridge is Ownable, ReentrancyGuard, Pausable {
    // ═══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Maximum percentage sum (100%)
    uint256 public constant MAX_PERCENTAGE = 100;

    /// @notice Basis points denominator for precision (10000 = 100.00%)
    uint256 public constant BASIS_POINTS = 10000;

    // Source system identifiers
    bytes32 public constant SOURCE_STRIPE = keccak256("STRIPE");
    bytes32 public constant SOURCE_MERCURY = keccak256("MERCURY");
    bytes32 public constant SOURCE_ESCROW = keccak256("ESCROW");
    bytes32 public constant SOURCE_MANUAL = keccak256("MANUAL");

    // Destination system identifiers
    bytes32 public constant DEST_DAO_TREASURY = keccak256("NOBLEPORT_DAO");
    bytes32 public constant DEST_OPERATIONS = keccak256("NOBLEPORT_OPS");
    bytes32 public constant DEST_RESERVE = keccak256("NOBLEPORT_RESERVE");

    // ═══════════════════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Settlement status for revenue entries
    enum SettlementStatus {
        PENDING,   // 0 - Awaiting confirmation
        SETTLED,   // 1 - Finalized and distributed
        REVERSED,  // 2 - Clawback or refund processed
        DISPUTED   // 3 - Under review
    }

    /// @notice Complete revenue entry record
    struct RevenueEntry {
        string invoiceId;           // Off-chain invoice / ERP reference
        address payer;              // Who paid
        address beneficiary;        // Who receives revenue
        uint256 amount;             // Amount bridged (raw units, 6 decimals)
        address currency;           // ERC20 address (or address(0) for native)
        bytes32 sourceSystem;       // e.g., SOURCE_STRIPE
        bytes32 destinationSystem;  // e.g., DEST_DAO_TREASURY
        bytes32 settlementId;       // Unique settlement identifier
        SettlementStatus status;    // Current status
        uint256 bridgedAt;          // Block timestamp of bridging
        uint256 settledAt;          // Block timestamp of settlement (0 if not settled)
    }

    /// @notice Allocation configuration for partitions
    struct AllocationConfig {
        uint256 reserveBps;      // Reserve allocation in basis points
        uint256 liquidityBps;    // Liquidity allocation in basis points
        uint256 enterpriseBps;   // Enterprise allocation in basis points
        uint256 stakingBps;      // Staking allocation in basis points
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice The NBPT token contract
    INBPT public immutable nbptToken;

    /// @notice Authorized bridge operator (e.g., Node.js webhook server)
    address public bridgeOperator;

    /// @notice Current allocation configuration
    AllocationConfig public allocation;

    /// @notice Mapping of invoice ID hash to settlement ID
    mapping(bytes32 => bytes32) public invoiceToSettlement;

    /// @notice Mapping of settlement ID to revenue entry
    mapping(bytes32 => RevenueEntry) public settlements;

    /// @notice Total revenue bridged (in base units)
    uint256 public totalRevenueBridged;

    /// @notice Total revenue reversed (in base units)
    uint256 public totalRevenueReversed;

    /// @notice Settlement counter for unique ID generation
    uint256 private _settlementNonce;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when revenue is successfully bridged
     * @dev This is the primary accounting event - treat as source of truth
     * @param invoiceId Off-chain invoice / ERP reference (indexed for filtering)
     * @param payer Who paid (indexed for payer queries)
     * @param beneficiary Who receives revenue (indexed for beneficiary queries)
     * @param amount Amount bridged in raw units (6 decimals for USD)
     * @param currency ERC20 address (address(0) for native ETH)
     * @param sourceSystem Origin system identifier (e.g., keccak256("STRIPE"))
     * @param destinationSystem Target system identifier (e.g., keccak256("NOBLEPORT_DAO"))
     * @param settlementId Unique settlement identifier for this transaction
     * @param timestamp Block-aligned business timestamp
     */
    event RevenueBridged(
        string indexed invoiceId,
        address indexed payer,
        address indexed beneficiary,
        uint256 amount,
        address currency,
        bytes32 sourceSystem,
        bytes32 destinationSystem,
        bytes32 settlementId,
        uint256 timestamp
    );

    /**
     * @notice Emitted when tokens are issued to a partition
     * @param settlementId The settlement this issuance belongs to
     * @param partition The partition tokens were issued to
     * @param recipient The token recipient
     * @param amount The amount issued
     */
    event PartitionIssued(
        bytes32 indexed settlementId,
        bytes32 indexed partition,
        address indexed recipient,
        uint256 amount
    );

    /**
     * @notice Emitted when a settlement is reversed (refund/clawback)
     * @param settlementId The settlement being reversed
     * @param invoiceId The original invoice ID
     * @param reversedBy Who authorized the reversal
     * @param reason Reason code or description hash
     * @param timestamp When the reversal occurred
     */
    event RevenueReversed(
        bytes32 indexed settlementId,
        string indexed invoiceId,
        address indexed reversedBy,
        bytes32 reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when settlement status changes
     * @param settlementId The settlement ID
     * @param oldStatus Previous status
     * @param newStatus New status
     */
    event SettlementStatusChanged(
        bytes32 indexed settlementId,
        SettlementStatus oldStatus,
        SettlementStatus newStatus
    );

    /**
     * @notice Emitted when the bridge operator is updated
     * @param oldOperator Previous operator address
     * @param newOperator New operator address
     */
    event OperatorUpdated(
        address indexed oldOperator,
        address indexed newOperator
    );

    /**
     * @notice Emitted when allocation percentages are updated
     * @param reserveBps New reserve allocation (basis points)
     * @param liquidityBps New liquidity allocation (basis points)
     * @param enterpriseBps New enterprise allocation (basis points)
     * @param stakingBps New staking allocation (basis points)
     */
    event AllocationUpdated(
        uint256 reserveBps,
        uint256 liquidityBps,
        uint256 enterpriseBps,
        uint256 stakingBps
    );

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidPercentages();
    error InvoiceAlreadyProcessed(string invoiceId);
    error SettlementNotFound(bytes32 settlementId);
    error InvalidSettlementStatus(bytes32 settlementId, SettlementStatus current, SettlementStatus required);
    error InvalidSourceSystem();

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOperator() {
        if (msg.sender != bridgeOperator && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Deploys the RevenueBridge contract
     * @param _nbptToken Address of the deployed NBPT contract
     * @param _operator Address of the authorized bridge operator
     * @param _owner Address of the contract owner
     */
    constructor(
        address _nbptToken,
        address _operator,
        address _owner
    ) Ownable(_owner) {
        if (_nbptToken == address(0)) revert ZeroAddress();
        if (_operator == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();

        nbptToken = INBPT(_nbptToken);
        bridgeOperator = _operator;

        // Default allocation: 40% Reserve, 30% Liquidity, 20% Enterprise, 10% Staking
        allocation = AllocationConfig({
            reserveBps: 4000,     // 40.00%
            liquidityBps: 3000,   // 30.00%
            enterpriseBps: 2000,  // 20.00%
            stakingBps: 1000      // 10.00%
        });

        emit OperatorUpdated(address(0), _operator);
        emit AllocationUpdated(4000, 3000, 2000, 1000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS - OPERATOR
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Bridges revenue from off-chain payment to on-chain token issuance
     * @dev This is the primary entry point for the webhook server
     * @param _invoiceId The off-chain invoice ID (Stripe, Mercury, etc.)
     * @param _amount Total amount in base units (6 decimals for USD)
     * @param _payer The address of the payer (can be zero if unknown)
     * @param _beneficiary The primary beneficiary or treasury address
     * @param _currency The currency token address (address(0) for native/USD representation)
     * @param _sourceSystem The source system identifier (use SOURCE_* constants)
     * @param _destinationSystem The destination system identifier (use DEST_* constants)
     * @return settlementId The unique settlement identifier for this transaction
     */
    function bridgeRevenue(
        string calldata _invoiceId,
        uint256 _amount,
        address _payer,
        address _beneficiary,
        address _currency,
        bytes32 _sourceSystem,
        bytes32 _destinationSystem
    ) external onlyOperator nonReentrant whenNotPaused returns (bytes32 settlementId) {
        if (_amount == 0) revert ZeroAmount();
        if (_beneficiary == address(0)) revert ZeroAddress();

        // Check for duplicate invoice
        bytes32 invoiceHash = keccak256(abi.encodePacked(_invoiceId));
        if (invoiceToSettlement[invoiceHash] != bytes32(0)) {
            revert InvoiceAlreadyProcessed(_invoiceId);
        }

        // Generate unique settlement ID
        settlementId = _generateSettlementId(_invoiceId);

        // Calculate partition amounts with remainder handling to prevent dust loss
        (
            uint256 reserveAmt,
            uint256 liquidityAmt,
            uint256 enterpriseAmt,
            uint256 stakingAmt
        ) = _calculateAllocations(_amount);

        // Store the settlement record
        settlements[settlementId] = RevenueEntry({
            invoiceId: _invoiceId,
            payer: _payer,
            beneficiary: _beneficiary,
            amount: _amount,
            currency: _currency,
            sourceSystem: _sourceSystem,
            destinationSystem: _destinationSystem,
            settlementId: settlementId,
            status: SettlementStatus.SETTLED,
            bridgedAt: block.timestamp,
            settledAt: block.timestamp
        });

        // Map invoice to settlement
        invoiceToSettlement[invoiceHash] = settlementId;

        // Update totals
        totalRevenueBridged += _amount;

        // Issue tokens to partitions
        _issueToPartitions(
            settlementId,
            _beneficiary,
            reserveAmt,
            liquidityAmt,
            enterpriseAmt,
            stakingAmt
        );

        // Emit the primary accounting event
        emit RevenueBridged(
            _invoiceId,
            _payer,
            _beneficiary,
            _amount,
            _currency,
            _sourceSystem,
            _destinationSystem,
            settlementId,
            block.timestamp
        );

        return settlementId;
    }

    /**
     * @notice Simplified bridge function for common Stripe use case
     * @param _invoiceId The Stripe invoice ID
     * @param _amount Amount in base units (6 decimals)
     * @param _beneficiary Treasury or recipient address
     * @return settlementId The settlement identifier
     */
    function bridgeStripeRevenue(
        string calldata _invoiceId,
        uint256 _amount,
        address _beneficiary
    ) external onlyOperator nonReentrant whenNotPaused returns (bytes32 settlementId) {
        return this.bridgeRevenue(
            _invoiceId,
            _amount,
            address(0),        // Payer unknown from Stripe
            _beneficiary,
            address(0),        // USD representation
            SOURCE_STRIPE,
            DEST_DAO_TREASURY
        );
    }

    /**
     * @notice Reverses a previously bridged settlement
     * @dev Use for refunds, chargebacks, or error corrections
     * @param _settlementId The settlement to reverse
     * @param _reason Reason code or description hash
     */
    function reverseSettlement(
        bytes32 _settlementId,
        bytes32 _reason
    ) external onlyOperator nonReentrant whenNotPaused {
        RevenueEntry storage entry = settlements[_settlementId];

        if (entry.bridgedAt == 0) revert SettlementNotFound(_settlementId);
        if (entry.status != SettlementStatus.SETTLED) {
            revert InvalidSettlementStatus(_settlementId, entry.status, SettlementStatus.SETTLED);
        }

        // Update status
        SettlementStatus oldStatus = entry.status;
        entry.status = SettlementStatus.REVERSED;

        // Update totals
        totalRevenueReversed += entry.amount;

        // Calculate amounts to burn
        (
            uint256 reserveAmt,
            uint256 liquidityAmt,
            uint256 enterpriseAmt,
            uint256 stakingAmt
        ) = _calculateAllocations(entry.amount);

        // Burn tokens from partitions
        _burnFromPartitions(
            entry.beneficiary,
            reserveAmt,
            liquidityAmt,
            enterpriseAmt,
            stakingAmt
        );

        emit SettlementStatusChanged(_settlementId, oldStatus, SettlementStatus.REVERSED);
        emit RevenueReversed(
            _settlementId,
            entry.invoiceId,
            msg.sender,
            _reason,
            block.timestamp
        );
    }

    /**
     * @notice Marks a settlement as disputed
     * @param _settlementId The settlement to dispute
     */
    function disputeSettlement(bytes32 _settlementId) external onlyOperator {
        RevenueEntry storage entry = settlements[_settlementId];

        if (entry.bridgedAt == 0) revert SettlementNotFound(_settlementId);

        SettlementStatus oldStatus = entry.status;
        entry.status = SettlementStatus.DISPUTED;

        emit SettlementStatusChanged(_settlementId, oldStatus, SettlementStatus.DISPUTED);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS - ADMIN
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Updates the bridge operator address
     * @param _newOperator The new operator address
     */
    function setOperator(address _newOperator) external onlyOwner {
        if (_newOperator == address(0)) revert ZeroAddress();

        address oldOperator = bridgeOperator;
        bridgeOperator = _newOperator;

        emit OperatorUpdated(oldOperator, _newOperator);
    }

    /**
     * @notice Updates allocation percentages
     * @dev All values in basis points (100 = 1%). Must sum to 10000 (100%)
     * @param _reserveBps Reserve allocation
     * @param _liquidityBps Liquidity allocation
     * @param _enterpriseBps Enterprise allocation
     * @param _stakingBps Staking allocation
     */
    function setAllocation(
        uint256 _reserveBps,
        uint256 _liquidityBps,
        uint256 _enterpriseBps,
        uint256 _stakingBps
    ) external onlyOwner {
        if (_reserveBps + _liquidityBps + _enterpriseBps + _stakingBps != BASIS_POINTS) {
            revert InvalidPercentages();
        }

        allocation = AllocationConfig({
            reserveBps: _reserveBps,
            liquidityBps: _liquidityBps,
            enterpriseBps: _enterpriseBps,
            stakingBps: _stakingBps
        });

        emit AllocationUpdated(_reserveBps, _liquidityBps, _enterpriseBps, _stakingBps);
    }

    /**
     * @notice Pauses all bridging operations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes bridging operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Gets settlement details by ID
     * @param _settlementId The settlement identifier
     * @return The revenue entry struct
     */
    function getSettlement(bytes32 _settlementId) external view returns (RevenueEntry memory) {
        return settlements[_settlementId];
    }

    /**
     * @notice Gets settlement ID for an invoice
     * @param _invoiceId The invoice ID string
     * @return The settlement ID (bytes32(0) if not found)
     */
    function getSettlementByInvoice(string calldata _invoiceId) external view returns (bytes32) {
        return invoiceToSettlement[keccak256(abi.encodePacked(_invoiceId))];
    }

    /**
     * @notice Checks if an invoice has been processed
     * @param _invoiceId The invoice ID to check
     * @return True if already processed
     */
    function isInvoiceProcessed(string calldata _invoiceId) external view returns (bool) {
        return invoiceToSettlement[keccak256(abi.encodePacked(_invoiceId))] != bytes32(0);
    }

    /**
     * @notice Calculates allocation amounts for a given total
     * @param _amount The total amount
     * @return reserveAmt Amount for reserve partition
     * @return liquidityAmt Amount for liquidity partition
     * @return enterpriseAmt Amount for enterprise partition
     * @return stakingAmt Amount for staking partition
     */
    function calculateAllocations(uint256 _amount) external view returns (
        uint256 reserveAmt,
        uint256 liquidityAmt,
        uint256 enterpriseAmt,
        uint256 stakingAmt
    ) {
        return _calculateAllocations(_amount);
    }

    /**
     * @notice Returns net revenue (bridged - reversed)
     * @return Net revenue amount
     */
    function netRevenue() external view returns (uint256) {
        return totalRevenueBridged - totalRevenueReversed;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @dev Generates a unique settlement ID
     */
    function _generateSettlementId(string calldata _invoiceId) internal returns (bytes32) {
        return keccak256(abi.encodePacked(
            _invoiceId,
            block.timestamp,
            block.chainid,
            ++_settlementNonce
        ));
    }

    /**
     * @dev Calculates allocation amounts with remainder handling
     * @notice Remainder goes to staking partition to prevent dust loss
     */
    function _calculateAllocations(uint256 _amount) internal view returns (
        uint256 reserveAmt,
        uint256 liquidityAmt,
        uint256 enterpriseAmt,
        uint256 stakingAmt
    ) {
        reserveAmt = (_amount * allocation.reserveBps) / BASIS_POINTS;
        liquidityAmt = (_amount * allocation.liquidityBps) / BASIS_POINTS;
        enterpriseAmt = (_amount * allocation.enterpriseBps) / BASIS_POINTS;

        // Staking gets remainder to prevent dust loss
        stakingAmt = _amount - reserveAmt - liquidityAmt - enterpriseAmt;
    }

    /**
     * @dev Issues tokens to all partitions
     */
    function _issueToPartitions(
        bytes32 _settlementId,
        address _recipient,
        uint256 _reserveAmt,
        uint256 _liquidityAmt,
        uint256 _enterpriseAmt,
        uint256 _stakingAmt
    ) internal {
        bytes32 reservePartition = nbptToken.PARTITION_RESERVE();
        bytes32 liquidityPartition = nbptToken.PARTITION_LIQUIDITY();
        bytes32 enterprisePartition = nbptToken.PARTITION_ENTERPRISE();
        bytes32 stakingPartition = nbptToken.PARTITION_STAKING();

        if (_reserveAmt > 0) {
            nbptToken.issueToPartition(reservePartition, _recipient, _reserveAmt);
            emit PartitionIssued(_settlementId, reservePartition, _recipient, _reserveAmt);
        }

        if (_liquidityAmt > 0) {
            nbptToken.issueToPartition(liquidityPartition, _recipient, _liquidityAmt);
            emit PartitionIssued(_settlementId, liquidityPartition, _recipient, _liquidityAmt);
        }

        if (_enterpriseAmt > 0) {
            nbptToken.issueToPartition(enterprisePartition, _recipient, _enterpriseAmt);
            emit PartitionIssued(_settlementId, enterprisePartition, _recipient, _enterpriseAmt);
        }

        if (_stakingAmt > 0) {
            nbptToken.issueToPartition(stakingPartition, _recipient, _stakingAmt);
            emit PartitionIssued(_settlementId, stakingPartition, _recipient, _stakingAmt);
        }
    }

    /**
     * @dev Burns tokens from all partitions (for reversals)
     */
    function _burnFromPartitions(
        address _account,
        uint256 _reserveAmt,
        uint256 _liquidityAmt,
        uint256 _enterpriseAmt,
        uint256 _stakingAmt
    ) internal {
        if (_reserveAmt > 0) {
            nbptToken.burnFromPartition(nbptToken.PARTITION_RESERVE(), _account, _reserveAmt);
        }
        if (_liquidityAmt > 0) {
            nbptToken.burnFromPartition(nbptToken.PARTITION_LIQUIDITY(), _account, _liquidityAmt);
        }
        if (_enterpriseAmt > 0) {
            nbptToken.burnFromPartition(nbptToken.PARTITION_ENTERPRISE(), _account, _enterpriseAmt);
        }
        if (_stakingAmt > 0) {
            nbptToken.burnFromPartition(nbptToken.PARTITION_STAKING(), _account, _stakingAmt);
        }
    }
}
