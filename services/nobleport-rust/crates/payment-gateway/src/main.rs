mod audit;
mod providers;
mod treasury;

use std::sync::{Arc, Mutex};

use axum::{
    Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use common::{
    AuditChain, PaymentError, PaymentMethod, SwapStatus, TreasuryConfig,
    ETHEREUM_MAINNET_CHAIN_ID, MIN_CONFIRMATION_DEPTH, NOBLEPORT_ENS,
    NOBLEPORT_TREASURY, PAYMENT_METHOD_PRIORITY,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use providers::{
    MetaMaskProvider, PayPalProvider, PayPalWebhookHeaders, StripeProvider, UniswapProvider,
};
use treasury::TreasuryResolver;

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

/// Shared application state passed to all handlers via Axum's `State`.
pub struct AppState {
    pub stripe: Option<StripeProvider>,
    pub paypal: Option<PayPalProvider>,
    pub metamask: Option<MetaMaskProvider>,
    pub uniswap: Option<UniswapProvider>,
    pub treasury: TreasuryResolver,
    pub audit_chain: Mutex<AuditChain>,
}

type SharedState = Arc<AppState>;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct ProcessPaymentRequest {
    user_id: String,
    amount_usd: f64,
    package: String,
    method: PaymentMethod,
    /// Required for MetaMask payments.
    tx_hash: Option<String>,
}

#[derive(Debug, Serialize)]
struct ProcessPaymentResponse {
    success: bool,
    payment_id: Option<String>,
    redirect_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    verified_tx: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ConfirmPaymentRequest {
    method: PaymentMethod,
    /// For PayPal: the order_id to capture.
    order_id: Option<String>,
    /// For Stripe: the session_id to look up.
    session_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct ConfirmPaymentResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    confirmation: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QuoteRequest {
    user_id: String,
    token_in: String,
    token_out: String,
    amount_in: f64,
    #[serde(default = "default_slippage")]
    slippage_bps: u32,
}

fn default_slippage() -> u32 {
    50
}

#[derive(Debug, Deserialize)]
struct ApproveSwapRequest {
    intent_id: String,
    approver_id: String,
}

#[derive(Debug, Serialize)]
struct MethodInfo {
    method: PaymentMethod,
    enabled: bool,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    version: &'static str,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn health() -> impl IntoResponse {
    axum::Json(HealthResponse {
        status: "ok",
        service: "payment-gateway",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn get_payment_methods(State(state): State<SharedState>) -> impl IntoResponse {
    let methods: Vec<MethodInfo> = PAYMENT_METHOD_PRIORITY
        .iter()
        .map(|m| {
            let enabled = match m {
                PaymentMethod::Stripe => state.stripe.as_ref().is_some_and(|p| p.is_configured()),
                PaymentMethod::PayPal => state.paypal.as_ref().is_some_and(|p| p.is_configured()),
                PaymentMethod::MetaMask => {
                    state.metamask.as_ref().is_some_and(|p| p.is_configured())
                }
                PaymentMethod::Uniswap => {
                    state.uniswap.as_ref().is_some_and(|p| p.is_configured())
                }
            };
            MethodInfo {
                method: *m,
                enabled,
            }
        })
        .collect();

    axum::Json(serde_json::json!({ "methods": methods }))
}

async fn process_payment(
    State(state): State<SharedState>,
    axum::Json(req): axum::Json<ProcessPaymentRequest>,
) -> impl IntoResponse {
    info!(
        user_id = %req.user_id,
        method = ?req.method,
        amount_usd = req.amount_usd,
        "processing payment request"
    );

    audit::log_payment_event(
        &state,
        "payment_initiated",
        "pending",
        serde_json::json!({
            "user_id": req.user_id,
            "method": req.method,
            "amount_usd": req.amount_usd,
            "package": req.package,
        }),
    );

    match req.method {
        PaymentMethod::Stripe => {
            let Some(ref stripe) = state.stripe else {
                return error_response(StatusCode::BAD_REQUEST, "stripe is not configured");
            };
            match stripe
                .create_checkout(&req.user_id, req.amount_usd, &req.package, &state)
                .await
            {
                Ok((session_id, url)) => (
                    StatusCode::OK,
                    axum::Json(ProcessPaymentResponse {
                        success: true,
                        payment_id: Some(session_id),
                        redirect_url: Some(url),
                        error: None,
                        verified_tx: None,
                    }),
                ),
                Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
            }
        }
        PaymentMethod::PayPal => {
            let Some(ref paypal) = state.paypal else {
                return error_response(StatusCode::BAD_REQUEST, "paypal is not configured");
            };
            match paypal
                .create_order(&req.user_id, req.amount_usd, &req.package, &state)
                .await
            {
                Ok((order_id, url)) => (
                    StatusCode::OK,
                    axum::Json(ProcessPaymentResponse {
                        success: true,
                        payment_id: Some(order_id),
                        redirect_url: Some(url),
                        error: None,
                        verified_tx: None,
                    }),
                ),
                Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
            }
        }
        PaymentMethod::MetaMask => {
            let Some(ref metamask) = state.metamask else {
                return error_response(StatusCode::BAD_REQUEST, "metamask is not configured");
            };
            let Some(ref tx_hash) = req.tx_hash else {
                return error_response(StatusCode::BAD_REQUEST, "tx_hash is required for metamask");
            };
            match metamask
                .verify_transaction(
                    tx_hash,
                    ETHEREUM_MAINNET_CHAIN_ID,
                    MIN_CONFIRMATION_DEPTH,
                    &state,
                )
                .await
            {
                Ok(verified) => (
                    StatusCode::OK,
                    axum::Json(ProcessPaymentResponse {
                        success: true,
                        payment_id: Some(verified.tx_hash.clone()),
                        redirect_url: None,
                        error: None,
                        verified_tx: Some(serde_json::to_value(&verified).unwrap_or_default()),
                    }),
                ),
                Err(e) => {
                    let status = match &e {
                        PaymentError::InvalidChainId => StatusCode::BAD_REQUEST,
                        PaymentError::TreasuryMismatch => StatusCode::BAD_REQUEST,
                        PaymentError::InsufficientConfirmations => StatusCode::CONFLICT,
                        PaymentError::ReplayDetected => StatusCode::CONFLICT,
                        PaymentError::PriceLockExpired => StatusCode::GONE,
                        _ => StatusCode::INTERNAL_SERVER_ERROR,
                    };
                    error_response(status, &e.to_string())
                }
            }
        }
        PaymentMethod::Uniswap => {
            error_response(
                StatusCode::BAD_REQUEST,
                "uniswap payments must use /api/payment/uniswap/quote and /api/payment/uniswap/approve",
            )
        }
    }
}

async fn stripe_webhook(
    State(state): State<SharedState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let Some(ref stripe) = state.stripe else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            axum::Json(serde_json::json!({ "error": "stripe not configured" })),
        );
    };

    let signature = headers
        .get("Stripe-Signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if signature.is_empty() {
        warn!("stripe webhook: missing Stripe-Signature header");
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "missing signature" })),
        );
    }

    // MUST verify signature before processing.
    if let Err(e) = stripe.verify_webhook_signature(&body, signature) {
        error!(error = %e, "stripe webhook signature verification failed");
        return (
            StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        );
    }

    match stripe.process_webhook_event(&body, &state) {
        Ok(confirmation) => {
            info!(
                payment_id = %confirmation.id,
                "stripe webhook processed successfully"
            );
            (
                StatusCode::OK,
                axum::Json(serde_json::to_value(&confirmation).unwrap_or_default()),
            )
        }
        Err(e) => {
            // Non-checkout events return errors but should still ACK to Stripe.
            info!(error = %e, "stripe webhook event not actionable");
            (
                StatusCode::OK,
                axum::Json(serde_json::json!({ "received": true, "note": e.to_string() })),
            )
        }
    }
}

async fn paypal_webhook(
    State(state): State<SharedState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let Some(ref paypal) = state.paypal else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            axum::Json(serde_json::json!({ "error": "paypal not configured" })),
        );
    };

    let extract_header = |name: &str| -> String {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string()
    };

    let webhook_headers = PayPalWebhookHeaders {
        transmission_id: extract_header("PAYPAL-TRANSMISSION-ID"),
        timestamp: extract_header("PAYPAL-TRANSMISSION-TIME"),
        cert_url: extract_header("PAYPAL-CERT-URL"),
        auth_algo: extract_header("PAYPAL-AUTH-ALGO"),
        transmission_sig: extract_header("PAYPAL-TRANSMISSION-SIG"),
    };

    // Check that required headers are present.
    if webhook_headers.transmission_id.is_empty() || webhook_headers.transmission_sig.is_empty() {
        warn!("paypal webhook: missing required headers");
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "missing paypal webhook headers" })),
        );
    }

    // MUST verify signature before processing.
    if let Err(e) = paypal
        .verify_webhook_signature(&body, &webhook_headers)
        .await
    {
        error!(error = %e, "paypal webhook signature verification failed");
        return (
            StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        );
    }

    // Parse and handle the event.
    let event: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": format!("invalid json: {e}") })),
            );
        }
    };

    let event_type = event["event_type"].as_str().unwrap_or("unknown");
    info!(event_type = %event_type, "paypal webhook received");

    audit::log_payment_event(
        &state,
        &format!("paypal_webhook_{event_type}"),
        "webhook",
        serde_json::json!({ "event_type": event_type }),
    );

    (
        StatusCode::OK,
        axum::Json(serde_json::json!({ "received": true, "event_type": event_type })),
    )
}

