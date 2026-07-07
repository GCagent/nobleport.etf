use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};
use uuid::Uuid;

use common::{
    calculate_tokens, AuditChain, PaymentError, PaymentMethod, PaymentStatus, SwapIntent,
    SwapStatus, TreasuryConfig, VerifiedTx, ETHEREUM_MAINNET_CHAIN_ID, MIN_CONFIRMATION_DEPTH,
    NOBLEPORT_TREASURY, PRICE_LOCK_MAX_AGE_SECS, STRIPE_TIMESTAMP_TOLERANCE_SECS,
};

// ─── Application State ───────────────────────────────────────────

type AppStateArc = Arc<RwLock<AppState>>;

struct AppState {
    stripe_key: Option<String>,
    stripe_webhook_secret: Option<String>,
    paypal_client_id: Option<String>,
    paypal_secret: Option<String>,
    rpc_url: Option<String>,
    treasury: TreasuryConfig,
    audit_chain: AuditChain,
    seen_tx_hashes: HashSet<String>,
    swap_intents: HashMap<Uuid, SwapIntent>,
    #[allow(dead_code)]
    price_cache: Option<(f64, DateTime<Utc>)>,
}

impl AppState {
    fn from_env() -> Self {
        Self {
            stripe_key: std::env::var("STRIPE_SECRET_KEY").ok(),
            stripe_webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET").ok(),
            paypal_client_id: std::env::var("PAYPAL_CLIENT_ID").ok(),
            paypal_secret: std::env::var("PAYPAL_SECRET").ok(),
            rpc_url: std::env::var("ETHEREUM_RPC_URL").ok(),
            treasury: TreasuryConfig::default_config(),
            audit_chain: AuditChain::new(),
            seen_tx_hashes: HashSet::new(),
            swap_intents: HashMap::new(),
            price_cache: None,
        }
    }
}

// ─── Request / Response Types ────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ProcessPaymentRequest {
    user_id: String,
    method: PaymentMethod,
    amount_usd: f64,
    package: Option<String>,
    // Stripe-specific
    stripe_payment_intent_id: Option<String>,
    // PayPal-specific
    paypal_order_id: Option<String>,
    // MetaMask / on-chain
    tx_hash: Option<String>,
    from_address: Option<String>,
    to_address: Option<String>,
    chain_id: Option<u64>,
    confirmations: Option<u64>,
    amount_wei: Option<String>,
    amount_eth: Option<f64>,
    price_usd_at_lock: Option<f64>,
    price_locked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
struct ProcessPaymentResponse {
    payment_id: Uuid,
    status: PaymentStatus,
    tokens_credited: i64,
    method: PaymentMethod,
    audit_hash: String,
}

#[derive(Debug, Serialize)]
struct PaymentMethodInfo {
    method: PaymentMethod,
    enabled: bool,
    label: &'static str,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    timestamp: DateTime<Utc>,
    audit_chain_length: usize,
    audit_chain_valid: bool,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
    code: &'static str,
}

