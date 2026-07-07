use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

// ─── Constants ────────────────────────────────────────────────────

pub const NOBLEPORT_TREASURY: &str = "0xc59e66BB2b6E19699F82A72a1569821cb1711504";
pub const NOBLEPORT_ENS: &str = "nobleport.eth";
pub const ETHEREUM_MAINNET_CHAIN_ID: u64 = 1;
pub const MIN_CONFIRMATION_DEPTH: u64 = 12;
pub const BASE_TOKEN_RATE_USD: f64 = 0.50;
pub const PRICE_LOCK_MAX_AGE_SECS: i64 = 300;
pub const STRIPE_TIMESTAMP_TOLERANCE_SECS: i64 = 300;

pub const TOKEN_PACKAGES: &[(&str, f64, i64)] = &[
    ("starter", 49.0, 100),
    ("professional", 149.0, 350),
    ("enterprise", 499.0, 1500),
    ("institutional", 2499.0, 10000),
];

pub const PAYMENT_METHOD_PRIORITY: &[PaymentMethod] = &[
    PaymentMethod::Stripe,
    PaymentMethod::PayPal,
    PaymentMethod::MetaMask,
    PaymentMethod::Uniswap,
];

pub const RESTRICTED_JURISDICTIONS: &[&str] = &["OFAC_SANCTIONED", "UNKNOWN"];

