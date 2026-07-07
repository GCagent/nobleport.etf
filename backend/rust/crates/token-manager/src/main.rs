use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use tracing::info;
use uuid::Uuid;

use common::{
    AuditChain, ComplianceGate, ComplianceStatus, PaymentError, TokenBalance, TokenTransaction,
    TokenTxType, RESTRICTED_JURISDICTIONS,
};

// ─── App State ───────────────────────────────────────────────────

struct AppState {
    balances: HashMap<String, TokenBalance>,
    transactions: Vec<TokenTransaction>,
    compliance: HashMap<String, ComplianceGate>,
    audit: AuditChain,
}

impl AppState {
    fn new() -> Self {
        Self {
            balances: HashMap::new(),
            transactions: Vec::new(),
            compliance: HashMap::new(),
            audit: AuditChain::new(),
        }
    }
}

type SharedState = Arc<RwLock<AppState>>;

// ─── Compliance Engine ───────────────────────────────────────────

fn check_can_receive(gate: &ComplianceGate, amount_usd: f64) -> Result<(), PaymentError> {
    if gate.restricted_transfer {
        return Err(PaymentError::TransferRestricted {
            reason: "Account has an active transfer restriction".to_string(),
        });
    }

    if let Some(ref jurisdiction) = gate.jurisdiction {
        if RESTRICTED_JURISDICTIONS.contains(&jurisdiction.as_str()) {
            return Err(PaymentError::TransferRestricted {
                reason: format!("Jurisdiction '{}' is restricted", jurisdiction),
            });
        }
    }

    match gate.status {
        ComplianceStatus::Unverified | ComplianceStatus::KycPending => {
            return Err(PaymentError::ComplianceRequired {
                reason: "KYC verification not completed".to_string(),
            });
        }
        ComplianceStatus::Rejected => {
            return Err(PaymentError::TransferRestricted {
                reason: "Compliance verification was rejected".to_string(),
            });
        }
        ComplianceStatus::KycApproved | ComplianceStatus::AccreditedInvestor => {}
    }

    if amount_usd > 10_000.0 && gate.status != ComplianceStatus::AccreditedInvestor {
        return Err(PaymentError::AccreditedInvestorRequired);
    }

    Ok(())
}

// ─── Request / Response Types ────────────────────────────────────

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
    restricted_transfer: Option<bool>,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
    action_required: String,
}

fn action_required_for(err: &PaymentError) -> String {
    match err {
        PaymentError::ComplianceRequired { .. } => {
            "Complete KYC at nobleport.io/verify".to_string()
        }
        PaymentError::AccreditedInvestorRequired => {
            "Submit accredited investor verification at nobleport.io/accredited".to_string()
        }
        PaymentError::TransferRestricted { .. } => {
            "Contact support at support@nobleport.io for transfer restriction review".to_string()
        }
        _ => "Contact support at support@nobleport.io".to_string(),
    }
}

fn error_response(err: &PaymentError) -> (StatusCode, Json<ErrorResponse>) {
    let status = match err {
        PaymentError::ComplianceRequired { .. } => StatusCode::FORBIDDEN,
        PaymentError::AccreditedInvestorRequired => StatusCode::FORBIDDEN,
        PaymentError::TransferRestricted { .. } => StatusCode::FORBIDDEN,
        _ => StatusCode::BAD_REQUEST,
    };
    (
        status,
        Json(ErrorResponse {
            error: err.to_string(),
            action_required: action_required_for(err),
        }),
    )
}

// ─── Handlers ────────────────────────────────────────────────────

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "service": "token-manager",
        "status": "healthy",
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

async fn get_balance(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    let state = state.read().await;
    match state.balances.get(&user_id) {
        Some(balance) => (StatusCode::OK, Json(serde_json::json!({
            "success": true,
            "data": balance,
        }))),
        None => (StatusCode::OK, Json(serde_json::json!({
            "success": true,
            "data": {
                "user_id": user_id,
                "balance": 0,
                "last_updated": Utc::now().to_rfc3339(),
            },
        }))),
    }
}

async fn credit_tokens(
    State(state): State<SharedState>,
    Json(req): Json<CreditRequest>,
) -> impl IntoResponse {
    let mut state = state.write().await;

    // Resolve compliance gate for this user
    let gate = state
        .compliance
        .get(&req.user_id)
        .cloned()
        .unwrap_or_else(|| ComplianceGate::unverified(&req.user_id));

    // Compliance check FIRST
    if let Err(err) = check_can_receive(&gate, req.amount_usd) {
        let (status, json) = error_response(&err);
        return (status, json.into_response());
    }

    // Credit the balance
    let balance = state
        .balances
        .entry(req.user_id.clone())
        .or_insert_with(|| TokenBalance {
            user_id: req.user_id.clone(),
            balance: 0,
            compliance: gate.clone(),
            last_updated: Utc::now(),
        });

    balance.balance += req.amount;
    balance.last_updated = Utc::now();
    let balance_after = balance.balance;

    // Log transaction
    let tx = TokenTransaction {
        id: Uuid::new_v4(),
        user_id: req.user_id.clone(),
        tx_type: TokenTxType::Credit,
        amount: req.amount,
        reason: req.reason.clone(),
        payment_id: req.payment_id,
        balance_after,
        created_at: Utc::now(),
    };
    state.transactions.push(tx.clone());

    // Audit entry
    state.audit.append(
        "token_credit",
        serde_json::json!({
            "user_id": req.user_id,
            "amount": req.amount,
            "amount_usd": req.amount_usd,
            "reason": req.reason,
            "payment_id": req.payment_id,
            "balance_after": balance_after,
        }),
    );

    info!(
        user_id = %req.user_id,
        amount = req.amount,
        balance_after,
        "Tokens credited"
    );

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "data": {
                "transaction_id": tx.id,
                "user_id": req.user_id,
                "amount_credited": req.amount,
                "balance_after": balance_after,
            },
        }))
        .into_response(),
    )
}

