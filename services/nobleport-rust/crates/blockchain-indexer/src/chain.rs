use std::collections::HashSet;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

use common::{
    PaymentError, ETHEREUM_MAINNET_CHAIN_ID, MIN_CONFIRMATION_DEPTH, NOBLEPORT_TREASURY,
};

use crate::price::PriceOracle;

// ---------------------------------------------------------------------------
// VerifiedTransaction
// ---------------------------------------------------------------------------

/// The result of a successful on-chain transaction verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedTransaction {
    pub tx_hash: String,
    pub from_address: String,
    pub to_address: String,
    /// Wei value as a decimal string (too large for u64/i64).
    pub amount_wei: String,
    /// Ether value (wei / 1e18).
    pub amount_eth: f64,
    /// USD value at the locked price.
    pub amount_usd: f64,
    pub chain_id: u64,
    pub block_number: u64,
    pub confirmations: u64,
    /// ETH/USD price used for the conversion.
    pub price_usd_at_lock: f64,
    /// UNIX timestamp (seconds) when the price was locked.
    pub price_locked_at: i64,
    /// UNIX timestamp (seconds) when the verification completed.
    pub verified_at: i64,
}

// ---------------------------------------------------------------------------
// ChainVerifier
// ---------------------------------------------------------------------------

/// Verifies Ethereum mainnet transactions against the NoblePort treasury with
/// chain-ID enforcement, confirmation-depth checks, replay protection, and
/// USD price-timestamp locking.
pub struct ChainVerifier {
    rpc_url: String,
    treasury_address: String,
    required_chain_id: u64,
    min_confirmations: u64,
    /// Set of transaction hashes that have already been processed.
    processed_txs: HashSet<String>,
    /// In-process price oracle (shared lifetime with the verifier).
    price_oracle: PriceOracle,
}

impl ChainVerifier {
    /// Create a new verifier with the standard NoblePort configuration.
    pub fn new(rpc_url: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            treasury_address: NOBLEPORT_TREASURY.to_string(),
            required_chain_id: ETHEREUM_MAINNET_CHAIN_ID,
            min_confirmations: MIN_CONFIRMATION_DEPTH,
            processed_txs: HashSet::new(),
            price_oracle: PriceOracle::new(),
        }
    }

    /// Return a reference to the inner [`PriceOracle`].
    pub fn price_oracle_mut(&mut self) -> &mut PriceOracle {
        &mut self.price_oracle
    }

    /// Check whether a transaction hash has already been processed.
    pub fn is_processed(&self, tx_hash: &str) -> bool {
        self.processed_txs.contains(&tx_hash.to_lowercase())
    }

    /// Look up a previously verified transaction by hash.  Returns `None` if
    /// the hash has never been processed (the in-memory store only remembers
    /// *that* a hash was seen, not its full record — extend as needed).
    pub fn lookup(&self, tx_hash: &str) -> Option<bool> {
        if self.processed_txs.contains(&tx_hash.to_lowercase()) {
            Some(true)
        } else {
            None
        }
    }

    /// Verify an on-chain transaction against all NoblePort safety rules.
    ///
    /// # Errors
    ///
    /// Returns a [`PaymentError`] variant for each failed check:
    ///
    /// | Check                     | Error                               |
    /// |---------------------------|-------------------------------------|
    /// | Duplicate tx hash         | `PaymentError::ReplayDetected`      |
    /// | Wrong chain ID            | `PaymentError::InvalidChainId`      |
    /// | Wrong recipient           | `PaymentError::TreasuryMismatch`    |
    /// | Receipt status != 0x1     | `PaymentError::ProviderError`       |
    /// | Insufficient depth        | `PaymentError::InsufficientConfirmations` |
    /// | Price lock expired        | `PaymentError::PriceLockExpired`    |
    pub async fn verify_transaction(
        &mut self,
        tx_hash: &str,
    ) -> Result<VerifiedTransaction, PaymentError> {
        let tx_hash_lower = tx_hash.to_lowercase();

        // ── 1. Replay protection ──────────────────────────────────────────
        if self.processed_txs.contains(&tx_hash_lower) {
            return Err(PaymentError::ReplayDetected);
        }

        // ── 2. Fetch transaction by hash ──────────────────────────────────
        let tx = self.eth_get_transaction_by_hash(&tx_hash_lower).await?;

        // ── 3. Chain ID enforcement ───────────────────────────────────────
        let chain_id = parse_hex_u64(
            tx.get("chainId")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0"),
        );
        if chain_id != self.required_chain_id {
            return Err(PaymentError::InvalidChainId);
        }

        // ── 4. Treasury recipient verification (case-insensitive) ─────────
        let to_address = tx
            .get("to")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if !to_address
            .eq_ignore_ascii_case(&self.treasury_address)
        {
            return Err(PaymentError::TreasuryMismatch);
        }

        // ── 5. Receipt status ─────────────────────────────────────────────
        let receipt = self.eth_get_transaction_receipt(&tx_hash_lower).await?;
        let status = receipt
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0");
        if status != "0x1" {
            return Err(PaymentError::ProviderError(
                "transaction receipt status is not 0x1 (success)".into(),
            ));
        }

        // ── 6. Confirmation depth ─────────────────────────────────────────
        let tx_block = parse_hex_u64(
            tx.get("blockNumber")
                .and_then(|v| v.as_str())
                .unwrap_or("0x0"),
        );
        let current_block = self.eth_block_number().await?;
        let confirmations = current_block.saturating_sub(tx_block);
        if confirmations < self.min_confirmations {
            return Err(PaymentError::InsufficientConfirmations);
        }

        // ── 7. ETH/USD price with timestamp lock ──────────────────────────
        let (price_usd, price_locked_at) = self.price_oracle.get_eth_usd().await?;
        if !self.price_oracle.is_price_valid(price_locked_at) {
            return Err(PaymentError::PriceLockExpired);
        }

        // ── 8. Compute amounts ────────────────────────────────────────────
        let value_hex = tx
            .get("value")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0");
        let amount_wei = parse_hex_u128(value_hex);
        let amount_eth = amount_wei as f64 / 1e18;
        let amount_usd = amount_eth * price_usd;

        let from_address = tx
            .get("from")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // ── 9. Mark as processed (replay protection) ──────────────────────
        self.processed_txs.insert(tx_hash_lower.clone());

        // ── 10. Build result ──────────────────────────────────────────────
        Ok(VerifiedTransaction {
            tx_hash: tx_hash_lower,
            from_address,
            to_address,
            amount_wei: amount_wei.to_string(),
            amount_eth,
            amount_usd,
            chain_id,
            block_number: tx_block,
            confirmations,
            price_usd_at_lock: price_usd,
            price_locked_at,
            verified_at: Utc::now().timestamp(),
        })
    }

    // ── JSON-RPC helpers ──────────────────────────────────────────────────

    async fn rpc_call(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, PaymentError> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&self.rpc_url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("RPC request failed: {e}")))?;

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("RPC parse error: {e}")))?;

        if let Some(err) = body.get("error") {
            return Err(PaymentError::ProviderError(format!("RPC error: {err}")));
        }

        Ok(body)
    }

    async fn eth_get_transaction_by_hash(
        &self,
        tx_hash: &str,
    ) -> Result<serde_json::Value, PaymentError> {
        let body = self
            .rpc_call("eth_getTransactionByHash", json!([tx_hash]))
            .await?;

        body.get("result")
            .cloned()
            .and_then(|v| if v.is_null() { None } else { Some(v) })
            .ok_or_else(|| {
                PaymentError::ProviderError(format!("transaction {tx_hash} not found"))
            })
    }

    async fn eth_get_transaction_receipt(
        &self,
        tx_hash: &str,
    ) -> Result<serde_json::Value, PaymentError> {
        let body = self
            .rpc_call("eth_getTransactionReceipt", json!([tx_hash]))
            .await?;

        body.get("result")
            .cloned()
            .and_then(|v| if v.is_null() { None } else { Some(v) })
            .ok_or_else(|| {
                PaymentError::ProviderError(format!(
                    "transaction receipt for {tx_hash} not found"
                ))
            })
    }

    async fn eth_block_number(&self) -> Result<u64, PaymentError> {
        let body = self.rpc_call("eth_blockNumber", json!([])).await?;

        let hex = body
            .get("result")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                PaymentError::ProviderError("missing result in eth_blockNumber".into())
            })?;

        Ok(parse_hex_u64(hex))
    }
}

