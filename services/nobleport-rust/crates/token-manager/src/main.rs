mod compliance;
mod ledger;

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use common::{AuditChain, ComplianceStatus, PaymentError, NOBLEPORT_TREASURY};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use uuid::Uuid;

use crate::compliance::ComplianceEngine;
use crate::ledger::TokenLedger;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/// Application state with each component independently locked so the borrow
/// checker allows simultaneous reads/writes to different fields.
struct AppState {
    ledger: RwLock<TokenLedger>,
    compliance: RwLock<ComplianceEngine>,
    audit_chain: RwLock<AuditChain>,
}

type SharedState = Arc<AppState>;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct CreditRequest {
    user_id: String,
    amount: i64,
    amount_usd: f64,
    reason: String,
    payment_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct DebitRequest {
    user_id: String,
    amount: i64,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct ComplianceUpdateRequest {
    user_id: String,
    status: ComplianceStatus,
    jurisdiction: Option<String>,
}

#[derive(Debug, Serialize)]
struct ApiResponse<T: Serialize> {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    action_required: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    fn ok(data: T) -> Json<Self> {
        Json(Self {
            success: true,
            data: Some(data),
            error: None,
            action_required: None,
        })
    }
}

fn error_response(error: &PaymentError) -> (StatusCode, Json<ApiResponse<()>>) {
    let (status_code, action_required) = match error {
        PaymentError::ComplianceRequired => (
            StatusCode::FORBIDDEN,
            Some(
                "Complete KYC verification at nobleport.io/verify before tokens can be credited."
                    .to_string(),
            ),
        ),
        PaymentError::AccreditedInvestorRequired => (
            StatusCode::FORBIDDEN,
            Some(
                "Accredited investor verification is required for transactions exceeding $10,000. \
                 Submit accreditation documents at nobleport.io/verify/accredited."
                    .to_string(),
            ),
        ),
        PaymentError::TransferRestricted => (
            StatusCode::FORBIDDEN,
            Some(
                "Token transfers are restricted for this account. This may be due to a \
                 restricted jurisdiction, a rejected KYC application, or a manual transfer \
                 hold. Contact compliance@nobleport.io for assistance."
                    .to_string(),
            ),
        ),
        _ => (StatusCode::BAD_REQUEST, None),
    };

    (
        status_code,
        Json(ApiResponse {
            success: false,
            data: None,
            error: Some(error.to_string()),
            action_required,
        }),
    )
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "token-manager",
        "treasury": NOBLEPORT_TREASURY,
    }))
}

async fn get_balance(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> Json<ApiResponse<common::TokenBalance>> {
    let ledger = state.ledger.read().await;
    let balance = ledger.get_balance(&user_id);
    info!(user_id = %user_id, balance = %balance.balance, "Balance queried");
    ApiResponse::ok(balance)
}

async fn credit_tokens(
    State(state): State<SharedState>,
    Json(req): Json<CreditRequest>,
) -> Result<Json<ApiResponse<common::TokenTransaction>>, (StatusCode, Json<ApiResponse<()>>)> {
    // Acquire locks independently to satisfy the borrow checker.
    let compliance = state.compliance.read().await;
    let mut ledger = state.ledger.write().await;
    let mut audit_chain = state.audit_chain.write().await;

    let result = ledger.credit(
        &req.user_id,
        req.amount,
        req.amount_usd,
        &req.reason,
        req.payment_id,
        &compliance,
        &mut audit_chain,
    );

    match result {
        Ok(tx) => Ok(ApiResponse::ok(tx)),
        Err(e) => {
            warn!(
                user_id = %req.user_id,
                amount = %req.amount,
                error = %e,
                "Token credit rejected"
            );
            Err(error_response(&e))
        }
    }
}

async fn debit_tokens(
    State(state): State<SharedState>,
    Json(req): Json<DebitRequest>,
) -> Result<Json<ApiResponse<common::TokenTransaction>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut ledger = state.ledger.write().await;
    let mut audit_chain = state.audit_chain.write().await;

    let result = ledger.debit(
        &req.user_id,
        req.amount,
        &req.reason,
        &mut audit_chain,
    );

    match result {
        Ok(tx) => Ok(ApiResponse::ok(tx)),
        Err(e) => {
            warn!(
                user_id = %req.user_id,
                amount = %req.amount,
                error = %e,
                "Token debit rejected"
            );
            Err(error_response(&e))
        }
    }
}

