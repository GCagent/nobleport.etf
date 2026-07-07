use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// The NoblePort treasury Ethereum address.
pub const NOBLEPORT_TREASURY: &str = "0xc59e66BB2b6E19699F82A72a1569821cb1711504";

/// The NoblePort ENS name.
pub const NOBLEPORT_ENS: &str = "nobleport.eth";

/// Ethereum mainnet chain ID.
pub const ETHEREUM_MAINNET_CHAIN_ID: u64 = 1;

/// Minimum confirmation depth required before a transaction is considered final.
pub const MIN_CONFIRMATION_DEPTH: u64 = 12;

/// Maximum age (in seconds) for an ETH/USD price lock before it is rejected.
pub const PRICE_LOCK_MAX_AGE_SECS: i64 = 300;

/// Maximum timestamp drift (in seconds) tolerated for Stripe webhook signatures.
pub const STRIPE_TIMESTAMP_TOLERANCE_SECS: i64 = 300;

/// Base token rate in USD (price per token when no package discount applies).
pub const BASE_TOKEN_RATE_USD: f64 = 0.50;

/// Available token packages: (name, price_usd, tokens).
pub const TOKEN_PACKAGES: &[(&str, f64, i64)] = &[
    ("starter", 50.0, 110),
    ("growth", 200.0, 500),
    ("professional", 500.0, 1_400),
    ("enterprise", 2_000.0, 6_000),
];

/// Priority order for payment method selection.
pub const PAYMENT_METHOD_PRIORITY: &[PaymentMethod] = &[
    PaymentMethod::Stripe,
    PaymentMethod::PayPal,
    PaymentMethod::MetaMask,
    PaymentMethod::Uniswap,
];

// ---------------------------------------------------------------------------
// Payment types
// ---------------------------------------------------------------------------

/// Supported payment methods.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Stripe,
    PayPal,
    MetaMask,
    Uniswap,
}

/// Lifecycle status of a payment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentStatus {
    Pending,
    Processing,
    AwaitingCompliance,
    Approved,
    Completed,
    Failed,
    Refunded,
}

/// A single payment record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentRecord {
    pub id: Uuid,
    pub user_id: String,
    pub method: PaymentMethod,
    pub amount_usd: f64,
    pub tokens_credited: i64,
    pub status: PaymentStatus,
    pub external_id: Option<String>,
    pub tx_hash: Option<String>,
    pub chain_id: Option<u64>,
    pub confirmation_depth: Option<u64>,
    pub price_locked_at: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A payment confirmation returned after a successful payment.
/// This is a type alias for [`PaymentRecord`] for API clarity.
pub type PaymentConfirmation = PaymentRecord;

// ---------------------------------------------------------------------------
// Verified on-chain transaction
// ---------------------------------------------------------------------------

/// A verified on-chain (MetaMask) transaction with all security checks passed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedTx {
    pub tx_hash: String,
    pub amount_wei: String,
    pub amount_usd: f64,
    pub recipient: String,
    pub chain_id: u64,
    pub block_number: u64,
    pub confirmations: u64,
    pub price_usd_at_lock: f64,
    pub price_locked_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Compliance types
// ---------------------------------------------------------------------------

/// KYC / accreditation status for a user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComplianceStatus {
    Unverified,
    KycPending,
    KycApproved,
    AccreditedInvestor,
    Rejected,
}

/// Gate that must be satisfied before tokens can be issued or transferred.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceGate {
    pub user_id: String,
    pub status: ComplianceStatus,
    pub kyc_verified_at: Option<DateTime<Utc>>,
    pub accredited_verified_at: Option<DateTime<Utc>>,
    pub jurisdiction: Option<String>,
    pub restricted_transfer: bool,
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

/// A user's token balance together with their compliance information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    pub user_id: String,
    pub balance: i64,
    pub compliance: ComplianceGate,
    pub last_updated: DateTime<Utc>,
}

