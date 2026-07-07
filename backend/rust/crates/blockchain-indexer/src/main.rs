use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};

use common::{
    AuditChain, PaymentError, TreasuryConfig, VerifiedTx, ETHEREUM_MAINNET_CHAIN_ID,
    MIN_CONFIRMATION_DEPTH, NOBLEPORT_TREASURY, PRICE_LOCK_MAX_AGE_SECS,
};

// ─── JSON-RPC Helper ─────────────────────────────────────────────

async fn rpc_call(
    client: &reqwest::Client,
    rpc_url: &str,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, PaymentError> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
    });

    let resp = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| PaymentError::ProviderError(format!("RPC request failed: {e}")))?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| PaymentError::ProviderError(format!("RPC response parse failed: {e}")))?;

    if let Some(err) = json.get("error") {
        return Err(PaymentError::ProviderError(format!("RPC error: {err}")));
    }

    json.get("result")
        .cloned()
        .ok_or_else(|| PaymentError::ProviderError("RPC response missing result".to_string()))
}

// ─── PriceOracle ─────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct PriceOracle {
    cache: Option<(f64, DateTime<Utc>)>,
}

impl PriceOracle {
    fn new() -> Self {
        Self { cache: None }
    }

    async fn get_eth_usd(
        &mut self,
        client: &reqwest::Client,
    ) -> Result<(f64, DateTime<Utc>), PaymentError> {
        if let Some((price, ts)) = &self.cache {
            if Self::is_valid(*ts) {
                return Ok((*price, *ts));
            }
        }

        let resp = client
            .get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("CoinGecko request failed: {e}")))?;

        let json: serde_json::Value = resp.json().await.map_err(|e| {
            PaymentError::ProviderError(format!("CoinGecko response parse failed: {e}"))
        })?;

        let price = json
            .get("ethereum")
            .and_then(|v| v.get("usd"))
            .and_then(|v| v.as_f64())
            .ok_or_else(|| {
                PaymentError::ProviderError("CoinGecko response missing ETH price".to_string())
            })?;

        let now = Utc::now();
        self.cache = Some((price, now));
        info!(price, "Fetched fresh ETH/USD price from CoinGecko");
        Ok((price, now))
    }

    fn is_valid(locked_at: DateTime<Utc>) -> bool {
        let age = Utc::now().signed_duration_since(locked_at).num_seconds();
        age < PRICE_LOCK_MAX_AGE_SECS
    }
}

// ─── ChainVerifier ───────────────────────────────────────────────

struct ChainVerifier {
    rpc_url: String,
    treasury: TreasuryConfig,
    processed_txs: HashSet<String>,
    verified_cache: HashMap<String, VerifiedTx>,
    price_cache: Option<(f64, DateTime<Utc>)>,
}

impl ChainVerifier {
    fn new(rpc_url: String) -> Self {
        Self {
            rpc_url,
            treasury: TreasuryConfig::default_config(),
            processed_txs: HashSet::new(),
            verified_cache: HashMap::new(),
            price_cache: None,
        }
    }