#[derive(Debug, Deserialize)]
struct QuoteRequest {
    user_id: String,
    token_in: String,
    token_out: String,
    amount_in: f64,
    slippage_bps: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ApproveSwapRequest {
    intent_id: Uuid,
    approver_id: String,
}

#[derive(Debug, Serialize)]
struct SwapResponse {
    intent: SwapIntent,
    audit_hash: String,
}

// ─── Health ──────────────────────────────────────────────────────

async fn health(State(state): State<AppStateArc>) -> impl IntoResponse {
    let s = state.read().await;
    Json(HealthResponse {
        status: "ok",
        service: "payment-gateway",
        timestamp: Utc::now(),
        audit_chain_length: s.audit_chain.len(),
        audit_chain_valid: s.audit_chain.verify(),
    })
}

// ─── Payment Methods ─────────────────────────────────────────────

async fn get_payment_methods(State(state): State<AppStateArc>) -> impl IntoResponse {
    let s = state.read().await;
    let methods = vec![
        PaymentMethodInfo {
            method: PaymentMethod::Stripe,
            enabled: s.stripe_key.is_some(),
            label: "Credit / Debit Card (Stripe)",
        },
        PaymentMethodInfo {
            method: PaymentMethod::PayPal,
            enabled: s.paypal_client_id.is_some() && s.paypal_secret.is_some(),
            label: "PayPal",
        },
        PaymentMethodInfo {
            method: PaymentMethod::MetaMask,
            enabled: s.rpc_url.is_some(),
            label: "MetaMask (Ethereum)",
        },
        PaymentMethodInfo {
            method: PaymentMethod::Uniswap,
            enabled: s.rpc_url.is_some(),
            label: "Uniswap (Quote Only)",
        },
    ];
    Json(methods)
}

// ─── Process Payment (dispatcher) ────────────────────────────────

async fn process_payment(
    State(state): State<AppStateArc>,
    Json(req): Json<ProcessPaymentRequest>,
) -> Result<Json<ProcessPaymentResponse>, (StatusCode, Json<ErrorResponse>)> {
    match req.method {
        PaymentMethod::Stripe => process_stripe(state, req).await,
        PaymentMethod::PayPal => process_paypal(state, req).await,
        PaymentMethod::MetaMask => process_metamask(state, req).await,
        PaymentMethod::Uniswap => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Uniswap payments must go through /api/payment/uniswap/quote and /api/payment/uniswap/approve".into(),
                code: "UNISWAP_USE_DEDICATED_ENDPOINTS",
            }),
        )),
    }
}

// ─── Stripe Processing ──────────────────────────────────────────

async fn process_stripe(
    state: AppStateArc,
    req: ProcessPaymentRequest,
) -> Result<Json<ProcessPaymentResponse>, (StatusCode, Json<ErrorResponse>)> {
    let intent_id = req.stripe_payment_intent_id.as_deref().ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "stripe_payment_intent_id is required".into(),
                code: "MISSING_FIELD",
            }),
        )
    })?;

    let tokens = calculate_tokens(req.amount_usd, req.package.as_deref());
    let payment_id = Uuid::new_v4();

    let mut s = state.write().await;
    let entry = s.audit_chain.append(
        "stripe_payment_submitted",
        serde_json::json!({
            "payment_id": payment_id.to_string(),
            "user_id": &req.user_id,
            "amount_usd": req.amount_usd,
            "stripe_intent": intent_id,
            "tokens": tokens,
        }),
    );

    info!(
        payment_id = %payment_id,
        user_id = %req.user_id,
        amount = req.amount_usd,
        "Stripe payment submitted — tokens pending webhook confirmation"
    );

    Ok(Json(ProcessPaymentResponse {
        payment_id,
        status: PaymentStatus::Pending,
        tokens_credited: 0, // tokens credited only on webhook confirmation
        method: PaymentMethod::Stripe,
        audit_hash: entry.hash,
    }))
}

// ─── PayPal Processing ──────────────────────────────────────────

async fn process_paypal(
    state: AppStateArc,
    req: ProcessPaymentRequest,
) -> Result<Json<ProcessPaymentResponse>, (StatusCode, Json<ErrorResponse>)> {
    let order_id = req.paypal_order_id.as_deref().ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "paypal_order_id is required".into(),
                code: "MISSING_FIELD",
            }),
        )
    })?;

    let tokens = calculate_tokens(req.amount_usd, req.package.as_deref());
    let payment_id = Uuid::new_v4();

    let mut s = state.write().await;
    let entry = s.audit_chain.append(
        "paypal_payment_submitted",
        serde_json::json!({
            "payment_id": payment_id.to_string(),
            "user_id": &req.user_id,
            "amount_usd": req.amount_usd,
            "paypal_order_id": order_id,
            "tokens": tokens,
        }),
    );

    info!(
        payment_id = %payment_id,
        user_id = %req.user_id,
        amount = req.amount_usd,
        "PayPal payment submitted — tokens pending webhook confirmation"
    );

    Ok(Json(ProcessPaymentResponse {
        payment_id,
        status: PaymentStatus::Pending,
        tokens_credited: 0, // tokens credited only on webhook confirmation
        method: PaymentMethod::PayPal,
        audit_hash: entry.hash,
    }))
}

