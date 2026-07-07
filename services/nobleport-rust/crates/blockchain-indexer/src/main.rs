mod chain;
mod ens;
mod price;

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use common::{ETHEREUM_MAINNET_CHAIN_ID, MIN_CONFIRMATION_DEPTH, NOBLEPORT_TREASURY};

use chain::{ChainVerifier, VerifiedTransaction};
use ens::EnsResolver;
use price::PriceQuote;

// ---------------------------------------------------------------------------
// Shared application state
// ---------------------------------------------------------------------------

struct AppState {
    verifier: Mutex<ChainVerifier>,
    ens_resolver: EnsResolver,
}

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct VerifyTxRequest {
    tx_hash: String,
}

#[derive(Debug, Serialize)]
struct VerifyTxResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<VerifiedTransaction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct TxStatusResponse {
    tx_hash: String,
    processed: bool,
}

#[derive(Debug, Deserialize)]
struct ResolveEnsRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct ResolveEnsResponse {
    name: String,
    address: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    chain_id: u64,
    min_confirmations: u64,
    treasury_address: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        service: "blockchain-indexer".into(),
        chain_id: ETHEREUM_MAINNET_CHAIN_ID,
        min_confirmations: MIN_CONFIRMATION_DEPTH,
        treasury_address: NOBLEPORT_TREASURY.into(),
    })
}

async fn verify_tx(
    State(state): State<Arc<AppState>>,
    Json(body): Json<VerifyTxRequest>,
) -> (StatusCode, Json<VerifyTxResponse>) {
    let mut verifier = state.verifier.lock().await;

    // Fast path: reject duplicates before making any RPC calls.
    if verifier.is_processed(&body.tx_hash) {
        return (
            StatusCode::CONFLICT,
            Json(VerifyTxResponse {
                success: false,
                data: None,
                error: Some(common::PaymentError::ReplayDetected.to_string()),
            }),
        );
    }

    match verifier.verify_transaction(&body.tx_hash).await {
        Ok(verified) => (
            StatusCode::OK,
            Json(VerifyTxResponse {
                success: true,
                data: Some(verified),
                error: None,
            }),
        ),
        Err(e) => {
            let status = match &e {
                common::PaymentError::ReplayDetected => StatusCode::CONFLICT,
                common::PaymentError::InvalidChainId => StatusCode::BAD_REQUEST,
                common::PaymentError::TreasuryMismatch => StatusCode::BAD_REQUEST,
                common::PaymentError::InsufficientConfirmations => StatusCode::UNPROCESSABLE_ENTITY,
                common::PaymentError::PriceLockExpired => StatusCode::UNPROCESSABLE_ENTITY,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            };
            (
                status,
                Json(VerifyTxResponse {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                }),
            )
        }
    }
}

async fn get_tx_status(
    State(state): State<Arc<AppState>>,
    Path(hash): Path<String>,
) -> Json<TxStatusResponse> {
    let verifier = state.verifier.lock().await;
    let processed = verifier.lookup(&hash).is_some();
    Json(TxStatusResponse {
        tx_hash: hash,
        processed,
    })
}

async fn get_eth_price(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PriceQuote>, (StatusCode, String)> {
    let mut verifier = state.verifier.lock().await;
    let quote = verifier
        .price_oracle_mut()
        .quote()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(quote))
}

async fn resolve_ens(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ResolveEnsRequest>,
) -> Result<Json<ResolveEnsResponse>, (StatusCode, String)> {
    let address = state
        .ens_resolver
        .resolve(&body.name)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ResolveEnsResponse {
        name: body.name,
        address,
    }))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    // Load .env if present (ignored if missing).
    let _ = dotenvy::dotenv();

    // Initialise structured logging.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".parse().unwrap()),
        )
        .json()
        .init();

    let rpc_url = std::env::var("ETH_RPC_URL")
        .unwrap_or_else(|_| "https://eth.llamarpc.com".to_string());

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3003);

    tracing::info!(
        chain_id = ETHEREUM_MAINNET_CHAIN_ID,
        min_confirmations = MIN_CONFIRMATION_DEPTH,
        treasury_address = NOBLEPORT_TREASURY,
        %rpc_url,
        %port,
        "blockchain-indexer starting"
    );

    let state = Arc::new(AppState {
        verifier: Mutex::new(ChainVerifier::new(&rpc_url)),
        ens_resolver: EnsResolver::new(&rpc_url),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/indexer/verify-tx", post(verify_tx))
        .route("/api/indexer/tx/{hash}", get(get_tx_status))
        .route("/api/indexer/price/eth", get(get_eth_price))
        .route("/api/indexer/resolve-ens", post(resolve_ens))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("failed to bind listener");

    tracing::info!("listening on 0.0.0.0:{port}");

    axum::serve(listener, app)
        .await
        .expect("server error");
}