    async fn verify_transaction(
        &mut self,
        tx_hash: &str,
        client: &reqwest::Client,
        price_oracle: &mut PriceOracle,
    ) -> Result<VerifiedTx, PaymentError> {
        // 1. Replay detection
        if self.processed_txs.contains(tx_hash) {
            return Err(PaymentError::ReplayDetected {
                tx_hash: tx_hash.to_string(),
            });
        }

        // 2. Fetch transaction data via eth_getTransactionByHash
        let tx = rpc_call(
            client,
            &self.rpc_url,
            "eth_getTransactionByHash",
            serde_json::json!([tx_hash]),
        )
        .await?;

        if tx.is_null() {
            return Err(PaymentError::ProviderError(format!(
                "Transaction not found: {tx_hash}"
            )));
        }

        // 3. Extract and validate chain ID
        let chain_id_hex = tx
            .get("chainId")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0");
        let chain_id =
            u64::from_str_radix(chain_id_hex.trim_start_matches("0x"), 16).unwrap_or(0);

        if chain_id != ETHEREUM_MAINNET_CHAIN_ID {
            return Err(PaymentError::InvalidChainId {
                expected: ETHEREUM_MAINNET_CHAIN_ID,
                got: chain_id,
            });
        }

        // 4. Verify recipient matches treasury (case-insensitive via TreasuryConfig)
        let to_address = tx
            .get("to")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                PaymentError::ProviderError("Transaction missing 'to' field".to_string())
            })?;

        self.treasury.verify_recipient(to_address)?;

        let from_address = tx
            .get("from")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0")
            .to_string();

        let value_hex = tx
            .get("value")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0");

        let block_number_hex = tx
            .get("blockNumber")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                PaymentError::ProviderError("Transaction missing blockNumber".to_string())
            })?;
        let tx_block =
            u64::from_str_radix(block_number_hex.trim_start_matches("0x"), 16).unwrap_or(0);

        // 5. Verify transaction receipt status == "0x1"
        let receipt = rpc_call(
            client,
            &self.rpc_url,
            "eth_getTransactionReceipt",
            serde_json::json!([tx_hash]),
        )
        .await?;

        let status = receipt
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("0x0");

        if status != "0x1" {
            return Err(PaymentError::ProviderError(format!(
                "Transaction reverted (status: {status})"
            )));
        }

        // 6. Get current block number and compute confirmations
        let current_block_val = rpc_call(
            client,
            &self.rpc_url,
            "eth_blockNumber",
            serde_json::json!([]),
        )
        .await?;

        let current_block_str = current_block_val.as_str().ok_or_else(|| {
            PaymentError::ProviderError("eth_blockNumber returned non-string".to_string())
        })?;
        let current_block =
            u64::from_str_radix(current_block_str.trim_start_matches("0x"), 16).unwrap_or(0);

        let confirmations = current_block.saturating_sub(tx_block);

        // 7. Reject if confirmations < MIN_CONFIRMATION_DEPTH
        if confirmations < MIN_CONFIRMATION_DEPTH {
            return Err(PaymentError::InsufficientConfirmations {
                required: MIN_CONFIRMATION_DEPTH,
                got: confirmations,
            });
        }

        // 8. Fetch ETH/USD price; reject if cached price too old
        let (price, price_locked_at) = price_oracle.get_eth_usd(client).await?;

        if !PriceOracle::is_valid(price_locked_at) {
            return Err(PaymentError::PriceLockExpired {
                max_age_secs: PRICE_LOCK_MAX_AGE_SECS,
            });
        }

        self.price_cache = Some((price, price_locked_at));

        // 9. Calculate amount_usd = (wei / 1e18) * price
        let wei = u128::from_str_radix(value_hex.trim_start_matches("0x"), 16).unwrap_or(0);
        let amount_eth = wei as f64 / 1e18;
        let amount_usd = amount_eth * price;

        // 10. Record as processed and cache verified result
        let verified = VerifiedTx {
            tx_hash: tx_hash.to_string(),
            from_address,
            to_address: to_address.to_string(),
            amount_wei: wei.to_string(),
            amount_eth,
            amount_usd,
            chain_id,
            block_number: tx_block,
            confirmations,
            price_usd_at_lock: price,
            price_locked_at,
        };

        self.processed_txs.insert(tx_hash.to_string());
        self.verified_cache
            .insert(tx_hash.to_string(), verified.clone());

        info!(
            tx_hash,
            amount_eth, amount_usd, confirmations, "Transaction verified"
        );

        // 11. Return VerifiedTx
        Ok(verified)
    }
}

// ─── App State ───────────────────────────────────────────────────

struct AppState {
    verifier: ChainVerifier,
    price_oracle: PriceOracle,
    audit_chain: AuditChain,
    client: reqwest::Client,
}

type SharedState = Arc<RwLock<AppState>>;