// ─── MetaMask Processing ────────────────────────────────────────

async fn process_metamask(
    state: AppStateArc,
    req: ProcessPaymentRequest,
) -> Result<Json<ProcessPaymentResponse>, (StatusCode, Json<ErrorResponse>)> {
    let tx_hash = req.tx_hash.as_deref().ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "tx_hash is required for MetaMask payments".into(),
                code: "MISSING_FIELD",
            }),
        )
    })?;
    let to_address = req.to_address.as_deref().ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "to_address is required".into(),
                code: "MISSING_FIELD",
            }),
        )
    })?;
    let chain_id = req.chain_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "chain_id is required".into(),
                code: "MISSING_FIELD",
            }),
        )
    })?;
    let confirmations = req.confirmations.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "confirmations is required".into(),
                code: "MISSING_FIELD",
            }),
        )
    })?;
    let price_locked_at = req.price_locked_at.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "price_locked_at is required".into(),
                code: "MISSING_FIELD",
            }),
        )
    })?;

    // 1. Chain ID must be Ethereum mainnet
    if chain_id != ETHEREUM_MAINNET_CHAIN_ID {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: PaymentError::InvalidChainId {
                    expected: ETHEREUM_MAINNET_CHAIN_ID,
                    got: chain_id,
                }
                .to_string(),
                code: "INVALID_CHAIN_ID",
            }),
        ));
    }

    // 2. Recipient must match treasury (case-insensitive)
    let mut s = state.write().await;
    if let Err(e) = s.treasury.verify_recipient(to_address) {
        s.audit_chain.append(
            "metamask_treasury_mismatch",
            serde_json::json!({
                "tx_hash": tx_hash,
                "to_address": to_address,
                "error": e.to_string(),
            }),
        );
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: e.to_string(),
                code: "TREASURY_MISMATCH",
            }),
        ));
    }

    // 3. Sufficient confirmations
    if confirmations < MIN_CONFIRMATION_DEPTH {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: PaymentError::InsufficientConfirmations {
                    required: MIN_CONFIRMATION_DEPTH,
                    got: confirmations,
                }
                .to_string(),
                code: "INSUFFICIENT_CONFIRMATIONS",
            }),
        ));
    }

    // 4. Replay protection
    if s.seen_tx_hashes.contains(tx_hash) {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: PaymentError::ReplayDetected {
                    tx_hash: tx_hash.to_string(),
                }
                .to_string(),
                code: "REPLAY_DETECTED",
            }),
        ));
    }

    // 5. Price lock freshness
    let age = Utc::now()
        .signed_duration_since(price_locked_at)
        .num_seconds();
    if age > PRICE_LOCK_MAX_AGE_SECS {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: PaymentError::PriceLockExpired {
                    max_age_secs: PRICE_LOCK_MAX_AGE_SECS,
                }
                .to_string(),
                code: "PRICE_LOCK_EXPIRED",
            }),
        ));
    }

    // All checks passed — credit tokens
    let tokens = calculate_tokens(req.amount_usd, req.package.as_deref());
    let payment_id = Uuid::new_v4();

    s.seen_tx_hashes.insert(tx_hash.to_string());

    let verified = VerifiedTx {
        tx_hash: tx_hash.to_string(),
        from_address: req.from_address.clone().unwrap_or_default(),
        to_address: to_address.to_string(),
        amount_wei: req.amount_wei.clone().unwrap_or_default(),
        amount_eth: req.amount_eth.unwrap_or(0.0),
        amount_usd: req.amount_usd,
        chain_id,
        block_number: 0, // would be fetched from RPC in production
        confirmations,
        price_usd_at_lock: req.price_usd_at_lock.unwrap_or(0.0),
        price_locked_at,
    };

    let entry = s.audit_chain.append(
        "metamask_payment_verified",
        serde_json::json!({
            "payment_id": payment_id.to_string(),
            "user_id": &req.user_id,
            "verified_tx": serde_json::to_value(&verified).unwrap_or_default(),
            "tokens_credited": tokens,
        }),
    );

    info!(
        payment_id = %payment_id,
        user_id = %req.user_id,
        tx_hash = %tx_hash,
        tokens = tokens,
        "MetaMask payment verified and tokens credited"
    );

    Ok(Json(ProcessPaymentResponse {
        payment_id,
        status: PaymentStatus::Completed,
        tokens_credited: tokens,
        method: PaymentMethod::MetaMask,
        audit_hash: entry.hash,
    }))
}

