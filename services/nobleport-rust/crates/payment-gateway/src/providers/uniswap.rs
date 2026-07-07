use chrono::Utc;
use common::{PaymentError, SwapIntent, SwapStatus};
use std::collections::HashMap;
use std::sync::Mutex;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::audit::log_payment_event;
use crate::AppState;

/// Uniswap provider -- QUOTE ONLY at launch.
///
/// This provider never auto-executes swaps. It returns a `SwapIntent` with
/// `status = Quoted`. Execution requires explicit human approval AND a
/// custodian signer (manual execution path).
pub struct UniswapProvider {
    /// In-memory store of swap intents keyed by intent_id.
    intents: Mutex<HashMap<String, SwapIntent>>,
}

impl UniswapProvider {
    pub fn new() -> Self {
        Self {
            intents: Mutex::new(HashMap::new()),
        }
    }

    pub fn from_env() -> Option<Self> {
        // Uniswap provider is always available (quote-only, no API key required).
        // We check for an explicit opt-in flag.
        let enabled = std::env::var("UNISWAP_ENABLED")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);
        if enabled {
            Some(Self::new())
        } else {
            None
        }
    }

    /// Returns true (always configured when present).
    pub fn is_configured(&self) -> bool {
        true
    }

    /// Fetch a swap quote from the Uniswap Quoter contract (simulated).
    ///
    /// Returns a `SwapIntent` with `status = Quoted`. NO on-chain execution.
    pub async fn get_quote(
        &self,
        user_id: &str,
        token_in: &str,
        token_out: &str,
        amount_in: f64,
        slippage_bps: u32,
        state: &AppState,
    ) -> Result<SwapIntent, PaymentError> {
        info!(
            user_id = %user_id,
            token_in = %token_in,
            token_out = %token_out,
            amount_in = amount_in,
            slippage_bps = slippage_bps,
            "fetching uniswap quote"
        );

        // In a production system this would call the Uniswap Quoter V2
        // on-chain or via their API. For launch we simulate a quote.
        let estimated_out = simulate_quote(token_in, token_out, amount_in);

        let intent = SwapIntent {
            intent_id: Uuid::new_v4(),
            user_id: user_id.to_string(),
            token_in: token_in.to_string(),
            token_out: token_out.to_string(),
            amount_in,
            estimated_out,
            slippage_bps,
            status: SwapStatus::Quoted,
            approved_by: None,
            created_at: Utc::now(),
        };

        log_payment_event(
            state,
            "uniswap_quote",
            &intent.intent_id.to_string(),
            serde_json::json!({
                "user_id": user_id,
                "token_in": token_in,
                "token_out": token_out,
                "amount_in": amount_in,
                "estimated_out": estimated_out,
                "slippage_bps": slippage_bps,
                "status": "quoted",
            }),
        );

        // Store the intent.
        {
            let mut intents = self.intents.lock().expect("intents lock poisoned");
            intents.insert(intent.intent_id.to_string(), intent.clone());
        }

        info!(
            intent_id = %intent.intent_id,
            estimated_out = estimated_out,
            "uniswap quote returned (status=Quoted, no execution)"
        );

        Ok(intent)
    }

    /// Record human approval for a swap intent.
    ///
    /// Sets `status = Approved` and records the approver. Does NOT execute.
    pub async fn approve_swap(
        &self,
        intent_id: &str,
        approver_id: &str,
        state: &AppState,
    ) -> Result<SwapIntent, PaymentError> {
        info!(
            intent_id = %intent_id,
            approver_id = %approver_id,
            "approving uniswap swap"
        );

        let mut intents = self.intents.lock().expect("intents lock poisoned");
        let intent = intents
            .get_mut(intent_id)
            .ok_or_else(|| {
                PaymentError::ProviderError(format!("swap intent not found: {intent_id}"))
            })?;

        if intent.status != SwapStatus::Quoted && intent.status != SwapStatus::AwaitingApproval {
            warn!(
                intent_id = %intent_id,
                current_status = ?intent.status,
                "swap intent is not in a quotable state"
            );
            return Err(PaymentError::ProviderError(format!(
                "cannot approve intent in {:?} status",
                intent.status
            )));
        }

        intent.status = SwapStatus::Approved;
        intent.approved_by = Some(approver_id.to_string());
        let result = intent.clone();

        log_payment_event(
            state,
            "uniswap_swap_approved",
            intent_id,
            serde_json::json!({
                "approver_id": approver_id,
                "token_in": result.token_in,
                "token_out": result.token_out,
                "amount_in": result.amount_in,
                "estimated_out": result.estimated_out,
                "status": "approved",
            }),
        );

        info!(
            intent_id = %intent_id,
            approver_id = %approver_id,
            "swap approved (still not executed -- requires custodian signer)"
        );

        Ok(result)
    }

    /// Attempt to execute an approved swap.
    ///
    /// At launch this ALWAYS returns an error because on-chain execution
    /// requires a custodian signer that is not yet integrated.
    pub async fn execute_approved_swap(
        &self,
        intent_id: &str,
        state: &AppState,
    ) -> Result<SwapIntent, PaymentError> {
        info!(intent_id = %intent_id, "execute_approved_swap called");

        let intents = self.intents.lock().expect("intents lock poisoned");
        let intent = intents
            .get(intent_id)
            .ok_or_else(|| {
                PaymentError::ProviderError(format!("swap intent not found: {intent_id}"))
            })?;

        if intent.status != SwapStatus::Approved {
            error!(
                intent_id = %intent_id,
                status = ?intent.status,
                "cannot execute swap that is not approved"
            );
            return Err(PaymentError::HumanApprovalRequired);
        }

        log_payment_event(
            state,
            "uniswap_execution_blocked",
            intent_id,
            serde_json::json!({
                "reason": "custodian signer not available",
                "status": "approved_but_blocked",
            }),
        );

        // Intentionally block execution at launch.
        Err(PaymentError::ProviderError(
            "On-chain execution requires custodian signer \u{2014} use manual execution path"
                .to_string(),
        ))
    }

    /// Look up an existing swap intent by ID.
    pub fn get_intent(&self, intent_id: &str) -> Result<SwapIntent, PaymentError> {
        let intents = self.intents.lock().expect("intents lock poisoned");
        intents
            .get(intent_id)
            .cloned()
            .ok_or_else(|| {
                PaymentError::ProviderError(format!("swap intent not found: {intent_id}"))
            })
    }
}

/// Simulate a Uniswap V3 quote. In production, this would call the Quoter V2
/// contract via eth_call or the Uniswap routing API.
fn simulate_quote(token_in: &str, token_out: &str, amount_in: f64) -> f64 {
    // Very rough simulation using approximate market prices.
    let price_ratio = match (token_in.to_uppercase().as_str(), token_out.to_uppercase().as_str()) {
        ("ETH" | "WETH", "USDC" | "USDT" | "DAI") => 2500.0,
        ("USDC" | "USDT" | "DAI", "ETH" | "WETH") => 1.0 / 2500.0,
        ("ETH" | "WETH", "WBTC") => 0.05,
        ("WBTC", "ETH" | "WETH") => 20.0,
        _ => 1.0, // 1:1 for unknown pairs
    };

    // Apply a small simulated spread (0.3% Uniswap fee tier).
    let fee_multiplier = 0.997;
    amount_in * price_ratio * fee_multiplier
}
