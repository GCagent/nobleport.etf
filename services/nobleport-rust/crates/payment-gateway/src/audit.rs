use tracing::info;

pub use common::AuditChain;

use crate::AppState;

/// Log a payment event to the audit chain and emit a tracing log.
pub fn log_payment_event(
    state: &AppState,
    event_type: &str,
    payment_id: &str,
    details: serde_json::Value,
) {
    let mut chain = state.audit_chain.lock().expect("audit chain lock poisoned");
    let mut payload = details.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("payment_id".to_string(), serde_json::json!(payment_id));
    }
    let entry = chain.append(event_type, payload);

    info!(
        audit_hash = %entry.hash,
        event_type = %event_type,
        payment_id = %payment_id,
        "audit: {event_type}"
    );
}