// ─── Stripe Webhook ─────────────────────────────────────────────

async fn stripe_webhook(
    State(state): State<AppStateArc>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let sig_header = headers
        .get("Stripe-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Missing Stripe-Signature header".into(),
                    code: "MISSING_SIGNATURE",
                }),
            )
        })?;

    let s = state.read().await;
    let webhook_secret = s.stripe_webhook_secret.as_deref().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Stripe webhook secret not configured".into(),
                code: "CONFIG_ERROR",
            }),
        )
    })?;

    // Parse t= and v1= from the signature header
    let mut timestamp_str: Option<&str> = None;
    let mut signature_hex: Option<&str> = None;

    for part in sig_header.split(',') {
        let part = part.trim();
        if let Some(t) = part.strip_prefix("t=") {
            timestamp_str = Some(t);
        } else if let Some(v) = part.strip_prefix("v1=") {
            signature_hex = Some(v);
        }
    }

    let timestamp_str = timestamp_str.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Missing t= in Stripe-Signature".into(),
                code: "INVALID_SIGNATURE",
            }),
        )
    })?;
    let signature_hex = signature_hex.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Missing v1= in Stripe-Signature".into(),
                code: "INVALID_SIGNATURE",
            }),
        )
    })?;

    // Verify timestamp drift
    let timestamp: i64 = timestamp_str.parse().map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid timestamp in Stripe-Signature".into(),
                code: "INVALID_SIGNATURE",
            }),
        )
    })?;

    let now = Utc::now().timestamp();
    let drift = (now - timestamp).abs();
    if drift > STRIPE_TIMESTAMP_TOLERANCE_SECS {
        warn!(drift, "Stripe webhook timestamp drift exceeds tolerance");
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!(
                    "Webhook timestamp drift {}s exceeds {}s tolerance",
                    drift, STRIPE_TIMESTAMP_TOLERANCE_SECS
                ),
                code: "TIMESTAMP_DRIFT",
            }),
        ));
    }

    // Compute HMAC-SHA256 of "{timestamp}.{payload}"
    let signed_payload = format!("{}.{}", timestamp_str, &body);
    let mut mac = Hmac::<Sha256>::new_from_slice(webhook_secret.as_bytes()).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "HMAC key error".into(),
                code: "INTERNAL_ERROR",
            }),
        )
    })?;
    mac.update(signed_payload.as_bytes());

    let expected_sig = hex::encode(mac.finalize().into_bytes());

    if !constant_time_eq(expected_sig.as_bytes(), signature_hex.as_bytes()) {
        error!("Stripe webhook signature mismatch");
        let mut s = state.write().await;
        s.audit_chain.append(
            "stripe_webhook_sig_invalid",
            serde_json::json!({
                "timestamp": timestamp_str,
                "drift_seconds": drift,
            }),
        );
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: PaymentError::WebhookSignatureInvalid.to_string(),
                code: "SIGNATURE_INVALID",
            }),
        ));
    }
    drop(s);

    // Signature valid — parse event and credit tokens
    let event: serde_json::Value = serde_json::from_str(&body).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Invalid JSON body: {}", e),
                code: "INVALID_BODY",
            }),
        )
    })?;

    let event_type = event["type"].as_str().unwrap_or("unknown");

    let mut s = state.write().await;

    if event_type == "payment_intent.succeeded" {
        let amount_cents = event["data"]["object"]["amount"].as_f64().unwrap_or(0.0);
        let amount_usd = amount_cents / 100.0;
        let metadata = &event["data"]["object"]["metadata"];
        let user_id = metadata["user_id"].as_str().unwrap_or("unknown");
        let package = metadata["package"].as_str();

        let tokens = calculate_tokens(amount_usd, package);
        let payment_id = Uuid::new_v4();

        let entry = s.audit_chain.append(
            "stripe_webhook_payment_succeeded",
            serde_json::json!({
                "payment_id": payment_id.to_string(),
                "user_id": user_id,
                "amount_usd": amount_usd,
                "tokens_credited": tokens,
                "stripe_event_type": event_type,
            }),
        );

        info!(
            payment_id = %payment_id,
            user_id,
            tokens,
            "Stripe webhook: tokens credited"
        );

        return Ok(Json(serde_json::json!({
            "received": true,
            "event_type": event_type,
            "payment_id": payment_id.to_string(),
            "tokens_credited": tokens,
            "audit_hash": entry.hash,
        })));
    }

    // Non-crediting events: just audit and acknowledge
    let entry = s.audit_chain.append(
        "stripe_webhook_received",
        serde_json::json!({
            "event_type": event_type,
        }),
    );

    Ok(Json(serde_json::json!({
        "received": true,
        "event_type": event_type,
        "audit_hash": entry.hash,
    })))
}

