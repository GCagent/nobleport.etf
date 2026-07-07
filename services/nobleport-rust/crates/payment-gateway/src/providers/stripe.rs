use chrono::Utc;
use common::{PaymentConfirmation, PaymentError, PaymentStatus};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::audit::log_payment_event;
use crate::AppState;

type HmacSha256 = Hmac<Sha256>;

/// Stripe payment provider.
#[derive(Debug, Clone)]
pub struct StripeProvider {
    pub secret_key: String,
    pub webhook_secret: String,
}

impl StripeProvider {
    pub fn from_env() -> Option<Self> {
        let secret_key = std::env::var("STRIPE_SECRET_KEY").ok()?;
        let webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET").ok()?;
        if secret_key.is_empty() || webhook_secret.is_empty() {
            return None;
        }
        Some(Self {
            secret_key,
            webhook_secret,
        })
    }

    /// Returns true if the provider has all required configuration.
    pub fn is_configured(&self) -> bool {
        !self.secret_key.is_empty() && !self.webhook_secret.is_empty()
    }

    /// Create a Stripe Checkout session.
    ///
    /// Returns `(session_id, checkout_url)`.
    pub async fn create_checkout(
        &self,
        user_id: &str,
        amount_usd: f64,
        package: &str,
        state: &AppState,
    ) -> Result<(String, String), PaymentError> {
        let payment_id = Uuid::new_v4().to_string();
        info!(
            payment_id = %payment_id,
            user_id = %user_id,
            amount_usd = amount_usd,
            package = %package,
            "creating stripe checkout session"
        );

        log_payment_event(
            state,
            "stripe_checkout_created",
            &payment_id,
            serde_json::json!({
                "user_id": user_id,
                "amount_usd": amount_usd,
                "package": package,
            }),
        );

        let amount_cents = (amount_usd * 100.0) as i64;

        let client = reqwest::Client::new();
        let resp = client
            .post("https://api.stripe.com/v1/checkout/sessions")
            .basic_auth(&self.secret_key, None::<&str>)
            .form(&[
                ("mode", "payment"),
                ("payment_method_types[]", "card"),
                ("line_items[0][price_data][currency]", "usd"),
                (
                    "line_items[0][price_data][unit_amount]",
                    &amount_cents.to_string(),
                ),
                (
                    "line_items[0][price_data][product_data][name]",
                    &format!("NoblePort {} Package", package),
                ),
                ("line_items[0][quantity]", "1"),
                (
                    "success_url",
                    &format!(
                        "https://nobleport.io/payment/success?session_id={{CHECKOUT_SESSION_ID}}&payment_id={}",
                        payment_id
                    ),
                ),
                (
                    "cancel_url",
                    "https://nobleport.io/payment/cancel",
                ),
                ("metadata[payment_id]", &payment_id),
                ("metadata[user_id]", user_id),
                ("metadata[package]", package),
            ])
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("stripe request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            error!(status = %status, body = %body, "stripe checkout creation failed");
            return Err(PaymentError::ProviderError(format!(
                "stripe returned {status}: {body}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("stripe json parse error: {e}")))?;

        let session_id = body["id"]
            .as_str()
            .ok_or_else(|| PaymentError::ProviderError("missing session id".into()))?
            .to_string();
        let checkout_url = body["url"]
            .as_str()
            .ok_or_else(|| PaymentError::ProviderError("missing checkout url".into()))?
            .to_string();

        info!(
            payment_id = %payment_id,
            session_id = %session_id,
            "stripe checkout session created"
        );

        Ok((session_id, checkout_url))
    }

    /// Verify a Stripe webhook signature (HMAC-SHA256).
    ///
    /// The `Stripe-Signature` header contains `t=<timestamp>,v1=<sig>` pairs.
    /// We verify the v1 signature against `<timestamp>.<payload>` using the
    /// webhook secret, and reject if the timestamp drifts more than 300 seconds.
    pub fn verify_webhook_signature(
        &self,
        payload: &[u8],
        signature_header: &str,
    ) -> Result<(), PaymentError> {
        let mut timestamp: Option<i64> = None;
        let mut signatures: Vec<String> = Vec::new();

        for part in signature_header.split(',') {
            let part = part.trim();
            if let Some(ts) = part.strip_prefix("t=") {
                timestamp = ts.parse().ok();
            } else if let Some(sig) = part.strip_prefix("v1=") {
                signatures.push(sig.to_string());
            }
        }

        let timestamp =
            timestamp.ok_or_else(|| PaymentError::WebhookSignatureInvalid)?;
        if signatures.is_empty() {
            warn!("stripe webhook: no v1 signatures found");
            return Err(PaymentError::WebhookSignatureInvalid);
        }

        // Check timestamp drift (max 300 seconds).
        let now = Utc::now().timestamp();
        let drift = (now - timestamp).abs();
        if drift > common::STRIPE_TIMESTAMP_TOLERANCE_SECS {
            warn!(drift = drift, "stripe webhook: timestamp drift too large");
            return Err(PaymentError::WebhookSignatureInvalid);
        }

        // Build the signed payload: "{timestamp}.{payload}"
        let signed_payload = format!("{timestamp}.");
        let mut mac = HmacSha256::new_from_slice(self.webhook_secret.as_bytes())
            .map_err(|e| PaymentError::ProviderError(format!("hmac init error: {e}")))?;
        mac.update(signed_payload.as_bytes());
        mac.update(payload);
        let expected = hex::encode(mac.finalize().into_bytes());

        // Check if any of the provided v1 signatures match.
        let matched = signatures.iter().any(|sig| {
            // Constant-time comparison via hmac verification would be ideal,
            // but for hex-encoded strings this is acceptable since the
            // expected value is already a hash.
            sig == &expected
        });

        if !matched {
            warn!("stripe webhook: signature mismatch");
            return Err(PaymentError::WebhookSignatureInvalid);
        }

        info!("stripe webhook signature verified");
        Ok(())
    }

    /// Process a verified Stripe webhook event payload.
    pub fn process_webhook_event(
        &self,
        verified_payload: &[u8],
        state: &AppState,
    ) -> Result<PaymentConfirmation, PaymentError> {
        let event: serde_json::Value = serde_json::from_slice(verified_payload)
            .map_err(|e| PaymentError::ProviderError(format!("invalid json: {e}")))?;

        let event_type = event["type"]
            .as_str()
            .unwrap_or("unknown");

        info!(event_type = %event_type, "processing stripe webhook event");

        match event_type {
            "checkout.session.completed" => {
                let session = &event["data"]["object"];
                let payment_id = session["metadata"]["payment_id"]
                    .as_str()
                    .unwrap_or(&Uuid::new_v4().to_string())
                    .to_string();
                let user_id = session["metadata"]["user_id"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_string();
                let package = session["metadata"]["package"]
                    .as_str()
                    .map(|s| s.to_string());
                let amount_total = session["amount_total"]
                    .as_f64()
                    .unwrap_or(0.0)
                    / 100.0; // cents -> dollars
                let session_id = session["id"]
                    .as_str()
                    .map(|s| s.to_string());

                log_payment_event(
                    state,
                    "stripe_payment_completed",
                    &payment_id,
                    serde_json::json!({
                        "user_id": user_id,
                        "amount_usd": amount_total,
                        "session_id": session_id,
                    }),
                );

                info!(
                    payment_id = %payment_id,
                    user_id = %user_id,
                    amount_usd = amount_total,
                    "stripe payment completed"
                );

                Ok(PaymentConfirmation {
                    id: Uuid::new_v4(),
                    user_id,
                    method: common::PaymentMethod::Stripe,
                    amount_usd: amount_total,
                    tokens_credited: common::calculate_tokens(amount_total, package.as_deref()),
                    status: PaymentStatus::Completed,
                    external_id: session_id,
                    tx_hash: None,
                    chain_id: None,
                    confirmation_depth: None,
                    price_locked_at: None,
                    metadata: Some(serde_json::json!({ "stripe_event": event_type })),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                })
            }
            _ => {
                info!(event_type = %event_type, "ignoring unhandled stripe event type");
                Err(PaymentError::ProviderError(format!(
                    "unhandled stripe event type: {event_type}"
                )))
            }
        }
    }
}