// ─── Request / Response Types ────────────────────────────────────

#[derive(Debug, Deserialize)]
struct VerifyTxRequest {
    tx_hash: String,
}

#[derive(Debug, Deserialize)]
struct ResolveEnsRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct ResolveEnsResponse {
    name: String,
    address: Option<String>,
    resolved_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct PriceResponse {
    eth_usd: f64,
    timestamp: DateTime<Utc>,
    source: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    chain_id: u64,
    min_confirmations: u64,
    treasury: String,
    timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

// ─── Handlers ────────────────────────────────────────────────────

async fn health_handler(State(state): State<SharedState>) -> Json<HealthResponse> {
    let st = state.read().await;
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "blockchain-indexer".to_string(),
        chain_id: ETHEREUM_MAINNET_CHAIN_ID,
        min_confirmations: MIN_CONFIRMATION_DEPTH,
        treasury: st.verifier.treasury.expected_address.clone(),
        timestamp: Utc::now(),
    })
}

async fn verify_tx_handler(
    State(state): State<SharedState>,
    Json(payload): Json<VerifyTxRequest>,
) -> Result<Json<VerifiedTx>, (StatusCode, Json<ErrorResponse>)> {
    let mut st = state.write().await;
    let client = st.client.clone();
    let AppState {
        ref mut verifier,
        ref mut price_oracle,
        ..
    } = *st;

    let result = verifier
        .verify_transaction(&payload.tx_hash, &client, price_oracle)
        .await;

    match result {
        Ok(verified) => {
            st.audit_chain.append(
                "tx_verified",
                serde_json::json!({
                    "tx_hash": &verified.tx_hash,
                    "amount_usd": verified.amount_usd,
                    "confirmations": verified.confirmations,
                    "chain_id": verified.chain_id,
                }),
            );
            info!(
                tx_hash = %verified.tx_hash,
                audit_len = st.audit_chain.len(),
                "Audit entry appended"
            );
            Ok(Json(verified))
        }
        Err(e) => {
            warn!(error = %e, tx_hash = %payload.tx_hash, "Transaction verification failed");
            let status = match &e {
                PaymentError::ReplayDetected { .. } => StatusCode::CONFLICT,
                PaymentError::InvalidChainId { .. } => StatusCode::BAD_REQUEST,
                PaymentError::TreasuryMismatch { .. } => StatusCode::BAD_REQUEST,
                PaymentError::InsufficientConfirmations { .. } => StatusCode::PRECONDITION_FAILED,
                PaymentError::PriceLockExpired { .. } => StatusCode::PRECONDITION_FAILED,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            };
            Err((status, Json(ErrorResponse { error: e.to_string() })))
        }
    }
}

async fn get_tx_handler(
    State(state): State<SharedState>,
    axum::extract::Path(hash): axum::extract::Path<String>,
) -> Result<Json<VerifiedTx>, (StatusCode, Json<ErrorResponse>)> {
    let st = state.read().await;
    match st.verifier.verified_cache.get(&hash) {
        Some(tx) => Ok(Json(tx.clone())),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Transaction not found: {hash}"),
            }),
        )),
    }
}

async fn price_handler(
    State(state): State<SharedState>,
) -> Result<Json<PriceResponse>, (StatusCode, Json<ErrorResponse>)> {
    let mut st = state.write().await;
    let client = st.client.clone();

    match st.price_oracle.get_eth_usd(&client).await {
        Ok((price, ts)) => Ok(Json(PriceResponse {
            eth_usd: price,
            timestamp: ts,
            source: "coingecko".to_string(),
        })),
        Err(e) => {
            error!(error = %e, "Failed to fetch ETH price");
            Err((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ErrorResponse { error: e.to_string() }),
            ))
        }
    }
}