// ─── PayPal Webhook ─────────────────────────────────────────────

async fn paypal_webhook(
    State(state): State<AppStateArc>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let s = state.read().await;
    let client_id = s.paypal_client_id.clone().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "PayPal client_id not configured".into(),
                code: "CONFIG_ERROR",
            }),
        )
    })?;
    let secret = s.paypal_secret.clone().ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "PayPal secret not configured".into(),
                code: "CONFIG_ERROR",
            }),
        )
    })?;
    drop(s);

    // Extract PayPal headers for verification
    let transmission_id = header_str(&headers, "PAYPAL-TRANSMISSION-ID");
    let transmission_time = header_str(&headers, "PAYPAL-TRANSMISSION-TIME");
    let transmission_sig = header_str(&headers, "PAYPAL-TRANSMISSION-SIG");
    let cert_url = header_str(&headers, "PAYPAL-CERT-URL");
    let auth_algo = header_str(&headers, "PAYPAL-AUTH-ALGO");
    let webhook_id = std::env::var("PAYPAL_WEBHOOK_ID").unwrap_or_default();

    // Verify with PayPal's notification verification API
    let verify_payload = serde_json::json!({
        "auth_algo": auth_algo,
        "cert_url": cert_url,
        "transmission_id": transmission_id,
        "transmission_sig": transmission_sig,
        "transmission_time": transmission_time,
        "webhook_id": webhook_id,
        "webhook_event": serde_json::from_str::<serde_json::Value>(&body).unwrap_or_default(),
    });

    let client = reqwest::Client::new();
    let token_resp = client
        .post("https://api-m.paypal.com/v1/oauth2/token")
        .basic_auth(&client_id, Some(&secret))
        .form(&[("grant_type", "client_credentials")])
        .send()
        .await
        .map_err(|e| {
            error!("PayPal token request failed: {e}");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("PayPal auth error: {}", e),
                    code: "PAYPAL_AUTH_ERROR",
                }),
            )
        })?;

    let token_json: serde_json::Value = token_resp.json().await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("PayPal token parse error: {}", e),
                code: "PAYPAL_AUTH_ERROR",
            }),
        )
    })?;

    let access_token = token_json["access_token"].as_str().ok_or_else(|| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: "No access_token in PayPal response".into(),
                code: "PAYPAL_AUTH_ERROR",
            }),
        )
    })?;

    let verify_resp = client
        .post("https://api-m.paypal.com/v1/notifications/verify-webhook-signature")
        .bearer_auth(access_token)
        .json(&verify_payload)
        .send()
        .await
        .map_err(|e| {
            error!("PayPal verification request failed: {e}");
            (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: format!("PayPal verify error: {}", e),
                    code: "PAYPAL_VERIFY_ERROR",
                }),
            )
        })?;

    let verify_json: serde_json::Value = verify_resp.json().await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("PayPal verify parse error: {}", e),
                code: "PAYPAL_VERIFY_ERROR",
            }),
        )
    })?;

    let verification_status = verify_json["verification_status"]
        .as_str()
        .unwrap_or("FAILURE");

    if verification_status != "SUCCESS" {
        error!(status = verification_status, "PayPal webhook verification failed");
        let mut s = state.write().await;
        s.audit_chain.append(
            "paypal_webhook_sig_invalid",
            serde_json::json!({
                "verification_status": verification_status,
                "transmission_id": &transmission_id,
            }),
        );
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: PaymentError::WebhookSignatureInvalid.to_string(),
                code: "SIGNATURE_INVALID",
            }),
        ));
    }

    // Verification passed — parse event and credit tokens
    let event: serde_json::Value = serde_json::from_str(&body).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Invalid JSON: {}", e),
                code: "INVALID_BODY",
            }),
        )
    })?;

    let event_type = event["event_type"].as_str().unwrap_or("unknown");

    let mut s = state.write().await;

    if event_type == "PAYMENT.CAPTURE.COMPLETED" {
        let resource = &event["resource"];
        let amount_str = resource["amount"]["value"].as_str().unwrap_or("0");
        let amount_usd: f64 = amount_str.parse().unwrap_or(0.0);
        let user_id = resource["custom_id"].as_str().unwrap_or("unknown");

        let tokens = calculate_tokens(amount_usd, None);
        let payment_id = Uuid::new_v4();

        let entry = s.audit_chain.append(
            "paypal_webhook_payment_completed",
            serde_json::json!({
                "payment_id": payment_id.to_string(),
                "user_id": user_id,
                "amount_usd": amount_usd,
                "tokens_credited": tokens,
                "paypal_event_type": event_type,
            }),
        );

        info!(
            payment_id = %payment_id,
            user_id,
            tokens,
            "PayPal webhook: tokens credited"
        );

        return Ok(Json(serde_json::json!({
            "received": true,
            "event_type": event_type,
            "payment_id": payment_id.to_string(),
            "tokens_credited": tokens,
            "audit_hash": entry.hash,
        })));
    }

    let entry = s.audit_chain.append(
        "paypal_webhook_received",
        serde_json::json!({
            "event_type": event_type,
        }),
    );

    Ok(Json(serde_json::json!({
        "received": true,
        "event_type": event_type,
        "audit_hash": entry.hash,
    })))
}