/// Direction of a token transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenTransactionType {
    Credit,
    Debit,
}

/// A single token ledger entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenTransaction {
    pub tx_type: TokenTransactionType,
    pub amount: i64,
    pub reason: String,
    pub payment_id: Option<Uuid>,
    pub balance_after: i64,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Swap types
// ---------------------------------------------------------------------------

/// Status of a Uniswap swap intent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapStatus {
    Quoted,
    AwaitingApproval,
    Approved,
    Executed,
    Rejected,
}

/// A Uniswap swap intent that may require human approval.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapIntent {
    pub intent_id: Uuid,
    pub user_id: String,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: f64,
    pub estimated_out: f64,
    pub slippage_bps: u32,
    pub status: SwapStatus,
    pub approved_by: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Treasury types
// ---------------------------------------------------------------------------

/// Configuration for the on-chain treasury.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryConfig {
    pub expected_address: String,
    pub ens_name: String,
    pub resolved_address: Option<String>,
    pub allowlist: Vec<String>,
    pub last_resolved: Option<DateTime<Utc>>,
    pub pinned: bool,
}

// ---------------------------------------------------------------------------
// Audit types
// ---------------------------------------------------------------------------

/// A single entry in the hash-chain audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: Uuid,
    pub prev_hash: String,
    pub hash: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

/// An append-only, SHA-256 hash-chain audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditChain {
    entries: Vec<AuditEntry>,
    prev_hash: String,
}

impl AuditChain {
    /// Create a new, empty audit chain.
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            prev_hash: String::from("genesis"),
        }
    }

    /// Append an event and return the newly created entry.
    pub fn append(&mut self, event_type: &str, payload: serde_json::Value) -> AuditEntry {
        let id = Uuid::new_v4();
        let timestamp = Utc::now();

        let mut hasher = Sha256::new();
        hasher.update(self.prev_hash.as_bytes());
        hasher.update(id.as_bytes());
        hasher.update(event_type.as_bytes());
        hasher.update(payload.to_string().as_bytes());
        hasher.update(timestamp.to_rfc3339().as_bytes());
        let hash = hex::encode(hasher.finalize());

        let entry = AuditEntry {
            id,
            prev_hash: self.prev_hash.clone(),
            hash: hash.clone(),
            event_type: event_type.to_string(),
            payload,
            timestamp,
        };

        self.prev_hash = hash;
        self.entries.push(entry.clone());
        entry
    }

    /// Verify the integrity of the entire chain. Returns `true` when every
    /// entry's hash matches the recomputed value and links correctly to the
    /// previous entry.
    pub fn verify(&self) -> bool {
        let mut expected_prev = String::from("genesis");

        for entry in &self.entries {
            if entry.prev_hash != expected_prev {
                return false;
            }

            let mut hasher = Sha256::new();
            hasher.update(entry.prev_hash.as_bytes());
            hasher.update(entry.id.as_bytes());
            hasher.update(entry.event_type.as_bytes());
            hasher.update(entry.payload.to_string().as_bytes());
            hasher.update(entry.timestamp.to_rfc3339().as_bytes());
            let computed = hex::encode(hasher.finalize());

            if computed != entry.hash {
                return false;
            }

            expected_prev = entry.hash.clone();
        }

        true
    }

    /// Return a slice of all entries.
    pub fn entries(&self) -> &[AuditEntry] {
        &self.entries
    }
}