async fn resolve_ens_handler(
    State(state): State<SharedState>,
    Json(payload): Json<ResolveEnsRequest>,
) -> Result<Json<ResolveEnsResponse>, (StatusCode, Json<ErrorResponse>)> {
    let st = state.read().await;
    let client = st.client.clone();
    let rpc_url = st.verifier.rpc_url.clone();
    drop(st);

    let name = &payload.name;
    let namehash = ens_namehash(name);

    // ENS registry address on mainnet
    let registry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
    // resolver(bytes32) selector = 0x0178b8bf
    let resolver_calldata = format!("0x0178b8bf{namehash}");

    let resolver_result = rpc_call(
        &client,
        &rpc_url,
        "eth_call",
        serde_json::json!([
            { "to": registry, "data": resolver_calldata },
            "latest"
        ]),
    )
    .await;

    match resolver_result {
        Ok(resolver_hex) => {
            let resolver_str = resolver_hex.as_str().unwrap_or("0x");

            // If the resolver is the zero address, the name is not registered
            if resolver_str.len() < 66
                || resolver_str
                    .trim_start_matches("0x")
                    .trim_start_matches('0')
                    .is_empty()
            {
                return Ok(Json(ResolveEnsResponse {
                    name: name.clone(),
                    address: None,
                    resolved_at: Utc::now(),
                }));
            }

            let resolver_addr = format!("0x{}", &resolver_str[resolver_str.len() - 40..]);

            // resolver.addr(bytes32) selector = 0x3b3b57de
            let addr_calldata = format!("0x3b3b57de{namehash}");

            let addr_result = rpc_call(
                &client,
                &rpc_url,
                "eth_call",
                serde_json::json!([
                    { "to": resolver_addr, "data": addr_calldata },
                    "latest"
                ]),
            )
            .await;

            match addr_result {
                Ok(addr_hex) => {
                    let addr_str = addr_hex.as_str().unwrap_or("0x");
                    let address = if addr_str.len() >= 66 {
                        Some(format!("0x{}", &addr_str[addr_str.len() - 40..]))
                    } else {
                        None
                    };
                    Ok(Json(ResolveEnsResponse {
                        name: name.clone(),
                        address,
                        resolved_at: Utc::now(),
                    }))
                }
                Err(e) => Err((
                    StatusCode::BAD_GATEWAY,
                    Json(ErrorResponse {
                        error: format!("ENS addr resolution failed: {e}"),
                    }),
                )),
            }
        }
        Err(e) => Err((
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("ENS resolver lookup failed: {e}"),
            }),
        )),
    }
}

/// Compute the ENS namehash for a domain name (EIP-137).
fn ens_namehash(name: &str) -> String {
    use sha3::{Digest, Keccak256};

    let mut node = [0u8; 32];
    if !name.is_empty() {
        for label in name.rsplit('.') {
            let label_hash = Keccak256::digest(label.as_bytes());
            let mut combined = Vec::with_capacity(64);
            combined.extend_from_slice(&node);
            combined.extend_from_slice(&label_hash);
            node = Keccak256::digest(&combined).into();
        }
    }
    hex::encode(node)
}

// ─── Main ────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let rpc_url =
        std::env::var("ETH_RPC_URL").unwrap_or_else(|_| "https://eth.llamarpc.com".to_string());

    let verifier = ChainVerifier::new(rpc_url);

    info!(
        chain_id = ETHEREUM_MAINNET_CHAIN_ID,
        min_confirmations = MIN_CONFIRMATION_DEPTH,
        treasury = NOBLEPORT_TREASURY,
        "Blockchain indexer starting"
    );

    let state: SharedState = Arc::new(RwLock::new(AppState {
        verifier,
        price_oracle: PriceOracle::new(),
        audit_chain: AuditChain::new(),
        client: reqwest::Client::new(),
    }));

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api/indexer/verify-tx", post(verify_tx_handler))
        .route("/api/indexer/tx/{hash}", get(get_tx_handler))
        .route("/api/indexer/price/eth", get(price_handler))
        .route("/api/indexer/resolve-ens", post(resolve_ens_handler))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:3003";
    info!("Blockchain indexer listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to port 3003");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}
