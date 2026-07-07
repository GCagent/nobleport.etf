use std::collections::HashMap;

use chrono::Utc;
use common::{
    AuditChain, ComplianceGate, ComplianceStatus, PaymentError, TokenBalance, TokenTransaction,
    TokenTransactionType,
};
use tracing::{info, warn};
use uuid::Uuid;

use crate::compliance::ComplianceEngine;

// ---------------------------------------------------------------------------
// TokenLedger
// ---------------------------------------------------------------------------

/// In-memory token ledger that records balances and transactions.
///
/// Every mutation is gated by the [`ComplianceEngine`] and logged to the
/// shared [`AuditChain`].
pub struct TokenLedger {
    balances: HashMap<String, TokenBalance>,
    transactions: HashMap<String, Vec<TokenTransaction>>,
}

impl TokenLedger {
    /// Create a new, empty ledger.
    pub fn new() -> Self {
        Self {
            balances: HashMap::new(),
            transactions: HashMap::new(),
        }
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /// Return the token balance for a user.
    ///
    /// If no entry exists, returns a zero balance with
    /// [`ComplianceStatus::Unverified`].
    pub fn get_balance(&self, user_id: &str) -> TokenBalance {
        self.balances
            .get(user_id)
            .cloned()
            .unwrap_or_else(|| TokenBalance {
                user_id: user_id.to_string(),
                balance: 0,
                compliance: ComplianceGate {
                    user_id: user_id.to_string(),
                    status: ComplianceStatus::Unverified,
                    kyc_verified_at: None,
                    accredited_verified_at: None,
                    jurisdiction: None,
                    restricted_transfer: false,
                },
                last_updated: Utc::now(),
            })
    }

    /// Return the transaction history for a user (empty vec if none).
    pub fn get_transactions(&self, user_id: &str) -> Vec<TokenTransaction> {
        self.transactions.get(user_id).cloned().unwrap_or_default()
    }

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    /// Credit tokens to a user after passing all compliance checks.
    ///
    /// The `amount_usd` is used for the accredited-investor threshold check.
    /// The actual number of tokens credited is `amount` (pre-calculated by the
    /// caller using [`common::calculate_tokens`]).
    ///
    /// Returns the recorded [`TokenTransaction`] on success, or a
    /// [`PaymentError`] describing why the credit was blocked.
    pub fn credit(
        &mut self,
        user_id: &str,
        amount: i64,
        amount_usd: f64,
        reason: &str,
        payment_id: Option<Uuid>,
        compliance: &ComplianceEngine,
        audit_chain: &mut AuditChain,
    ) -> Result<TokenTransaction, PaymentError> {
        // --- Compliance gate ---
        compliance.check_can_receive(user_id, amount_usd)?;

        let now = Utc::now();
        let gate = compliance.get_gate(user_id);

        // Update balance.
        let balance_entry = self
            .balances
            .entry(user_id.to_string())
            .or_insert_with(|| TokenBalance {
                user_id: user_id.to_string(),
                balance: 0,
                compliance: gate.clone(),
                last_updated: now,
            });

        balance_entry.balance += amount;
        balance_entry.compliance = gate;
        balance_entry.last_updated = now;

        let balance_after = balance_entry.balance;

        // Record transaction.
        let tx = TokenTransaction {
            tx_type: TokenTransactionType::Credit,
            amount,
            reason: reason.to_string(),
            payment_id,
            balance_after,
            created_at: now,
        };

        self.transactions
            .entry(user_id.to_string())
            .or_default()
            .push(tx.clone());

        // Audit.
        audit_chain.append(
            "token_credit",
            serde_json::json!({
                "user_id": user_id,
                "amount": amount,
                "amount_usd": amount_usd,
                "reason": reason,
                "payment_id": payment_id,
                "balance_after": balance_after,
                "timestamp": now.to_rfc3339(),
            }),
        );

        info!(
            user_id = %user_id,
            amount = %amount,
            balance_after = %balance_after,
            "Tokens credited"
        );

        Ok(tx)
    }

    /// Debit tokens from a user's balance.
    ///
    /// Returns [`PaymentError::ProviderError`] if the user has insufficient
    /// balance.
    pub fn debit(
        &mut self,
        user_id: &str,
        amount: i64,
        reason: &str,
        audit_chain: &mut AuditChain,
    ) -> Result<TokenTransaction, PaymentError> {
        let now = Utc::now();

        let balance_entry = self.balances.get_mut(user_id).ok_or_else(|| {
            warn!(user_id = %user_id, "Debit failed: no balance record found");
            PaymentError::ProviderError(format!(
                "No balance record for user {user_id}. Cannot debit tokens."
            ))
        })?;

        if balance_entry.balance < amount {
            warn!(
                user_id = %user_id,
                requested = %amount,
                available = %balance_entry.balance,
                "Debit failed: insufficient balance"
            );
            return Err(PaymentError::ProviderError(format!(
                "Insufficient balance: requested {} tokens but only {} available",
                amount, balance_entry.balance
            )));
        }

        balance_entry.balance -= amount;
        balance_entry.last_updated = now;

        let balance_after = balance_entry.balance;

        let tx = TokenTransaction {
            tx_type: TokenTransactionType::Debit,
            amount,
            reason: reason.to_string(),
            payment_id: None,
            balance_after,
            created_at: now,
        };

        self.transactions
            .entry(user_id.to_string())
            .or_default()
            .push(tx.clone());

        audit_chain.append(
            "token_debit",
            serde_json::json!({
                "user_id": user_id,
                "amount": amount,
                "reason": reason,
                "balance_after": balance_after,
                "timestamp": now.to_rfc3339(),
            }),
        );

        info!(
            user_id = %user_id,
            amount = %amount,
            balance_after = %balance_after,
            "Tokens debited"
        );

        Ok(tx)
    }
}

impl Default for TokenLedger {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create a ledger + compliance engine with a KYC-approved user.
    fn setup_approved_user(user_id: &str) -> (TokenLedger, ComplianceEngine, AuditChain) {
        let ledger = TokenLedger::new();
        let mut compliance = ComplianceEngine::new();
        let mut audit = AuditChain::new();
        compliance.update_status(
            user_id,
            ComplianceStatus::KycApproved,
            Some("US".to_string()),
            &mut audit,
        );
        (ledger, compliance, audit)
    }