// ─── Enums ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Stripe,
    PayPal,
    MetaMask,
    Uniswap,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComplianceStatus {
    Unverified,
    KycPending,
    KycApproved,
    AccreditedInvestor,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapStatus {
    Quoted,
    AwaitingApproval,
    Approved,
    Executed,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenTxType {
    Credit,
    Debit,
}

// ─── Structs ──────────────────────────────────────────────────────

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceGate {
    pub user_id: String,
    pub status: ComplianceStatus,
    pub kyc_verified_at: Option<DateTime<Utc>>,
    pub accredited_verified_at: Option<DateTime<Utc>>,
    pub jurisdiction: Option<String>,
    pub restricted_transfer: bool,
}

impl ComplianceGate {
    pub fn unverified(user_id: &str) -> Self {
        Self {
            user_id: user_id.to_string(),
            status: ComplianceStatus::Unverified,
            kyc_verified_at: None,
            accredited_verified_at: None,
            jurisdiction: None,
            restricted_transfer: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    pub user_id: String,
    pub balance: i64,
    pub compliance: ComplianceGate,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenTransaction {
    pub id: Uuid,
    pub user_id: String,
    pub tx_type: TokenTxType,
    pub amount: i64,
    pub reason: String,
    pub payment_id: Option<Uuid>,
    pub balance_after: i64,
    pub created_at: DateTime<Utc>,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryConfig {
    pub expected_address: String,
    pub ens_name: String,
    pub resolved_address: Option<String>,
    pub allowlist: Vec<String>,
    pub last_resolved: Option<DateTime<Utc>>,
    pub pinned: bool,
}

impl TreasuryConfig {
    pub fn default_config() -> Self {
        Self {
            expected_address: NOBLEPORT_TREASURY.to_string(),
            ens_name: NOBLEPORT_ENS.to_string(),
            resolved_address: None,
            allowlist: vec![NOBLEPORT_TREASURY.to_lowercase()],
            last_resolved: None,
            pinned: true,
        }
    }

    pub fn verify_recipient(&self, address: &str) -> Result<(), PaymentError> {
        let lower = address.to_lowercase();
        let expected = self.expected_address.to_lowercase();
        if lower != expected {
            return Err(PaymentError::TreasuryMismatch {
                expected: self.expected_address.clone(),
                got: address.to_string(),
            });
        }
        if !self.allowlist.iter().any(|a| a.to_lowercase() == lower) {
            return Err(PaymentError::TreasuryMismatch {
                expected: format!("address in allowlist {:?}", self.allowlist),
                got: address.to_string(),
            });
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedTx {
    pub tx_hash: String,
    pub from_address: String,
    pub to_address: String,
    pub amount_wei: String,
    pub amount_eth: f64,
    pub amount_usd: f64,
    pub chain_id: u64,
    pub block_number: u64,
    pub confirmations: u64,
    pub price_usd_at_lock: f64,
    pub price_locked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: Uuid,
    pub prev_hash: String,
    pub hash: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

// ─── Audit Chain ──────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct AuditChain {
    entries: Vec<AuditEntry>,
    prev_hash: String,
}

impl AuditChain {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            prev_hash: "0".repeat(64),
        }
    }

    pub fn append(&mut self, event_type: &str, payload: serde_json::Value) -> AuditEntry {
        let id = Uuid::new_v4();
        let timestamp = Utc::now();
        let data = serde_json::json!({
            "id": id.to_string(),
            "prev_hash": &self.prev_hash,
            "event_type": event_type,
            "payload": &payload,
            "timestamp": timestamp.to_rfc3339(),
        });
        let hash = hex::encode(Sha256::digest(data.to_string().as_bytes()));

        let entry = AuditEntry {
            id,
            prev_hash: self.prev_hash.clone(),
            hash: hash.clone(),
            event_type: event_type.to_string(),
            payload,
            timestamp,
        };

        self.entries.push(entry.clone());
        self.prev_hash = hash;
        entry
    }

    pub fn verify(&self) -> bool {
        let mut prev = "0".repeat(64);
        for entry in &self.entries {
            if entry.prev_hash != prev {
                return false;
            }
            let data = serde_json::json!({
                "id": entry.id.to_string(),
                "prev_hash": &entry.prev_hash,
                "event_type": &entry.event_type,
                "payload": &entry.payload,
                "timestamp": entry.timestamp.to_rfc3339(),
            });
            let computed = hex::encode(Sha256::digest(data.to_string().as_bytes()));
            if computed != entry.hash {
                return false;
            }
            prev = entry.hash.clone();
        }
        true
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn latest_hash(&self) -> &str {
        &self.prev_hash
    }
}

// ─── Token Calculation ────────────────────────────────────────────

pub fn calculate_tokens(amount_usd: f64, package_name: Option<&str>) -> i64 {
    if let Some(name) = package_name {
        let lower = name.to_lowercase();
        for &(pkg_name, price, tokens) in TOKEN_PACKAGES {
            if pkg_name == lower && amount_usd >= price {
                return tokens;
            }
        }
    }
    (amount_usd / BASE_TOKEN_RATE_USD).floor() as i64
}

// ─── Errors ───────────────────────────────────────────────────────

#[derive(Debug, Clone, thiserror::Error, Serialize, Deserialize)]
pub enum PaymentError {
    #[error("Compliance verification required: {reason}")]
    ComplianceRequired { reason: String },

    #[error("KYC verification not completed")]
    KycNotVerified,

    #[error("Accredited investor status required for amounts over $10,000")]
    AccreditedInvestorRequired,

    #[error("Transfer restricted: {reason}")]
    TransferRestricted { reason: String },

    #[error("Invalid chain ID: expected {expected}, got {got}")]
    InvalidChainId { expected: u64, got: u64 },

    #[error("Insufficient confirmations: need {required}, have {got}")]
    InsufficientConfirmations { required: u64, got: u64 },

    #[error("Treasury address mismatch: expected {expected}, got {got}")]
    TreasuryMismatch { expected: String, got: String },

    #[error("Webhook signature verification failed")]
    WebhookSignatureInvalid,

    #[error("Human approval required for this operation")]
    HumanApprovalRequired,

    #[error("Price lock expired (max {max_age_secs}s)")]
    PriceLockExpired { max_age_secs: i64 },

    #[error("Replay detected: tx {tx_hash} already processed")]
    ReplayDetected { tx_hash: String },

    #[error("Provider error: {0}")]
    ProviderError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),
}

// ─── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_tokens_package() {
        assert_eq!(calculate_tokens(49.0, Some("starter")), 100);
        assert_eq!(calculate_tokens(149.0, Some("professional")), 350);
        assert_eq!(calculate_tokens(499.0, Some("enterprise")), 1500);
    }

    #[test]
    fn test_calculate_tokens_base_rate() {
        assert_eq!(calculate_tokens(100.0, None), 200);
        assert_eq!(calculate_tokens(25.0, None), 50);
    }

    #[test]
    fn test_audit_chain() {
        let mut chain = AuditChain::new();
        chain.append("test_event", serde_json::json!({"key": "value"}));
        chain.append("test_event_2", serde_json::json!({"key": "value2"}));
        assert_eq!(chain.len(), 2);
        assert!(chain.verify());
    }

    #[test]
    fn test_treasury_verify_recipient() {
        let cfg = TreasuryConfig::default_config();
        assert!(cfg.verify_recipient(NOBLEPORT_TREASURY).is_ok());
        assert!(cfg.verify_recipient("0xDEADBEEF").is_err());
    }

    #[test]
    fn test_compliance_gate_default() {
        let gate = ComplianceGate::unverified("user1");
        assert_eq!(gate.status, ComplianceStatus::Unverified);
        assert!(!gate.restricted_transfer);
    }
}
