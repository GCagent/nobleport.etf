use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;

// ─── Notification Events ──────────────────────────────────────────

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
    ComplianceBlocked {
        user_id: String,
        reason: String,
        action_required: String,
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

fn extract_user_id(event: &NotificationEvent) -> Option<&str> {
    match event {
        NotificationEvent::TokensCredited { user_id, .. }
        | NotificationEvent::ComplianceUpdated { user_id, .. }
        | NotificationEvent::ComplianceBlocked { user_id, .. } => Some(user_id),
        _ => None,
    }
}

// ─── App State ────────────────────────────────────────────────────

struct AppState {
    tx: broadcast::Sender<String>,
    connections: AtomicUsize,
}

// ─── Handlers ─────────────────────────────────────────────────────

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({
        "service": "websocket-server",
        "status": "ok",
        "port": 3004,
        "connections": state.connections.load(Ordering::Relaxed),
    }))
}

#[derive(Deserialize)]
struct NotifyRequest {
    event: NotificationEvent,
}

async fn notify(
    State(state): State<Arc<AppState>>,
    Json(req): Json<NotifyRequest>,
) -> impl IntoResponse {
    let payload = serde_json::to_string(&req.event).unwrap_or_default();
    let receivers = state.tx.send(payload).unwrap_or(0);
    Json(serde_json::json!({
        "sent": true,
        "receivers": receivers,
    }))
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: Arc<AppState>) {
    state.connections.fetch_add(1, Ordering::Relaxed);
    tracing::info!(
        connections = state.connections.load(Ordering::Relaxed),
        "WebSocket client connected"
    );

    let mut rx = state.tx.subscribe();
    let (mut sender, mut receiver) = socket.split();
    let user_filter: Option<String> = None;

    let send_task = {
        let filter = Arc::new(tokio::sync::Mutex::new(None::<String>));
        let filter_clone = filter.clone();

        let recv_task = tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.next().await {
                if let Message::Text(text) = msg {
                    if let Ok(parsed) =
                        serde_json::from_str::<serde_json::Value>(&text)
                    {
                        if let Some(uid) = parsed.get("subscribe").and_then(|v| v.as_str()) {
                            *filter_clone.lock().await = Some(uid.to_string());
                            tracing::info!(user_id = uid, "Client subscribed to user filter");
                        }
                    }
                }
            }
        });

        let send_task = tokio::spawn(async move {
            let mut ping_interval = tokio::time::interval(std::time::Duration::from_secs(30));

            loop {
                tokio::select! {
                    msg = rx.recv() => {
                        match msg {
                            Ok(payload) => {
                                let filter_guard = filter.lock().await;
                                if let Some(ref uid) = *filter_guard {
                                    if let Ok(event) = serde_json::from_str::<NotificationEvent>(&payload) {
                                        if let Some(event_uid) = extract_user_id(&event) {
                                            if event_uid != uid {
                                                continue;
                                            }
                                        }
                                    }
                                }
                                drop(filter_guard);

                                if sender.send(Message::Text(payload.into())).await.is_err() {
                                    break;
                                }
                            }
                            Err(broadcast::error::RecvError::Lagged(n)) => {
                                tracing::warn!(skipped = n, "Client lagged behind");
                            }
                            Err(_) => break,
                        }
                    }
                    _ = ping_interval.tick() => {
                        if sender.send(Message::Ping(vec![].into())).await.is_err() {
                            break;
                        }
                    }
                }
            }
        });

        (send_task, recv_task)
    };

    let _ = tokio::try_join!(send_task.0, send_task.1);

    state.connections.fetch_sub(1, Ordering::Relaxed);
    tracing::info!(
        connections = state.connections.load(Ordering::Relaxed),
        "WebSocket client disconnected"
    );

    drop(user_filter);
}

// ─── Main ─────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .json()
        .init();

    let (tx, _) = broadcast::channel::<String>(1000);
    let state = Arc::new(AppState {
        tx,
        connections: AtomicUsize::new(0),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws_upgrade))
        .route("/api/notify", post(notify))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = "0.0.0.0:3004";
    tracing::info!("WebSocket server listening on {addr}");
    tracing::info!("Endpoints: GET /ws (upgrade), POST /api/notify");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
