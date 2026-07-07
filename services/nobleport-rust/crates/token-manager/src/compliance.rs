use std::collections::HashMap;

use chrono::Utc;
use common::{AuditChain, ComplianceGate, ComplianceStatus, PaymentError};
use tracing::{info, warn};

// ---------------------------------------------------------------------------
// Restricted jurisdictions
// ---------------------------------------------------------------------------

/// Jurisdictions where all token transfers are blocked.
pub const RESTRICTED_JURISDICTIONS: &[&str] = &["OFAC_SANCTIONED", "UNKNOWN"];

// ---------------------------------------------------------------------------
// ComplianceEngine
// ---------------------------------------------------------------------------

/// In-memory compliance engine that gates token issuance and transfers.
///
/// Every user starts as [`ComplianceStatus::Unverified`]. Before tokens can be
/// credited, the user must pass KYC verification. For amounts exceeding
/// $10,000 USD, accredited-investor verification is additionally required.
/// Users in restricted jurisdictions or with the `restricted_transfer` flag
/// are blocked unconditionally.
pub struct ComplianceEngine {
    /// Per-user compliance gates (keyed by `user_id`).
    gates: HashMap<String, ComplianceGate>,
}

impl ComplianceEngine {
    /// Create a new, empty compliance engine.
    pub fn new() -> Self {
        Self {
            gates: HashMap::new(),
        }
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /// Return the compliance gate for a user, creating a default
    /// [`ComplianceStatus::Unverified`] entry if none exists.
    pub fn get_gate(&self, user_id: &str) -> ComplianceGate {
        self.gates
            .get(user_id)
            .cloned()
            .unwrap_or_else(|| ComplianceGate {
                user_id: user_id.to_string(),
                status: ComplianceStatus::Unverified,
                kyc_verified_at: None,
                accredited_verified_at: None,
                jurisdiction: None,
                restricted_transfer: false,
            })
    }

    /// Pre-check whether a user is allowed to receive `amount_usd` worth of
    /// NBPT tokens. Returns `Ok(())` when all compliance gates pass, or a
    /// descriptive [`PaymentError`] explaining why the credit was blocked.
    ///
    /// # Gate order
    /// 1. Transfer restriction flag
    /// 2. Jurisdiction check
    /// 3. KYC / accreditation status
    /// 4. Accredited-investor threshold ($10,000)
    pub fn check_can_receive(
        &self,
        user_id: &str,
        amount_usd: f64,
    ) -> Result<(), PaymentError> {
        let gate = self.get_gate(user_id);

        // 1. Hard block: transfer restriction flag.
        if gate.restricted_transfer {
            warn!(
                user_id = %user_id,
                "Token credit blocked: transfer restriction flag is set"
            );
            return Err(PaymentError::TransferRestricted);
        }

        // 2. Hard block: restricted jurisdiction.
        if let Some(ref jurisdiction) = gate.jurisdiction {
            if RESTRICTED_JURISDICTIONS.contains(&jurisdiction.as_str()) {
                warn!(
                    user_id = %user_id,
                    jurisdiction = %jurisdiction,
                    "Token credit blocked: restricted jurisdiction"
                );
                return Err(PaymentError::TransferRestricted);
            }
        }

        // 3. KYC status gate.
        match gate.status {
            ComplianceStatus::Unverified | ComplianceStatus::KycPending => {
                warn!(
                    user_id = %user_id,
                    status = ?gate.status,
                    "Token credit blocked: KYC verification required"
                );
                return Err(PaymentError::ComplianceRequired);
            }
            ComplianceStatus::Rejected => {
                warn!(
                    user_id = %user_id,
                    "Token credit blocked: KYC application was rejected"
                );
                return Err(PaymentError::TransferRestricted);
            }
            ComplianceStatus::KycApproved | ComplianceStatus::AccreditedInvestor => {
                // Passes basic KYC gate — continue to accredited check.
            }
        }

        // 4. Accredited-investor threshold.
        if amount_usd > 10_000.0 && gate.status != ComplianceStatus::AccreditedInvestor {
            warn!(
                user_id = %user_id,
                amount_usd = %amount_usd,
                "Token credit blocked: accredited investor verification required for amounts > $10,000"
            );
            return Err(PaymentError::AccreditedInvestorRequired);
        }

        info!(
            user_id = %user_id,
            amount_usd = %amount_usd,
            status = ?gate.status,
            "Compliance check passed"
        );
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Mutations
    // -----------------------------------------------------------------------

    /// Update the compliance status for a user, recording the change in the
    /// audit chain.
    pub fn update_status(
        &mut self,
        user_id: &str,
        new_status: ComplianceStatus,
        jurisdiction: Option<String>,
        audit_chain: &mut AuditChain,
    ) {
        let now = Utc::now();

        let gate = self.gates.entry(user_id.to_string()).or_insert_with(|| {
            ComplianceGate {
                user_id: user_id.to_string(),
                status: ComplianceStatus::Unverified,
                kyc_verified_at: None,
                accredited_verified_at: None,
                jurisdiction: None,
                restricted_transfer: false,
            }
        });

        let old_status = gate.status;
        gate.status = new_status;

        if let Some(ref j) = jurisdiction {
            gate.jurisdiction = Some(j.clone());
        }

        match new_status {
            ComplianceStatus::KycApproved => {
                gate.kyc_verified_at = Some(now);
            }
            ComplianceStatus::AccreditedInvestor => {
                gate.kyc_verified_at.get_or_insert(now);
                gate.accredited_verified_at = Some(now);
            }
            ComplianceStatus::Rejected => {
                gate.restricted_transfer = true;
            }
            _ => {}
        }

        audit_chain.append(
            "compliance_status_updated",
            serde_json::json!({
                "user_id": user_id,
                "old_status": format!("{:?}", old_status),
                "new_status": format!("{:?}", new_status),
                "jurisdiction": jurisdiction,
                "timestamp": now.to_rfc3339(),
            }),
        );

        info!(
            user_id = %user_id,
            old_status = ?old_status,
            new_status = ?new_status,
            "Compliance status updated"
        );
    }
}

impl Default for ComplianceEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn engine_with_user(user_id: &str, status: ComplianceStatus) -> ComplianceEngine {
        let mut engine = ComplianceEngine::new();
        let mut audit = AuditChain::new();
        engine.update_status(user_id, status, Some("US".to_string()), &mut audit);
        engine
    }

    #[test]
    fn unverified_user_cannot_receive_tokens() {
        let engine = ComplianceEngine::new();
        let result = engine.check_can_receive("user-1", 100.0);
        assert!(matches!(result, Err(PaymentError::ComplianceRequired)));
    }

    #[test]
    fn kyc_pending_user_cannot_receive_tokens() {
        let engine = engine_with_user("user-1", ComplianceStatus::KycPending);
        let result = engine.check_can_receive("user-1", 100.0);
        assert!(matches!(result, Err(PaymentError::ComplianceRequired)));
    }

    #[test]
    fn rejected_user_cannot_receive_tokens() {
        let engine = engine_with_user("user-1", ComplianceStatus::Rejected);
        let result = engine.check_can_receive("user-1", 100.0);
        assert!(matches!(result, Err(PaymentError::TransferRestricted)));
    }

    #[test]
    fn kyc_approved_user_can_receive_tokens() {
        let engine = engine_with_user("user-1", ComplianceStatus::KycApproved);
        let result = engine.check_can_receive("user-1", 5_000.0);
        assert!(result.is_ok());
    }

    #[test]
    fn kyc_approved_user_blocked_above_10k() {
        let engine = engine_with_user("user-1", ComplianceStatus::KycApproved);
        let result = engine.check_can_receive("user-1", 15_000.0);
        assert!(matches!(
            result,
            Err(PaymentError::AccreditedInvestorRequired)
        ));
    }

    #[test]
    fn accredited_investor_can_receive_above_10k() {
        let engine = engine_with_user("user-1", ComplianceStatus::AccreditedInvestor);
        let result = engine.check_can_receive("user-1", 50_000.0);
        assert!(result.is_ok());
    }

    #[test]
    fn restricted_jurisdiction_blocks_transfer() {
        let mut engine = ComplianceEngine::new();
        let mut audit = AuditChain::new();
        engine.update_status(
            "user-1",
            ComplianceStatus::KycApproved,
            Some("OFAC_SANCTIONED".to_string()),
            &mut audit,
        );
        let result = engine.check_can_receive("user-1", 100.0);
        assert!(matches!(result, Err(PaymentError::TransferRestricted)));
    }

    #[test]
    fn transfer_restriction_flag_blocks() {
        let mut engine = engine_with_user("user-1", ComplianceStatus::KycApproved);
        // Manually set the restriction flag.
        engine.gates.get_mut("user-1").unwrap().restricted_transfer = true;
        let result = engine.check_can_receive("user-1", 100.0);
        assert!(matches!(result, Err(PaymentError::TransferRestricted)));
    }

    #[test]
    fn update_status_records_audit_entry() {
        let mut engine = ComplianceEngine::new();
        let mut audit = AuditChain::new();
        engine.update_status(
            "user-1",
            ComplianceStatus::KycApproved,
            Some("US".to_string()),
            &mut audit,
        );
        assert_eq!(audit.entries().len(), 1);
        assert_eq!(
            audit.entries()[0].event_type,
            "compliance_status_updated"
        );
        assert!(audit.verify());
    }
}