async fn confirm_payment(
    State(state): State<SharedState>,
    axum::Json(req): axum::Json<ConfirmPaymentRequest>,
) -> impl IntoResponse {
    info!(method = ?req.method, "confirming payment");

    match req.method {
        PaymentMethod::PayPal => {
            let Some(ref paypal) = state.paypal else {
                return (
                    StatusCode::BAD_REQUEST,
                    axum::Json(ConfirmPaymentResponse {
                        success: false,
                        confirmation: None,
                        error: Some("paypal not configured".into()),
                    }),
                );
            };
            let Some(ref order_id) = req.order_id else {
                return (
                    StatusCode::BAD_REQUEST,
                    axum::Json(ConfirmPaymentResponse {
                        success: false,
                        confirmation: None,
                        error: Some("order_id is required for paypal".into()),
                    }),
                );
            };
            match paypal.capture_order(order_id, &state).await {
                Ok(conf) => (
                    StatusCode::OK,
                    axum::Json(ConfirmPaymentResponse {
                        success: true,
                        confirmation: Some(serde_json::to_value(&conf).unwrap_or_default()),
                        error: None,
                    }),
                ),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    axum::Json(ConfirmPaymentResponse {
                        success: false,
                        confirmation: None,
                        error: Some(e.to_string()),
                    }),
                ),
            }
        }
        PaymentMethod::Stripe => {
            // Stripe confirmation typically happens via webhook; this endpoint
            // is for redirect-based flows where the frontend needs to confirm.
            info!(session_id = ?req.session_id, "stripe confirmation via redirect");
            audit::log_payment_event(
                &state,
                "stripe_redirect_confirm",
                req.session_id.as_deref().unwrap_or("unknown"),
                serde_json::json!({ "session_id": req.session_id }),
            );
            (
                StatusCode::OK,
                axum::Json(ConfirmPaymentResponse {
                    success: true,
                    confirmation: Some(serde_json::json!({
                        "note": "payment confirmation is processed via webhook",
                        "session_id": req.session_id,
                    })),
                    error: None,
                }),
            )
        }
        _ => (
            StatusCode::BAD_REQUEST,
            axum::Json(ConfirmPaymentResponse {
                success: false,
                confirmation: None,
                error: Some(format!("{:?} does not support redirect confirmation", req.method)),
            }),
        ),
    }
}