impl Default for AuditChain {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Token calculation
// ---------------------------------------------------------------------------

/// Calculate the number of tokens for a given USD amount.
///
/// If `package_name` matches one of the predefined [`TOKEN_PACKAGES`], the
/// package rate is used (which may include a volume bonus). Otherwise the
/// [`BASE_TOKEN_RATE_USD`] per-token price applies.
pub fn calculate_tokens(amount_usd: f64, package_name: Option<&str>) -> i64 {
    if let Some(name) = package_name {
        let lower = name.to_lowercase();
        for &(pkg_name, price, tokens) in TOKEN_PACKAGES {
            if pkg_name == lower && (amount_usd - price).abs() < f64::EPSILON {
                return tokens;
            }
        }
    }

    // Fall back to base rate.
    (amount_usd / BASE_TOKEN_RATE_USD).floor() as i64
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/// Unified error type for the NoblePort payment system.
#[derive(Debug, Clone, Error)]
pub enum PaymentError {
    #[error("compliance verification is required before this operation")]
    ComplianceRequired,

    #[error("KYC has not been verified for this user")]
    KycNotVerified,

    #[error("accredited investor verification is required")]
    AccreditedInvestorRequired,

    #[error("token transfer is restricted for this user")]
    TransferRestricted,

    #[error("invalid chain id")]
    InvalidChainId,

    #[error("insufficient on-chain confirmations")]
    InsufficientConfirmations,

    #[error("treasury address mismatch")]
    TreasuryMismatch,

    #[error("webhook signature is invalid")]
    WebhookSignatureInvalid,

    #[error("human approval is required for this operation")]
    HumanApprovalRequired,

    #[error("price lock has expired")]
    PriceLockExpired,

    #[error("replay attack detected")]
    ReplayDetected,

    #[error("provider error: {0}")]
    ProviderError(String),

    #[error("database error: {0}")]
    DatabaseError(String),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn treasury_address_is_correct() {
        assert_eq!(
            NOBLEPORT_TREASURY,
            "0xc59e66BB2b6E19699F82A72a1569821cb1711504"
        );
    }

    #[test]
    fn calculate_tokens_with_package() {
        assert_eq!(calculate_tokens(50.0, Some("starter")), 110);
        assert_eq!(calculate_tokens(200.0, Some("growth")), 500);
        assert_eq!(calculate_tokens(500.0, Some("professional")), 1_400);
        assert_eq!(calculate_tokens(2_000.0, Some("enterprise")), 6_000);
    }

    #[test]
    fn calculate_tokens_base_rate() {
        assert_eq!(calculate_tokens(100.0, None), 200);
        assert_eq!(calculate_tokens(1.0, None), 2);
    }

    #[test]
    fn calculate_tokens_case_insensitive_package() {
        assert_eq!(calculate_tokens(50.0, Some("Starter")), 110);
    }

    #[test]
    fn audit_chain_append_and_verify() {
        let mut chain = AuditChain::new();
        chain.append("payment_created", serde_json::json!({"id": 1}));
        chain.append("payment_completed", serde_json::json!({"id": 1}));

        assert_eq!(chain.entries().len(), 2);
        assert!(chain.verify());
    }

    #[test]
    fn audit_chain_detects_tampering() {
        let mut chain = AuditChain::new();
        chain.append("event_a", serde_json::json!({}));
        chain.append("event_b", serde_json::json!({}));

        // Tamper with the first entry's hash.
        chain.entries[0].hash = "tampered".to_string();
        assert!(!chain.verify());
    }

    #[test]
    fn payment_method_priority_order() {
        assert_eq!(PAYMENT_METHOD_PRIORITY[0], PaymentMethod::Stripe);
        assert_eq!(PAYMENT_METHOD_PRIORITY[3], PaymentMethod::Uniswap);
    }

    #[test]
    fn serde_roundtrip_payment_method() {
        let json = serde_json::to_string(&PaymentMethod::MetaMask).unwrap();
        assert_eq!(json, r#""meta_mask""#);
        let back: PaymentMethod = serde_json::from_str(&json).unwrap();
        assert_eq!(back, PaymentMethod::MetaMask);
    }

    #[test]
    fn serde_roundtrip_payment_status() {
        let json = serde_json::to_string(&PaymentStatus::AwaitingCompliance).unwrap();
        assert_eq!(json, r#""awaiting_compliance""#);
        let back: PaymentStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(back, PaymentStatus::AwaitingCompliance);
    }
}