// ─── Uniswap Quote ──────────────────────────────────────────────

async fn uniswap_quote(
    State(state): State<AppStateArc>,
    Json(req): Json<QuoteRequest>,
) -> Result<Json<SwapResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Simulated quote — in production this would call Uniswap's Quoter contract
    let estimated_out = req.amount_in * 0.997; // 0.3% fee approximation
    let slippage = req.slippage_bps.unwrap_or(50); // default 0.5%

    let intent = SwapIntent {
        intent_id: Uuid::new_v4(),
        user_id: req.user_id.clone(),
        token_in: req.token_in.clone(),
        token_out: req.token_out.clone(),
        amount_in: req.amount_in,
        estimated_out,
        slippage_bps: slippage,
        status: SwapStatus::Quoted,
        approved_by: None,
        created_at: Utc::now(),
    };

    let mut s = state.write().await;
    s.swap_intents.insert(intent.intent_id, intent.clone());

    let entry = s.audit_chain.append(
        "uniswap_quote_created",
        serde_json::json!({
            "intent_id": intent.intent_id.to_string(),
            "user_id": &req.user_id,
            "token_in": &req.token_in,
            "token_out": &req.token_out,
            "amount_in": req.amount_in,
            "estimated_out": estimated_out,
            "slippage_bps": slippage,
        }),
    );

    info!(
        intent_id = %intent.intent_id,
        user_id = %req.user_id,
        "Uniswap quote created"
    );

    Ok(Json(SwapResponse {
        intent,
        audit_hash: entry.hash,
    }))
}