async fn debit_tokens(
    State(state): State<SharedState>,
    Json(req): Json<DebitRequest>,
) -> impl IntoResponse {
    let mut state = state.write().await;

    let balance = state.balances.get(&req.user_id);
    let current_balance = balance.map(|b| b.balance).unwrap_or(0);

    if current_balance < req.amount {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!(
                    "Insufficient balance: have {}, need {}",
                    current_balance, req.amount
                ),
                "action_required": "Purchase more tokens at nobleport.io/tokens",
            })),
        );
    }

    let balance_entry = state
        .balances
        .get_mut(&req.user_id)
        .expect("balance must exist if current_balance >= amount");

    balance_entry.balance -= req.amount;
    balance_entry.last_updated = Utc::now();
    let balance_after = balance_entry.balance;

    // Log transaction
    let tx = TokenTransaction {
        id: Uuid::new_v4(),
        user_id: req.user_id.clone(),
        tx_type: TokenTxType::Debit,
        amount: req.amount,
        reason: req.reason.clone(),
        payment_id: None,
        balance_after,
        created_at: Utc::now(),
    };
    state.transactions.push(tx.clone());

    // Audit entry
    state.audit.append(
        "token_debit",
        serde_json::json!({
            "user_id": req.user_id,
            "amount": req.amount,
            "reason": req.reason,
            "balance_after": balance_after,
        }),
    );

    info!(
        user_id = %req.user_id,
        amount = req.amount,
        balance_after,
        "Tokens debited"
    );

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "data": {
                "transaction_id": tx.id,
                "user_id": req.user_id,
                "amount_debited": req.amount,
                "balance_after": balance_after,
            },
        })),
    )
}

async fn get_transactions(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    let state = state.read().await;
    let user_txs: Vec<&TokenTransaction> = state
        .transactions
        .iter()
        .filter(|tx| tx.user_id == user_id)
        .collect();

    Json(serde_json::json!({
        "success": true,
        "data": {
            "user_id": user_id,
            "transactions": user_txs,
            "count": user_txs.len(),
        },
    }))
}

async fn get_compliance(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    let state = state.read().await;
    let gate = state
        .compliance
        .get(&user_id)
        .cloned()
        .unwrap_or_else(|| ComplianceGate::unverified(&user_id));

    Json(serde_json::json!({
        "success": true,
        "data": gate,
    }))
}

async fn update_compliance(
    State(state): State<SharedState>,
    Json(req): Json<ComplianceUpdateRequest>,
) -> impl IntoResponse {
    let mut state = state.write().await;

    let gate = state
        .compliance
        .entry(req.user_id.clone())
        .or_insert_with(|| ComplianceGate::unverified(&req.user_id));

    gate.status = req.status;

    if let Some(jurisdiction) = req.jurisdiction {
        gate.jurisdiction = Some(jurisdiction);
    }
    if let Some(restricted) = req.restricted_transfer {
        gate.restricted_transfer = restricted;
    }

    match req.status {
        ComplianceStatus::KycApproved => {
            gate.kyc_verified_at = Some(Utc::now());
        }
        ComplianceStatus::AccreditedInvestor => {
            gate.kyc_verified_at = Some(Utc::now());
            gate.accredited_verified_at = Some(Utc::now());
        }
        _ => {}
    }

    let gate_clone = gate.clone();

    // Also update the compliance gate inside the balance entry if it exists
    if let Some(balance) = state.balances.get_mut(&req.user_id) {
        balance.compliance = gate_clone.clone();
    }

    // Audit entry
    state.audit.append(
        "compliance_update",
        serde_json::json!({
            "user_id": req.user_id,
            "new_status": req.status,
        }),
    );

    info!(
        user_id = %req.user_id,
        status = ?req.status,
        "Compliance status updated"
    );

    Json(serde_json::json!({
        "success": true,
        "data": gate_clone,
    }))
}

async fn check_compliance(
    State(state): State<SharedState>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    let state = state.read().await;
    let gate = state
        .compliance
        .get(&user_id)
        .cloned()
        .unwrap_or_else(|| ComplianceGate::unverified(&user_id));

    let can_receive_standard = check_can_receive(&gate, 1_000.0);
    let can_receive_large = check_can_receive(&gate, 15_000.0);

    Json(serde_json::json!({
        "success": true,
        "data": {
            "user_id": user_id,
            "status": gate.status,
            "jurisdiction": gate.jurisdiction,
            "restricted_transfer": gate.restricted_transfer,
            "can_receive_standard": can_receive_standard.is_ok(),
            "can_receive_large": can_receive_large.is_ok(),
            "standard_check_error": can_receive_standard.err().map(|e| e.to_string()),
            "large_check_error": can_receive_large.err().map(|e| e.to_string()),
        },
    }))
}

// ─── Main ────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "token_manager=info,tower_http=info".into()),
        )
        .init();

    let state: SharedState = Arc::new(RwLock::new(AppState::new()));

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/tokens/balance/{user_id}", get(get_balance))
        .route("/api/tokens/credit", post(credit_tokens))
        .route("/api/tokens/debit", post(debit_tokens))
        .route("/api/tokens/transactions/{user_id}", get(get_transactions))
        .route("/api/compliance/{user_id}", get(get_compliance))
        .route("/api/compliance/update", post(update_compliance))
        .route("/api/compliance/check/{user_id}", get(check_compliance))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:3002";
    info!("Token Manager service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}
