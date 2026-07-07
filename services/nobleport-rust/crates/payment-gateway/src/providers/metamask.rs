use chrono::{DateTime, Utc};
use common::{
    PaymentError, TreasuryConfig, VerifiedTx, ETHEREUM_MAINNET_CHAIN_ID,
    MIN_CONFIRMATION_DEPTH, PRICE_LOCK_MAX_AGE_SECS,
};
use std::collections::HashSet;
use std::sync::Mutex;
use tracing::{error, info, warn};

use crate::audit::log_payment_event;
use crate::AppState;

/// MetaMask / on-chain Ethereum payment provider.
pub struct MetaMaskProvider {
    pub rpc_url: String,
    pub treasury_config: TreasuryConfig,
    /// Set of already-processed transaction hashes for replay protection.
    seen_tx_hashes: Mutex<HashSet<String>>,
}

impl MetaMaskProvider {
    pub fn from_env(treasury_config: TreasuryConfig) -> Option<Self> {
        let rpc_url = std::env::var("ETH_RPC_URL").ok()?;
        if rpc_url.is_empty() {
            return None;
        }
        Some(Self {
            rpc_url,
            treasury_config,
            seen_tx_hashes: Mutex::new(HashSet::new()),
        })
    }

    /// Returns true if the provider has all required configuration.
    pub fn is_configured(&self) -> bool {
        !self.rpc_url.is_empty()
    }

    /// Verify an on-chain transaction, enforcing all security checks:
    ///
    /// 1. Chain ID must be Ethereum mainnet (1)
    /// 2. Recipient must match the treasury address (case-insensitive)
    /// 3. At least `MIN_CONFIRMATION_DEPTH` confirmations
    /// 4. No replay (tx hash not already processed)
    /// 5. ETH/USD price must be locked within the last `PRICE_LOCK_MAX_AGE_SECS`
    pub async fn verify_transaction(
        &self,
        tx_hash: &str,
        expected_chain_id: u64,
        min_confirmations: u64,
        state: &AppState,
    ) -> Result<VerifiedTx, PaymentError> {
        info!(tx_hash = %tx_hash, "verifying on-chain transaction");

        // --- Replay protection ---
        {
            let mut seen = self.seen_tx_hashes.lock().expect("seen_tx lock poisoned");
            if seen.contains(tx_hash) {
                warn!(tx_hash = %tx_hash, "duplicate transaction detected");
                return Err(PaymentError::ReplayDetected);
            }
            // Tentatively insert; we'll remove if verification fails.
            seen.insert(tx_hash.to_string());
        }

        let result = self
            .verify_transaction_inner(tx_hash, expected_chain_id, min_confirmations, state)
            .await;

        if result.is_err() {
            // Roll back tentative insert on failure so the tx can be retried
            // (e.g. if it simply hasn't confirmed yet).
            let mut seen = self.seen_tx_hashes.lock().expect("seen_tx lock poisoned");
            seen.remove(tx_hash);
        }

        result
    }

    async fn verify_transaction_inner(
        &self,
        tx_hash: &str,
        expected_chain_id: u64,
        min_confirmations: u64,
        state: &AppState,
    ) -> Result<VerifiedTx, PaymentError> {
        // --- Chain ID enforcement ---
        let chain_id = self.get_chain_id().await?;
        if chain_id != ETHEREUM_MAINNET_CHAIN_ID {
            error!(
                expected = ETHEREUM_MAINNET_CHAIN_ID,
                actual = chain_id,
                "chain id mismatch"
            );
            return Err(PaymentError::InvalidChainId);
        }
        if chain_id != expected_chain_id {
            error!(
                expected = expected_chain_id,
                actual = chain_id,
                "caller-specified chain id mismatch"
            );
            return Err(PaymentError::InvalidChainId);
        }

        // --- Fetch transaction details ---
        let tx = self.get_transaction(tx_hash).await?;
        let tx_receipt = self.get_transaction_receipt(tx_hash).await?;

        // --- Recipient match ---
        let recipient = tx["to"]
            .as_str()
            .ok_or_else(|| {
                PaymentError::ProviderError("transaction has no recipient".into())
            })?
            .to_string();

        let treasury_lower = self.treasury_config.expected_address.to_lowercase();
        if recipient.to_lowercase() != treasury_lower {
            error!(
                expected = %treasury_lower,
                actual = %recipient,
                "recipient does not match treasury"
            );
            return Err(PaymentError::TreasuryMismatch);
        }

        // --- Confirmation depth ---
        let tx_block_hex = tx_receipt["blockNumber"]
            .as_str()
            .ok_or_else(|| PaymentError::ProviderError("missing blockNumber".into()))?;
        let tx_block = u64_from_hex(tx_block_hex)?;
        let current_block = self.get_block_number().await?;
        let confirmations = current_block.saturating_sub(tx_block) + 1;

        if confirmations < MIN_CONFIRMATION_DEPTH || confirmations < min_confirmations {
            warn!(
                confirmations = confirmations,
                required = min_confirmations.max(MIN_CONFIRMATION_DEPTH),
                tx_hash = %tx_hash,
                "insufficient confirmations"
            );
            return Err(PaymentError::InsufficientConfirmations);
        }

        // --- Parse value ---
        let value_hex = tx["value"]
            .as_str()
            .ok_or_else(|| PaymentError::ProviderError("missing tx value".into()))?;
        let amount_wei = u256_from_hex(value_hex);

        // --- ETH/USD price with timestamp lock ---
        let (price_usd, price_ts) = self.get_eth_price().await?;
        let price_locked_at =
            DateTime::from_timestamp(price_ts, 0)
                .ok_or_else(|| PaymentError::ProviderError("invalid price timestamp".into()))?
                .with_timezone(&Utc);

        let price_age = Utc::now()
            .signed_duration_since(price_locked_at)
            .num_seconds();
        if price_age > PRICE_LOCK_MAX_AGE_SECS {
            warn!(
                price_age = price_age,
                max = PRICE_LOCK_MAX_AGE_SECS,
                "price lock expired"
            );
            return Err(PaymentError::PriceLockExpired);
        }

        // Convert wei to ETH, then to USD.
        let amount_eth = wei_to_eth(&amount_wei);
        let amount_usd = amount_eth * price_usd;

        let verified = VerifiedTx {
            tx_hash: tx_hash.to_string(),
            amount_wei: amount_wei.clone(),
            amount_usd,
            recipient: recipient.clone(),
            chain_id,
            block_number: tx_block,
            confirmations,
            price_usd_at_lock: price_usd,
            price_locked_at,
        };

        log_payment_event(
            state,
            "metamask_tx_verified",
            tx_hash,
            serde_json::json!({
                "chain_id": chain_id,
                "recipient": recipient,
                "amount_wei": amount_wei,
                "amount_usd": amount_usd,
                "confirmations": confirmations,
                "price_usd": price_usd,
            }),
        );

        info!(
            tx_hash = %tx_hash,
            amount_usd = amount_usd,
            confirmations = confirmations,
            "transaction verified successfully"
        );

        Ok(verified)
    }