async fn uniswap_quote(
    State(state): State<SharedState>,
    axum::Json(req): axum::Json<QuoteRequest>,
) -> impl IntoResponse {
    let Some(ref uniswap) = state.uniswap else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            axum::Json(serde_json::json!({ "error": "uniswap not configured" })),
        );
    };

    match uniswap
        .get_quote(
            &req.user_id,
            &req.token_in,
            &req.token_out,
            req.amount_in,
            req.slippage_bps,
            &state,
        )
        .await
    {
        Ok(intent) => {
            assert_eq!(intent.status, SwapStatus::Quoted);
            (
                StatusCode::OK,
                axum::Json(serde_json::to_value(&intent).unwrap_or_default()),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}

async fn uniswap_approve(
    State(state): State<SharedState>,
    axum::Json(req): axum::Json<ApproveSwapRequest>,
) -> impl IntoResponse {
    let Some(ref uniswap) = state.uniswap else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            axum::Json(serde_json::json!({ "error": "uniswap not configured" })),
        );
    };

    match uniswap
        .approve_swap(&req.intent_id, &req.approver_id, &state)
        .await
    {
        Ok(intent) => (
            StatusCode::OK,
            axum::Json(serde_json::to_value(&intent).unwrap_or_default()),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn error_response(
    status: StatusCode,
    message: &str,
) -> (StatusCode, axum::Json<ProcessPaymentResponse>) {
    (
        status,
        axum::Json(ProcessPaymentResponse {
            success: false,
            payment_id: None,
            redirect_url: None,
            error: Some(message.to_string()),
            verified_tx: None,
        }),
    )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    // 1. Load .env
    dotenvy::dotenv().ok();

    // 2. Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .json()
        .init();

    info!("payment-gateway starting");

    // 3. Build TreasuryResolver and verify on startup
    let treasury_address = std::env::var("TREASURY_ADDRESS")
        .unwrap_or_else(|_| NOBLEPORT_TREASURY.to_string());
    let ens_name = std::env::var("TREASURY_ENS")
        .unwrap_or_else(|_| NOBLEPORT_ENS.to_string());
    let allowlist_raw = std::env::var("TREASURY_ALLOWLIST").unwrap_or_default();
    let mut allowlist: Vec<String> = allowlist_raw
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    // Always include the primary treasury in the allowlist.
    if !allowlist.iter().any(|a| a.to_lowercase() == treasury_address.to_lowercase()) {
        allowlist.push(treasury_address.clone());
    }

    let mut treasury = TreasuryResolver::new(&treasury_address, &ens_name, allowlist.clone());

    let rpc_url = std::env::var("ETH_RPC_URL").unwrap_or_default();
    if !rpc_url.is_empty() {
        match treasury.resolve_and_verify(&rpc_url).await {
            Ok(addr) => info!(address = %addr, "treasury address verified on startup"),
            Err(e) => warn!(error = %e, "treasury ENS verification failed on startup (using pinned address)"),
        }
    } else {
        info!(
            address = %treasury_address,
            "no ETH_RPC_URL set -- using pinned treasury address without ENS verification"
        );
    }

    // 4. Construct all providers
    let treasury_config = TreasuryConfig {
        expected_address: treasury_address.clone(),
        ens_name: ens_name.clone(),
        resolved_address: treasury.config().resolved_address.clone(),
        allowlist,
        last_resolved: treasury.config().last_resolved,
        pinned: true,
    };

    let stripe = StripeProvider::from_env();
    let paypal = PayPalProvider::from_env();
    let metamask = MetaMaskProvider::from_env(treasury_config);
    let uniswap = UniswapProvider::from_env();

    // 7. Print status showing which providers are enabled
    info!(
        stripe = stripe.as_ref().is_some_and(|p| p.is_configured()),
        paypal = paypal.as_ref().is_some_and(|p| p.is_configured()),
        metamask = metamask.as_ref().is_some_and(|p| p.is_configured()),
        uniswap = uniswap.as_ref().is_some_and(|p| p.is_configured()),
        "provider status"
    );

    let state = Arc::new(AppState {
        stripe,
        paypal,
        metamask,
        uniswap,
        treasury,
        audit_chain: Mutex::new(AuditChain::new()),
    });

    // Log startup to audit chain.
    audit::log_payment_event(
        &state,
        "gateway_started",
        "system",
        serde_json::json!({
            "treasury_address": treasury_address,
            "ens_name": ens_name,
        }),
    );

    // 5. Build Axum router
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/payment/methods", get(get_payment_methods))
        .route("/api/payment/process", post(process_payment))
        .route("/api/payment/webhook/stripe", post(stripe_webhook))
        .route("/api/payment/webhook/paypal", post(paypal_webhook))
        .route("/api/payment/confirm", post(confirm_payment))
        .route("/api/payment/uniswap/quote", post(uniswap_quote))
        .route("/api/payment/uniswap/approve", post(uniswap_approve))
        .layer(
            tower_http::cors::CorsLayer::permissive()
        )
        .layer(
            tower_http::trace::TraceLayer::new_for_http()
        )
        .with_state(state);

    // 6. Listen on 0.0.0.0:3001
    let addr = "0.0.0.0:3001";
    info!(addr = %addr, "payment-gateway listening");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind to port 3001");

    axum::serve(listener, app)
        .await
        .expect("server error");
}