async fn get_transactions(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> Json<ApiResponse<Vec<common::TokenTransaction>>> {
    let ledger = state.ledger.read().await;
    let txs = ledger.get_transactions(&user_id);
    info!(user_id = %user_id, count = txs.len(), "Transactions queried");
    ApiResponse::ok(txs)
}

async fn get_compliance(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> Json<ApiResponse<common::ComplianceGate>> {
    let compliance = state.compliance.read().await;
    let gate = compliance.get_gate(&user_id);
    info!(user_id = %user_id, status = ?gate.status, "Compliance status queried");
    ApiResponse::ok(gate)
}

async fn update_compliance(
    State(state): State<SharedState>,
    Json(req): Json<ComplianceUpdateRequest>,
) -> Json<ApiResponse<common::ComplianceGate>> {
    let mut compliance = state.compliance.write().await;
    let mut audit_chain = state.audit_chain.write().await;

    compliance.update_status(
        &req.user_id,
        req.status,
        req.jurisdiction,
        &mut audit_chain,
    );

    let gate = compliance.get_gate(&req.user_id);
    info!(
        user_id = %req.user_id,
        new_status = ?gate.status,
        "Compliance status updated via API"
    );
    ApiResponse::ok(gate)
}

#[derive(Debug, Serialize)]
struct ComplianceCheckResult {
    user_id: String,
    can_receive: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    action_required: Option<String>,
    status: ComplianceStatus,
}

async fn check_compliance(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> Json<ApiResponse<ComplianceCheckResult>> {
    let compliance = state.compliance.read().await;
    let gate = compliance.get_gate(&user_id);

    // Do a baseline check at $0 — this catches KYC/jurisdiction/restriction
    // issues without triggering the accredited-investor threshold.
    let check = compliance.check_can_receive(&user_id, 0.0);

    let result = match check {
        Ok(()) => ComplianceCheckResult {
            user_id: user_id.clone(),
            can_receive: true,
            reason: None,
            action_required: None,
            status: gate.status,
        },
        Err(ref e) => {
            let (reason, action) = match e {
                PaymentError::ComplianceRequired => (
                    "KYC verification has not been completed.".to_string(),
                    "Complete KYC verification at nobleport.io/verify".to_string(),
                ),
                PaymentError::TransferRestricted => (
                    "Token transfers are restricted for this account.".to_string(),
                    "Contact compliance@nobleport.io for assistance.".to_string(),
                ),
                other => (other.to_string(), String::new()),
            };
            ComplianceCheckResult {
                user_id: user_id.clone(),
                can_receive: false,
                reason: Some(reason),
                action_required: Some(action),
                status: gate.status,
            }
        }
    };

    info!(
        user_id = %user_id,
        can_receive = %result.can_receive,
        "Compliance pre-check performed"
    );
    ApiResponse::ok(result)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    // Initialise tracing.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "token_manager=debug,tower_http=debug".parse().unwrap()),
        )
        .init();

    // Load .env if present (non-fatal if missing).
    let _ = dotenvy::dotenv();

    info!("NoblePort Token Manager starting");
    info!(treasury = %NOBLEPORT_TREASURY, "Treasury address configured");

    // Build shared state.
    let state: SharedState = Arc::new(AppState {
        ledger: RwLock::new(TokenLedger::new()),
        compliance: RwLock::new(ComplianceEngine::new()),
        audit_chain: RwLock::new(AuditChain::new()),
    });

    info!("Compliance engine initialised — all wallets start as Unverified");
    info!(
        restricted_jurisdictions = ?compliance::RESTRICTED_JURISDICTIONS,
        "Restricted jurisdictions loaded"
    );

    // Build router.
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/tokens/balance/{user_id}", get(get_balance))
        .route("/api/tokens/credit", post(credit_tokens))
        .route("/api/tokens/debit", post(debit_tokens))
        .route(
            "/api/tokens/transactions/{user_id}",
            get(get_transactions),
        )
        .route("/api/compliance/{user_id}", get(get_compliance))
        .route("/api/compliance/update", post(update_compliance))
        .route("/api/compliance/check/{user_id}", get(check_compliance))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Bind and serve.
    let addr = "0.0.0.0:3002";
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind to port 3002");
    info!(addr = %addr, "Token Manager listening");

    axum::serve(listener, app)
        .await
        .expect("server error");
}