// ---------------------------------------------------------------------------
// Hex parsing helpers
// ---------------------------------------------------------------------------

/// Parse a `0x`-prefixed hex string into a `u64`.
fn parse_hex_u64(hex: &str) -> u64 {
    let s = hex.trim_start_matches("0x");
    u64::from_str_radix(s, 16).unwrap_or(0)
}

/// Parse a `0x`-prefixed hex string into a `u128` (needed for wei values that
/// can exceed `u64::MAX`).
fn parse_hex_u128(hex: &str) -> u128 {
    let s = hex.trim_start_matches("0x");
    u128::from_str_radix(s, 16).unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_hex_u64_basic() {
        assert_eq!(parse_hex_u64("0x1"), 1);
        assert_eq!(parse_hex_u64("0xa"), 10);
        assert_eq!(parse_hex_u64("0xff"), 255);
        assert_eq!(parse_hex_u64("0x0"), 0);
    }

    #[test]
    fn parse_hex_u128_large() {
        // 1 ETH in wei = 1_000_000_000_000_000_000 = 0xDE0B6B3A7640000
        assert_eq!(
            parse_hex_u128("0xDE0B6B3A7640000"),
            1_000_000_000_000_000_000
        );
    }

    #[test]
    fn chain_verifier_new_defaults() {
        let v = ChainVerifier::new("http://localhost:8545");
        assert_eq!(v.required_chain_id, 1);
        assert_eq!(v.min_confirmations, 12);
        assert_eq!(v.treasury_address, NOBLEPORT_TREASURY);
        assert!(v.processed_txs.is_empty());
    }

    #[test]
    fn replay_detection_via_lookup() {
        let mut v = ChainVerifier::new("http://localhost:8545");
        let hash = "0xabc123";
        assert!(v.lookup(hash).is_none());
        v.processed_txs.insert(hash.to_lowercase());
        assert_eq!(v.lookup(hash), Some(true));
    }

    #[test]
    fn is_processed_is_case_insensitive() {
        let mut v = ChainVerifier::new("http://localhost:8545");
        v.processed_txs.insert("0xabcdef".to_string());
        assert!(v.is_processed("0xABCDEF"));
        assert!(v.is_processed("0xabcdef"));
    }
}
