// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title FiatRouter - Stripe -> Mercury -> USDC Bridge
 * @notice On-chain component of the fiat-to-crypto bridge that tracks
 *         Stripe payment intents, Mercury bank transfers, and USDC minting.
 *
 * Features:
 *   - Payment intent registration from Stripe webhook
 *   - Mercury bank account tracking
 *   - USDC mint/release on confirmed fiat receipt
 *   - KYC-gated on-ramp
 *   - Off-ramp (USDC -> fiat) request tracking
 *   - Fee deduction and treasury routing
 *   - Transaction audit trail
 *   - Rate limiting and daily caps
 */
contract FiatRouter is AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    bytes32 public constant PROCESSOR_ROLE  = keccak256("PROCESSOR_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    Counters.Counter private _txIdCounter;

    // ─── Types ───────────────────────────────────────────────────────
    enum TxType { ON_RAMP, OFF_RAMP }
    enum TxStatus { PENDING, FIAT_CONFIRMED, CRYPTO_RELEASED, COMPLETED, FAILED, REFUNDED }
    enum FiatProvider { STRIPE, MERCURY, WIRE, ACH }

    struct FiatTransaction {
        uint256      id;
        TxType       txType;
        TxStatus     status;
        FiatProvider provider;
        address      user;
        uint256      fiatAmountCents;    // Amount in cents (USD)
        uint256      cryptoAmount;       // Amount in wei (USDC decimals)
        uint256      feeCents;
        uint256      exchangeRate;       // Rate * 1e8 precision
        string       stripePaymentId;    // Stripe payment_intent ID
        string       mercuryTxRef;       // Mercury transaction reference
        address      usdcTokenAddress;
        uint256      createdAt;
        uint256      confirmedAt;
        uint256      completedAt;
    }

    // ─── User Limits ─────────────────────────────────────────────────
    struct UserLimits {
        uint256 dailyLimitCents;
        uint256 dailyUsedCents;
        uint256 lastResetTimestamp;
        bool    kycApproved;
        uint256 lifetimeVolumeCents;
        uint256 transactionCount;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(uint256 => FiatTransaction) public transactions;
    mapping(address => UserLimits) public userLimits;
    mapping(address => uint256[]) public userTransactions;
    mapping(string => uint256) public stripeToTxId;    // stripe ID -> our tx ID
    mapping(string => uint256) public mercuryToTxId;   // mercury ref -> our tx ID

    // Global config
    uint256 public defaultDailyLimitCents = 1_000_000; // $10,000
    uint256 public globalDailyCapCents = 100_000_000;  // $1,000,000
    uint256 public todayVolumeCents;
    uint256 public lastGlobalReset;
    uint256 public onRampFeeBps = 100;    // 1%
    uint256 public offRampFeeBps = 150;   // 1.5%
    address public treasuryAddress;
    address public usdcAddress;

    // Metrics
    uint256 public totalOnRampVolume;
    uint256 public totalOffRampVolume;
    uint256 public totalFeesCollected;
    uint256 public totalTransactions;

    // ─── Events ──────────────────────────────────────────────────────
    event OnRampInitiated(uint256 indexed txId, address user, uint256 fiatAmountCents, string stripePaymentId);
    event OffRampInitiated(uint256 indexed txId, address user, uint256 cryptoAmount);
    event FiatConfirmed(uint256 indexed txId, string mercuryTxRef);
    event CryptoReleased(uint256 indexed txId, address user, uint256 amount);
    event TransactionCompleted(uint256 indexed txId);
    event TransactionFailed(uint256 indexed txId, string reason);
    event TransactionRefunded(uint256 indexed txId);
    event KYCApproved(address indexed user);
    event KYCRevoked(address indexed user);
    event DailyLimitUpdated(address indexed user, uint256 newLimitCents);
    event FeeUpdated(string feeType, uint256 newBps);

    // ─── Constructor ─────────────────────────────────────────────────
    constructor(address _admin, address _treasury, address _usdc) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PROCESSOR_ROLE, _admin);
        _grantRole(COMPLIANCE_ROLE, _admin);
        treasuryAddress = _treasury;
        usdcAddress = _usdc;
        lastGlobalReset = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  On-Ramp (Fiat -> Crypto)
    // ═══════════════════════════════════════════════════════════════════

    function initiateOnRamp(
        address _user,
        uint256 _fiatAmountCents,
        uint256 _exchangeRate,
        string calldata _stripePaymentId,
        FiatProvider _provider
    ) external onlyRole(PROCESSOR_ROLE) whenNotPaused returns (uint256) {
        _checkAndResetDailyLimits(_user);

        UserLimits storage limits = userLimits[_user];
        require(limits.kycApproved, "FiatRouter: KYC required");
        require(
            limits.dailyUsedCents + _fiatAmountCents <= limits.dailyLimitCents,
            "FiatRouter: daily limit exceeded"
        );
        require(
            todayVolumeCents + _fiatAmountCents <= globalDailyCapCents,
            "FiatRouter: global cap exceeded"
        );

        uint256 feeCents = (_fiatAmountCents * onRampFeeBps) / 10000;
        uint256 netAmountCents = _fiatAmountCents - feeCents;
        uint256 cryptoAmount = (netAmountCents * _exchangeRate) / 1e8;

        _txIdCounter.increment();
        uint256 txId = _txIdCounter.current();

        transactions[txId] = FiatTransaction({
            id: txId,
            txType: TxType.ON_RAMP,
            status: TxStatus.PENDING,
            provider: _provider,
            user: _user,
            fiatAmountCents: _fiatAmountCents,
            cryptoAmount: cryptoAmount,
            feeCents: feeCents,
            exchangeRate: _exchangeRate,
            stripePaymentId: _stripePaymentId,
            mercuryTxRef: "",
            usdcTokenAddress: usdcAddress,
            createdAt: block.timestamp,
            confirmedAt: 0,
            completedAt: 0
        });

        if (bytes(_stripePaymentId).length > 0) {
            stripeToTxId[_stripePaymentId] = txId;
        }

        limits.dailyUsedCents += _fiatAmountCents;
        todayVolumeCents += _fiatAmountCents;
        userTransactions[_user].push(txId);
        totalTransactions++;

        emit OnRampInitiated(txId, _user, _fiatAmountCents, _stripePaymentId);
        return txId;
    }

    function confirmFiatReceipt(uint256 _txId, string calldata _mercuryTxRef)
        external onlyRole(PROCESSOR_ROLE)
    {
        FiatTransaction storage tx_ = transactions[_txId];
        require(tx_.status == TxStatus.PENDING, "FiatRouter: not pending");

        tx_.status = TxStatus.FIAT_CONFIRMED;
        tx_.mercuryTxRef = _mercuryTxRef;
        tx_.confirmedAt = block.timestamp;

        if (bytes(_mercuryTxRef).length > 0) {
            mercuryToTxId[_mercuryTxRef] = _txId;
        }

        emit FiatConfirmed(_txId, _mercuryTxRef);
    }

    function releaseCrypto(uint256 _txId) external onlyRole(PROCESSOR_ROLE) nonReentrant {
        FiatTransaction storage tx_ = transactions[_txId];
        require(tx_.status == TxStatus.FIAT_CONFIRMED, "FiatRouter: fiat not confirmed");
        require(tx_.txType == TxType.ON_RAMP, "FiatRouter: not on-ramp");

        tx_.status = TxStatus.CRYPTO_RELEASED;
        totalOnRampVolume += tx_.fiatAmountCents;
        totalFeesCollected += tx_.feeCents;

        emit CryptoReleased(_txId, tx_.user, tx_.cryptoAmount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Off-Ramp (Crypto -> Fiat)
    // ═══════════════════════════════════════════════════════════════════

    function initiateOffRamp(
        address _user,
        uint256 _cryptoAmount,
        uint256 _exchangeRate
    ) external onlyRole(PROCESSOR_ROLE) whenNotPaused returns (uint256) {
        UserLimits storage limits = userLimits[_user];
        require(limits.kycApproved, "FiatRouter: KYC required");

        uint256 fiatAmountCents = (_cryptoAmount * 1e8) / _exchangeRate;
        uint256 feeCents = (fiatAmountCents * offRampFeeBps) / 10000;

        _txIdCounter.increment();
        uint256 txId = _txIdCounter.current();

        transactions[txId] = FiatTransaction({
            id: txId,
            txType: TxType.OFF_RAMP,
            status: TxStatus.PENDING,
            provider: FiatProvider.MERCURY,
            user: _user,
            fiatAmountCents: fiatAmountCents,
            cryptoAmount: _cryptoAmount,
            feeCents: feeCents,
            exchangeRate: _exchangeRate,
            stripePaymentId: "",
            mercuryTxRef: "",
            usdcTokenAddress: usdcAddress,
            createdAt: block.timestamp,
            confirmedAt: 0,
            completedAt: 0
        });

        userTransactions[_user].push(txId);
        totalTransactions++;

        emit OffRampInitiated(txId, _user, _cryptoAmount);
        return txId;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Transaction Management
    // ═══════════════════════════════════════════════════════════════════

    function completeTransaction(uint256 _txId) external onlyRole(PROCESSOR_ROLE) {
        FiatTransaction storage tx_ = transactions[_txId];
        require(
            tx_.status == TxStatus.CRYPTO_RELEASED || tx_.status == TxStatus.FIAT_CONFIRMED,
            "FiatRouter: invalid status"
        );

        tx_.status = TxStatus.COMPLETED;
        tx_.completedAt = block.timestamp;

        UserLimits storage limits = userLimits[tx_.user];
        limits.lifetimeVolumeCents += tx_.fiatAmountCents;
        limits.transactionCount++;

        if (tx_.txType == TxType.OFF_RAMP) {
            totalOffRampVolume += tx_.fiatAmountCents;
            totalFeesCollected += tx_.feeCents;
        }

        emit TransactionCompleted(_txId);
    }

    function failTransaction(uint256 _txId, string calldata _reason)
        external onlyRole(PROCESSOR_ROLE)
    {
        FiatTransaction storage tx_ = transactions[_txId];
        tx_.status = TxStatus.FAILED;
        emit TransactionFailed(_txId, _reason);
    }

    function refundTransaction(uint256 _txId) external onlyRole(PROCESSOR_ROLE) {
        FiatTransaction storage tx_ = transactions[_txId];
        require(
            tx_.status == TxStatus.PENDING || tx_.status == TxStatus.FAILED,
            "FiatRouter: cannot refund"
        );
        tx_.status = TxStatus.REFUNDED;
        emit TransactionRefunded(_txId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  KYC Management
    // ═══════════════════════════════════════════════════════════════════

    function approveKYC(address _user) external onlyRole(COMPLIANCE_ROLE) {
        userLimits[_user].kycApproved = true;
        if (userLimits[_user].dailyLimitCents == 0) {
            userLimits[_user].dailyLimitCents = defaultDailyLimitCents;
        }
        emit KYCApproved(_user);
    }

    function revokeKYC(address _user) external onlyRole(COMPLIANCE_ROLE) {
        userLimits[_user].kycApproved = false;
        emit KYCRevoked(_user);
    }

    function setUserDailyLimit(address _user, uint256 _limitCents)
        external onlyRole(COMPLIANCE_ROLE)
    {
        userLimits[_user].dailyLimitCents = _limitCents;
        emit DailyLimitUpdated(_user, _limitCents);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Config
    // ═══════════════════════════════════════════════════════════════════

    function setOnRampFee(uint256 _bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bps <= 500, "FiatRouter: max 5%");
        onRampFeeBps = _bps;
        emit FeeUpdated("onRamp", _bps);
    }

    function setOffRampFee(uint256 _bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bps <= 500, "FiatRouter: max 5%");
        offRampFeeBps = _bps;
        emit FeeUpdated("offRamp", _bps);
    }

    function setGlobalDailyCap(uint256 _capCents) external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalDailyCapCents = _capCents;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Internal
    // ═══════════════════════════════════════════════════════════════════

    function _checkAndResetDailyLimits(address _user) internal {
        UserLimits storage limits = userLimits[_user];
        if (block.timestamp >= limits.lastResetTimestamp + 1 days) {
            limits.dailyUsedCents = 0;
            limits.lastResetTimestamp = block.timestamp;
        }

        if (block.timestamp >= lastGlobalReset + 1 days) {
            todayVolumeCents = 0;
            lastGlobalReset = block.timestamp;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  View Helpers
    // ═══════════════════════════════════════════════════════════════════

    function getUserTransactions(address _user) external view returns (uint256[] memory) {
        return userTransactions[_user];
    }

    function getUserTransactionCount(address _user) external view returns (uint256) {
        return userTransactions[_user].length;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