    #[test]
    fn credit_approved_user() {
        let (mut ledger, compliance, mut audit) = setup_approved_user("user-1");

        let tx = ledger
            .credit("user-1", 100, 50.0, "purchase", None, &compliance, &mut audit)
            .expect("credit should succeed");

        assert_eq!(tx.amount, 100);
        assert_eq!(tx.balance_after, 100);
        assert_eq!(ledger.get_balance("user-1").balance, 100);
    }

    #[test]
    fn credit_unverified_user_fails() {
        let mut ledger = TokenLedger::new();
        let compliance = ComplianceEngine::new();
        let mut audit = AuditChain::new();

        let result = ledger.credit("user-1", 100, 50.0, "purchase", None, &compliance, &mut audit);
        assert!(matches!(result, Err(PaymentError::ComplianceRequired)));
        assert_eq!(ledger.get_balance("user-1").balance, 0);
    }

    #[test]
    fn debit_sufficient_balance() {
        let (mut ledger, compliance, mut audit) = setup_approved_user("user-1");

        ledger
            .credit("user-1", 200, 100.0, "purchase", None, &compliance, &mut audit)
            .unwrap();

        let tx = ledger.debit("user-1", 50, "usage", &mut audit).unwrap();
        assert_eq!(tx.amount, 50);
        assert_eq!(tx.balance_after, 150);
    }

    #[test]
    fn debit_insufficient_balance_fails() {
        let (mut ledger, compliance, mut audit) = setup_approved_user("user-1");

        ledger
            .credit("user-1", 10, 5.0, "purchase", None, &compliance, &mut audit)
            .unwrap();

        let result = ledger.debit("user-1", 50, "usage", &mut audit);
        assert!(result.is_err());
    }

    #[test]
    fn transaction_history_records_all_events() {
        let (mut ledger, compliance, mut audit) = setup_approved_user("user-1");

        ledger
            .credit("user-1", 100, 50.0, "purchase", None, &compliance, &mut audit)
            .unwrap();
        ledger.debit("user-1", 30, "usage", &mut audit).unwrap();

        let txs = ledger.get_transactions("user-1");
        assert_eq!(txs.len(), 2);
        assert_eq!(txs[0].tx_type, TokenTransactionType::Credit);
        assert_eq!(txs[1].tx_type, TokenTransactionType::Debit);
    }

    #[test]
    fn get_balance_returns_zero_for_unknown_user() {
        let ledger = TokenLedger::new();
        let balance = ledger.get_balance("unknown");
        assert_eq!(balance.balance, 0);
        assert_eq!(balance.compliance.status, ComplianceStatus::Unverified);
    }
}