// ─── Uniswap Approve ────────────────────────────────────────────

async fn uniswap_approve(
    State(state): State<AppStateArc>,
    Json(req): Json<ApproveSwapRequest>,
) -> Result<Json<SwapResponse>, (StatusCode, Json<ErrorResponse>)> {
    let mut s = state.write().await;

    let intent = s.swap_intents.get_mut(&req.intent_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Swap intent {} not found", req.intent_id),
                code: "NOT_FOUND",
            }),
        )
    })?;

    if intent.status != SwapStatus::Quoted {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: format!(
                    "Swap intent is in {:?} state, expected Quoted",
                    intent.status
                ),
                code: "INVALID_STATE",
            }),
        ));
    }

    // Human approval gate — mark as approved but do NOT execute
    intent.status = SwapStatus::Approved;
    intent.approved_by = Some(req.approver_id.clone());
    let approved_intent = intent.clone();

    let entry = s.audit_chain.append(
        "uniswap_swap_approved",
        serde_json::json!({
            "intent_id": req.intent_id.to_string(),
            "approver_id": &req.approver_id,
            "status": "approved",
            "note": "On-chain execution requires custodian signer",
        }),
    );

    info!(
        intent_id = %req.intent_id,
        approver = %req.approver_id,
        "Uniswap swap approved — awaiting custodian execution"
    );

    Ok(Json(SwapResponse {
        intent: approved_intent,
        audit_hash: entry.hash,
    }))
}

// ─── Helpers ─────────────────────────────────────────────────────

fn header_str(headers: &HeaderMap, name: &str) -> String {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string()
}

/// Constant-time comparison to prevent timing attacks on signatures.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

// ─── Main ────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    // Load environment
    dotenvy::dotenv().ok();

    // Init tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "payment_gateway=info,tower_http=info".into()),
        )
        .init();

    // Build state
    let state = AppState::from_env();

    // Print enabled providers
    info!("Payment Gateway starting");
    info!(
        stripe = state.stripe_key.is_some(),
        paypal = state.paypal_client_id.is_some() && state.paypal_secret.is_some(),
        metamask = state.rpc_url.is_some(),
        uniswap = state.rpc_url.is_some(),
        treasury = %NOBLEPORT_TREASURY,
        "Provider status"
    );

    let shared_state: AppStateArc = Arc::new(RwLock::new(state));

    // Build router
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/payment/methods", get(get_payment_methods))
        .route("/api/payment/process", post(process_payment))
        .route("/api/payment/webhook/stripe", post(stripe_webhook))
        .route("/api/payment/webhook/paypal", post(paypal_webhook))
        .route("/api/payment/uniswap/quote", post(uniswap_quote))
        .route("/api/payment/uniswap/approve", post(uniswap_approve))
        .layer(CorsLayer::permissive())
        .with_state(shared_state);

    // Serve
    let addr = "0.0.0.0:3001";
    info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to port 3001");
    axum::serve(listener, app)
        .await
        .expect("Server error");
}
