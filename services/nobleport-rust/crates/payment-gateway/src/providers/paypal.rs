use chrono::Utc;
use common::{PaymentConfirmation, PaymentError, PaymentStatus};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::audit::log_payment_event;
use crate::AppState;

/// Headers extracted from a PayPal webhook request.
#[derive(Debug, Clone)]
pub struct PayPalWebhookHeaders {
    pub transmission_id: String,
    pub timestamp: String,
    pub cert_url: String,
    pub auth_algo: String,
    pub transmission_sig: String,
}

/// PayPal payment provider.
#[derive(Debug, Clone)]
pub struct PayPalProvider {
    pub client_id: String,
    pub client_secret: String,
    pub sandbox: bool,
    pub webhook_id: String,
}

impl PayPalProvider {
    pub fn from_env() -> Option<Self> {
        let client_id = std::env::var("PAYPAL_CLIENT_ID").ok()?;
        let client_secret = std::env::var("PAYPAL_CLIENT_SECRET").ok()?;
        let webhook_id = std::env::var("PAYPAL_WEBHOOK_ID").ok()?;
        if client_id.is_empty() || client_secret.is_empty() {
            return None;
        }
        let sandbox = std::env::var("PAYPAL_SANDBOX")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(true);
        Some(Self {
            client_id,
            client_secret,
            sandbox,
            webhook_id,
        })
    }

    /// Returns true if the provider has all required configuration.
    pub fn is_configured(&self) -> bool {
        !self.client_id.is_empty() && !self.client_secret.is_empty()
    }

    fn base_url(&self) -> &str {
        if self.sandbox {
            "https://api-m.sandbox.paypal.com"
        } else {
            "https://api-m.paypal.com"
        }
    }