    /// Fetch the current ETH/USD price and the timestamp at which it was fetched.
    pub async fn get_eth_price(&self) -> Result<(f64, i64), PaymentError> {
        let client = reqwest::Client::new();
        let resp = client
            .get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_last_updated_at=true")
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("price fetch failed: {e}")))?;

        if !resp.status().is_success() {
            return Err(PaymentError::ProviderError(
                "price API returned error".into(),
            ));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("price json error: {e}")))?;

        let price = body["ethereum"]["usd"]
            .as_f64()
            .ok_or_else(|| PaymentError::ProviderError("missing usd price".into()))?;
        let updated_at = body["ethereum"]["last_updated_at"]
            .as_i64()
            .ok_or_else(|| PaymentError::ProviderError("missing price timestamp".into()))?;

        info!(price_usd = price, updated_at = updated_at, "fetched ETH/USD price");
        Ok((price, updated_at))
    }

    // -----------------------------------------------------------------------
    // JSON-RPC helpers
    // -----------------------------------------------------------------------

    async fn rpc_call(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, PaymentError> {
        let client = reqwest::Client::new();
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        let resp = client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("rpc request failed: {e}")))?;

        let result: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("rpc json error: {e}")))?;

        if let Some(err) = result.get("error") {
            return Err(PaymentError::ProviderError(format!(
                "rpc error: {}",
                err
            )));
        }

        Ok(result["result"].clone())
    }

    async fn get_chain_id(&self) -> Result<u64, PaymentError> {
        let result = self.rpc_call("eth_chainId", serde_json::json!([])).await?;
        let hex = result
            .as_str()
            .ok_or_else(|| PaymentError::ProviderError("invalid chain id response".into()))?;
        u64_from_hex(hex)
    }

    async fn get_block_number(&self) -> Result<u64, PaymentError> {
        let result = self
            .rpc_call("eth_blockNumber", serde_json::json!([]))
            .await?;
        let hex = result
            .as_str()
            .ok_or_else(|| PaymentError::ProviderError("invalid block number response".into()))?;
        u64_from_hex(hex)
    }

    async fn get_transaction(
        &self,
        tx_hash: &str,
    ) -> Result<serde_json::Value, PaymentError> {
        let result = self
            .rpc_call("eth_getTransactionByHash", serde_json::json!([tx_hash]))
            .await?;
        if result.is_null() {
            return Err(PaymentError::ProviderError(format!(
                "transaction not found: {tx_hash}"
            )));
        }
        Ok(result)
    }

    async fn get_transaction_receipt(
        &self,
        tx_hash: &str,
    ) -> Result<serde_json::Value, PaymentError> {
        let result = self
            .rpc_call(
                "eth_getTransactionReceipt",
                serde_json::json!([tx_hash]),
            )
            .await?;
        if result.is_null() {
            return Err(PaymentError::ProviderError(format!(
                "transaction receipt not found: {tx_hash}"
            )));
        }
        Ok(result)
    }
}

// ---------------------------------------------------------------------------
// Hex / conversion helpers
// ---------------------------------------------------------------------------

fn u64_from_hex(hex: &str) -> Result<u64, PaymentError> {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    u64::from_str_radix(hex, 16)
        .map_err(|e| PaymentError::ProviderError(format!("hex parse error: {e}")))
}

/// Parse a hex-encoded u256 value into a decimal string.
fn u256_from_hex(hex: &str) -> String {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    // For display purposes we convert through u128 which covers most
    // practical ETH transfer amounts (up to ~3.4e38 wei ≈ 3.4e20 ETH).
    match u128::from_str_radix(hex, 16) {
        Ok(v) => v.to_string(),
        Err(_) => format!("0x{hex}"),
    }
}

/// Convert a decimal-string wei amount to ETH as f64.
fn wei_to_eth(wei_str: &str) -> f64 {
    // Try to parse as u128, then divide.
    if let Ok(wei) = wei_str.parse::<u128>() {
        wei as f64 / 1e18
    } else {
        // If the string is a hex fallback, try parsing that.
        let hex = wei_str.strip_prefix("0x").unwrap_or(wei_str);
        if let Ok(wei) = u128::from_str_radix(hex, 16) {
            wei as f64 / 1e18
        } else {
            0.0
        }
    }
}
