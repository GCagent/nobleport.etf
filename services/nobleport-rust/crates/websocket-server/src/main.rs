use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::stream::StreamExt;
use futures_util::SinkExt;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};

// ---------------------------------------------------------------------------
// Notification event types
// ---------------------------------------------------------------------------

/// Events that the WebSocket server can broadcast to connected clients.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NotificationEvent {
    PaymentReceived {
        payment_id: String,
        method: String,
        amount_usd: f64,
    },
    TokensCredited {
        user_id: String,
        amount: i64,
        balance_after: i64,
    },
    ComplianceUpdated {
        user_id: String,
        status: String,
    },
    SwapQuoted {
        intent_id: String,
        token_in: String,
        token_out: String,
        estimated_out: f64,
    },
    SwapApproved {
        intent_id: String,
        approved_by: String,
    },
    AuditEvent {
        event_type: String,
        details: String,
    },
    SystemAlert {
        level: String,
        message: String,
    },
}

impl NotificationEvent {
    /// Extract the `user_id` field from events that carry one, if present.
    fn user_id(&self) -> Option<&str> {
        match self {
            NotificationEvent::TokensCredited { user_id, .. }
            | NotificationEvent::ComplianceUpdated { user_id, .. } => Some(user_id),
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// Inbound notification payload (POST /api/notify)
// ---------------------------------------------------------------------------

/// JSON body accepted by the internal notification endpoint.
#[derive(Debug, Deserialize)]
struct NotifyRequest {
    event: NotificationEvent,
}

// ---------------------------------------------------------------------------
// Client subscription message
// ---------------------------------------------------------------------------

/// Clients may optionally send this to filter events by user_id.
#[derive(Debug, Deserialize)]
struct SubscribeMessage {
    subscribe: String,
}

// ---------------------------------------------------------------------------
// Shared application state
// ---------------------------------------------------------------------------

/// State shared across all handlers via Axum's state extractor.
struct AppState {
    /// Broadcast sender for fan-out to all WebSocket connections.
    tx: broadcast::Sender<String>,
    /// Number of currently connected WebSocket clients.
    connection_count: AtomicUsize,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /health — liveness check with connection count.
async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let connections = state.connection_count.load(Ordering::Relaxed);
    Json(serde_json::json!({
        "status": "ok",
        "service": "websocket-server",
        "connections": connections,
    }))
}

/// POST /api/notify — accept a notification from an internal service and
/// broadcast it to every connected WebSocket client.
async fn notify(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<NotifyRequest>,
) -> impl IntoResponse {
    let serialized = match serde_json::to_string(&payload.event) {
        Ok(s) => s,
        Err(e) => {
            error!(error = %e, "failed to serialize notification event");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "serialization failed" })),
            );
        }
    };

    // broadcast::Sender::send returns Err only when there are zero receivers,
    // which is a normal condition (no clients connected).
    let receiver_count = state.tx.send(serialized).unwrap_or(0);

    info!(
        event_type = ?std::mem::discriminant(&payload.event),
        receiver_count,
        "notification broadcast"
    );

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "sent",
            "receivers": receiver_count,
        })),
    )
}

/// GET /ws — upgrade the HTTP connection to a WebSocket.
async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