    /// Obtain an OAuth2 access token from PayPal.
    pub async fn get_access_token(&self) -> Result<String, PaymentError> {
        let client = reqwest::Client::new();
        let resp = client
            .post(format!("{}/v1/oauth2/token", self.base_url()))
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("grant_type=client_credentials")
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("paypal auth request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            error!(status = %status, body = %body, "paypal token request failed");
            return Err(PaymentError::ProviderError(format!(
                "paypal auth returned {status}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("paypal json error: {e}")))?;

        body["access_token"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| PaymentError::ProviderError("missing access_token".into()))
    }

    /// Create a PayPal order.
    ///
    /// Returns `(order_id, approve_url)`.
    pub async fn create_order(
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
            "creating paypal order"
        );

        log_payment_event(
            state,
            "paypal_order_created",
            &payment_id,
            serde_json::json!({
                "user_id": user_id,
                "amount_usd": amount_usd,
                "package": package,
            }),
        );

        let access_token = self.get_access_token().await?;
        let client = reqwest::Client::new();
        let order_body = serde_json::json!({
            "intent": "CAPTURE",
            "purchase_units": [{
                "amount": {
                    "currency_code": "USD",
                    "value": format!("{:.2}", amount_usd),
                },
                "description": format!("NoblePort {} Package", package),
                "custom_id": payment_id,
            }],
            "application_context": {
                "return_url": format!(
                    "https://nobleport.io/payment/success?payment_id={}",
                    payment_id
                ),
                "cancel_url": "https://nobleport.io/payment/cancel",
            }
        });

        let resp = client
            .post(format!("{}/v2/checkout/orders", self.base_url()))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .json(&order_body)
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("paypal order request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            error!(status = %status, body = %body, "paypal order creation failed");
            return Err(PaymentError::ProviderError(format!(
                "paypal returned {status}: {body}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("paypal json error: {e}")))?;

        let order_id = body["id"]
            .as_str()
            .ok_or_else(|| PaymentError::ProviderError("missing order id".into()))?
            .to_string();

        let approve_url = body["links"]
            .as_array()
            .and_then(|links| {
                links
                    .iter()
                    .find(|l| l["rel"].as_str() == Some("approve"))
                    .and_then(|l| l["href"].as_str())
            })
            .ok_or_else(|| PaymentError::ProviderError("missing approve link".into()))?
            .to_string();

        info!(
            payment_id = %payment_id,
            order_id = %order_id,
            "paypal order created"
        );

        Ok((order_id, approve_url))
    }

    /// Verify a PayPal webhook signature by calling PayPal's verification API.
    pub async fn verify_webhook_signature(
        &self,
        payload: &[u8],
        headers: &PayPalWebhookHeaders,
    ) -> Result<(), PaymentError> {
        info!("verifying paypal webhook signature");

        let access_token = self.get_access_token().await?;

        let payload_json: serde_json::Value = serde_json::from_slice(payload)
            .map_err(|e| PaymentError::ProviderError(format!("invalid webhook json: {e}")))?;

        let verify_body = serde_json::json!({
            "auth_algo": headers.auth_algo,
            "cert_url": headers.cert_url,
            "transmission_id": headers.transmission_id,
            "transmission_sig": headers.transmission_sig,
            "transmission_time": headers.timestamp,
            "webhook_id": self.webhook_id,
            "webhook_event": payload_json,
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(format!(
                "{}/v1/notifications/verify-webhook-signature",
                self.base_url()
            ))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .json(&verify_body)
            .send()
            .await
            .map_err(|e| {
                PaymentError::ProviderError(format!("paypal verify request failed: {e}"))
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            error!(
                status = %status,
                body = %body,
                "paypal webhook verification request failed"
            );
            return Err(PaymentError::WebhookSignatureInvalid);
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("paypal json error: {e}")))?;

        let verification_status = body["verification_status"]
            .as_str()
            .unwrap_or("FAILURE");

        if verification_status != "SUCCESS" {
            warn!(
                verification_status = %verification_status,
                "paypal webhook signature verification failed"
            );
            return Err(PaymentError::WebhookSignatureInvalid);
        }

        info!("paypal webhook signature verified");
        Ok(())
    }

    /// Capture a previously approved PayPal order.
    pub async fn capture_order(
        &self,
        order_id: &str,
        state: &AppState,
    ) -> Result<PaymentConfirmation, PaymentError> {
        info!(order_id = %order_id, "capturing paypal order");

        let access_token = self.get_access_token().await?;
        let client = reqwest::Client::new();

        let resp = client
            .post(format!(
                "{}/v2/checkout/orders/{}/capture",
                self.base_url(),
                order_id
            ))
            .bearer_auth(&access_token)
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("paypal capture failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            error!(
                status = %status,
                body = %body,
                order_id = %order_id,
                "paypal order capture failed"
            );
            return Err(PaymentError::ProviderError(format!(
                "paypal capture returned {status}: {body}"
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("paypal json error: {e}")))?;

        let status_str = body["status"].as_str().unwrap_or("UNKNOWN");

        let payment_status = if status_str == "COMPLETED" {
            PaymentStatus::Completed
        } else {
            PaymentStatus::Failed
        };

        let amount_usd = body["purchase_units"][0]["payments"]["captures"][0]["amount"]["value"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);

        let custom_id = body["purchase_units"][0]["payments"]["captures"][0]["custom_id"]
            .as_str()
            .or_else(|| body["purchase_units"][0]["custom_id"].as_str())
            .unwrap_or("unknown");

        let payment_id = custom_id.to_string();

        log_payment_event(
            state,
            "paypal_payment_captured",
            &payment_id,
            serde_json::json!({
                "order_id": order_id,
                "amount_usd": amount_usd,
                "status": status_str,
            }),
        );

        info!(
            order_id = %order_id,
            payment_id = %payment_id,
            amount_usd = amount_usd,
            status = %status_str,
            "paypal order captured"
        );

        Ok(PaymentConfirmation {
            id: Uuid::new_v4(),
            user_id: "pending_resolution".to_string(),
            method: common::PaymentMethod::PayPal,
            amount_usd,
            tokens_credited: common::calculate_tokens(amount_usd, None),
            status: payment_status,
            external_id: Some(order_id.to_string()),
            tx_hash: None,
            chain_id: None,
            confirmation_depth: None,
            price_locked_at: None,
            metadata: Some(serde_json::json!({ "paypal_status": status_str })),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }
}