/// Per-connection WebSocket handler.
async fn handle_ws(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    state.connection_count.fetch_add(1, Ordering::Relaxed);
    let conn_count = state.connection_count.load(Ordering::Relaxed);
    info!(connections = conn_count, "client connected");

    // Subscribe to the broadcast channel.
    let mut rx = state.tx.subscribe();

    // Optional user_id filter — when set, only events matching this user_id
    // (or events without a user_id) are forwarded.
    let filter_user_id: Arc<tokio::sync::Mutex<Option<String>>> =
        Arc::new(tokio::sync::Mutex::new(None));

    // ------------------------------------------------------------------
    // Task: read messages from the client (subscription requests, pongs)
    // ------------------------------------------------------------------
    let filter_clone = Arc::clone(&filter_user_id);
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(sub) = serde_json::from_str::<SubscribeMessage>(&text) {
                        info!(user_id = %sub.subscribe, "client subscribed to user filter");
                        *filter_clone.lock().await = Some(sub.subscribe);
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // ------------------------------------------------------------------
    // Task: forward broadcast events & send heartbeat pings
    // ------------------------------------------------------------------
    let filter_clone2 = Arc::clone(&filter_user_id);
    let mut send_task = tokio::spawn(async move {
        let mut heartbeat = tokio::time::interval(Duration::from_secs(30));
        // The first tick completes immediately — skip it so we don't send a
        // ping the instant the client connects.
        heartbeat.tick().await;

        loop {
            tokio::select! {
                result = rx.recv() => {
                    match result {
                        Ok(msg) => {
                            // Apply optional user_id filter.
                            let filter = filter_clone2.lock().await;
                            if let Some(ref uid) = *filter {
                                // Parse the event to check its user_id.
                                if let Ok(event) = serde_json::from_str::<NotificationEvent>(&msg) {
                                    if let Some(event_uid) = event.user_id() {
                                        if event_uid != uid.as_str() {
                                            continue;
                                        }
                                    }
                                    // Events without a user_id pass through (e.g.
                                    // SystemAlert, AuditEvent).
                                }
                            }
                            drop(filter);

                            if sender.send(Message::Text(msg.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            warn!(missed = n, "client lagged behind broadcast");
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
                    }
                }
                _ = heartbeat.tick() => {
                    if sender.send(Message::Ping(vec![].into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Wait for either task to finish, then abort the other.
    tokio::select! {
        _ = &mut recv_task => {
            send_task.abort();
        }
        _ = &mut send_task => {
            recv_task.abort();
        }
    }

    state.connection_count.fetch_sub(1, Ordering::Relaxed);
    let conn_count = state.connection_count.load(Ordering::Relaxed);
    info!(connections = conn_count, "client disconnected");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    // Load .env file (ignore if missing).
    let _ = dotenvy::dotenv();

    // Initialise structured logging.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .json()
        .init();

    // Broadcast channel for fan-out to WebSocket clients.
    let (tx, _rx) = broadcast::channel::<String>(1000);

    let state = Arc::new(AppState {
        tx,
        connection_count: AtomicUsize::new(0),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws_upgrade))
        .route("/api/notify", post(notify))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:3004";
    info!(addr, "websocket-server listening");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind to port 3004");

    axum::serve(listener, app)
        .await
        .expect("server exited with error");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notification_event_serializes_with_tag() {
        let event = NotificationEvent::PaymentReceived {
            payment_id: "pay_123".into(),
            method: "stripe".into(),
            amount_usd: 50.0,
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "payment_received");
        assert_eq!(json["payment_id"], "pay_123");
        assert_eq!(json["amount_usd"], 50.0);
    }

    #[test]
    fn notification_event_deserializes() {
        let raw = r#"{"type":"tokens_credited","user_id":"u1","amount":100,"balance_after":500}"#;
        let event: NotificationEvent = serde_json::from_str(raw).unwrap();
        match event {
            NotificationEvent::TokensCredited {
                user_id,
                amount,
                balance_after,
            } => {
                assert_eq!(user_id, "u1");
                assert_eq!(amount, 100);
                assert_eq!(balance_after, 500);
            }
            _ => panic!("unexpected variant"),
        }
    }

    #[test]
    fn user_id_extraction() {
        let event = NotificationEvent::ComplianceUpdated {
            user_id: "user_42".into(),
            status: "kyc_approved".into(),
        };
        assert_eq!(event.user_id(), Some("user_42"));

        let alert = NotificationEvent::SystemAlert {
            level: "warn".into(),
            message: "high load".into(),
        };
        assert_eq!(alert.user_id(), None);
    }

    #[test]
    fn subscribe_message_parsing() {
        let raw = r#"{"subscribe":"user_99"}"#;
        let msg: SubscribeMessage = serde_json::from_str(raw).unwrap();
        assert_eq!(msg.subscribe, "user_99");
    }

    #[test]
    fn notify_request_parsing() {
        let raw = r#"{"event":{"type":"system_alert","level":"info","message":"test"}}"#;
        let req: NotifyRequest = serde_json::from_str(raw).unwrap();
        match req.event {
            NotificationEvent::SystemAlert { level, message } => {
                assert_eq!(level, "info");
                assert_eq!(message, "test");
            }
            _ => panic!("unexpected variant"),
        }
    }

    #[test]
    fn all_event_variants_roundtrip() {
        let events = vec![
            NotificationEvent::PaymentReceived {
                payment_id: "p1".into(),
                method: "paypal".into(),
                amount_usd: 200.0,
            },
            NotificationEvent::TokensCredited {
                user_id: "u1".into(),
                amount: 500,
                balance_after: 1500,
            },
            NotificationEvent::ComplianceUpdated {
                user_id: "u2".into(),
                status: "accredited_investor".into(),
            },
            NotificationEvent::SwapQuoted {
                intent_id: "s1".into(),
                token_in: "USDC".into(),
                token_out: "ETH".into(),
                estimated_out: 0.05,
            },
            NotificationEvent::SwapApproved {
                intent_id: "s1".into(),
                approved_by: "admin".into(),
            },
            NotificationEvent::AuditEvent {
                event_type: "payment_completed".into(),
                details: "payment p1 completed".into(),
            },
            NotificationEvent::SystemAlert {
                level: "critical".into(),
                message: "disk full".into(),
            },
        ];

        for event in events {
            let json = serde_json::to_string(&event).unwrap();
            let back: NotificationEvent = serde_json::from_str(&json).unwrap();
            // Verify the round-tripped JSON matches.
            let json2 = serde_json::to_string(&back).unwrap();
            assert_eq!(json, json2);
        }
    }
}
