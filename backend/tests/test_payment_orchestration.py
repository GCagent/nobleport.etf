"""
Tests for the payment orchestration architecture
(backend/config/payment_orchestration.py).

These assert two things the review insisted on:

  1. **Honesty.** The truth-status classification keeps approved design separate
     from pending production validation; planned modules don't pretend to be
     wired; the fraud-score check reports its gap instead of faking a score.
  2. **Governance.** Stephanie orchestrates but never moves money: every routing
     recommendation is STAGED and requires human approval, the risk engine can
     only hold/stop (never clear) a payment, and fund movement always collapses
     to the BLOCKED -> ESCALATE `payment_approval` rule in the Authority Matrix.

The routing and risk decision functions are then exercised across their rules.
"""

from __future__ import annotations

import pytest

from backend.config.payment_orchestration import (
    ACH_INVOICE_THRESHOLD_USD,
    CLASSIFICATION,
    ENTERPRISE_MODULES,
    PROVIDER_CATALOG,
    ROADMAP,
    CapabilityClassification,
    RiskCheck,
    RoutingStrategy,
    TruthStatus,
    approved_capabilities,
    authority_for_fund_movement,
    evaluate_payment_risk,
    fund_movement_is_autonomous,
    get_module,
    get_phase,
    get_provider,
    modules_by_status,
    pending_capabilities,
    recommend_processor,
)
from backend.config.revenue_spine import ImplementationStatus
from backend.governance.authority_matrix import Disposition
from backend.governance.truth_layer import TruthTag, may_execute_autonomously
from backend.models.payment import PaymentProcessor


# ===========================================================================
# Truth-status classification — honesty
# ===========================================================================

def test_classification_only_uses_known_statuses():
    for c in CLASSIFICATION:
        assert isinstance(c, CapabilityClassification)
        assert c.status in (TruthStatus.APPROVED, TruthStatus.PENDING)


def test_validation_items_are_pending_not_approved():
    # The review was explicit: these are NOT verified production capabilities.
    must_be_pending = {
        "Production deployment",
        "End-to-end sandbox validation",
        "PCI/security validation",
        "Live webhook verification",
        "QuickBooks synchronization verification",
        "Financing API integrations",
        "Voice payment execution testing",
    }
    pending = {c.capability for c in pending_capabilities()}
    assert must_be_pending <= pending


def test_architecture_decisions_are_approved():
    approved = {c.capability for c in approved_capabilities()}
    assert {
        "Payment orchestration architecture",
        "Stripe + PayPal multi-provider strategy",
        "Stephanie.ai orchestration role",
        "Revenue Spine integration",
    } <= approved


def test_classification_partitions_cleanly():
    assert len(approved_capabilities()) + len(pending_capabilities()) == len(CLASSIFICATION)


# ===========================================================================
# Provider catalog — anti-drift against the real enum
# ===========================================================================

def test_every_provider_maps_to_a_real_processor_enum_value():
    valid = set(PaymentProcessor)
    for p in PROVIDER_CATALOG:
        assert p.processor in valid


def test_paypal_is_now_a_real_processor():
    # The approved multi-provider strategy added PayPal to the enum.
    assert PaymentProcessor.PAYPAL in set(PaymentProcessor)
    assert get_provider(PaymentProcessor.PAYPAL).display_name == "PayPal"


def test_wallets_settle_through_a_rail_not_as_processors():
    # Apple Pay / Google Pay must NOT be standalone processors; they ride Stripe.
    enum_values = {p.value for p in PaymentProcessor}
    assert "apple_pay" not in enum_values
    assert "google_pay" not in enum_values
    stripe = get_provider(PaymentProcessor.STRIPE)
    assert set(stripe.wallets) == {"apple_pay", "google_pay"}


def test_implemented_providers_cite_backing():
    for p in PROVIDER_CATALOG:
        if p.status is ImplementationStatus.IMPLEMENTED:
            assert p.backed_by


# ===========================================================================
# Module 1 — Intelligent Payment Routing
# ===========================================================================

def test_routing_always_staged_and_requires_human_approval():
    rec = recommend_processor(amount_usd=1_000.0)
    assert rec.tag is TruthTag.STAGED
    assert rec.requires_human_approval is True
    # A STAGED tag may never execute autonomously.
    assert may_execute_autonomously(rec.tag) is False


def test_routing_honours_customer_preference():
    rec = recommend_processor(amount_usd=1_000.0,
                              customer_preference=PaymentProcessor.PAYPAL)
    assert rec.processor is PaymentProcessor.PAYPAL
    assert rec.strategy is RoutingStrategy.CUSTOMER_PREFERENCE


def test_large_invoice_routes_to_ach_for_lowest_cost():
    rec = recommend_processor(amount_usd=ACH_INVOICE_THRESHOLD_USD + 1)
    assert rec.processor is PaymentProcessor.ACH
    assert rec.strategy is RoutingStrategy.ACH_OVER_THRESHOLD


def test_small_invoice_routes_lowest_cost_default():
    rec = recommend_processor(amount_usd=500.0)
    assert rec.strategy is RoutingStrategy.LOWEST_COST


def test_international_avoids_domestic_only_rails():
    rec = recommend_processor(amount_usd=1_000.0, international=True)
    assert get_provider(rec.processor).international is True
    assert rec.strategy is RoutingStrategy.INTERNATIONAL
    # ACH is domestic-only and must not be chosen for an international payment.
    assert rec.processor is not PaymentProcessor.ACH


def test_failover_when_preferred_rail_unavailable():
    # Large invoice would prefer ACH, but ACH is down -> failover to another rail.
    rec = recommend_processor(amount_usd=ACH_INVOICE_THRESHOLD_USD + 1,
                              unavailable=(PaymentProcessor.ACH,))
    assert rec.processor is not PaymentProcessor.ACH
    assert rec.failover_applied is True
    assert rec.strategy is RoutingStrategy.FAILOVER


def test_routing_rejects_negative_amount():
    with pytest.raises(ValueError):
        recommend_processor(amount_usd=-1.0)


def test_routing_raises_when_no_rail_available():
    with pytest.raises(ValueError):
        recommend_processor(
            amount_usd=100.0,
            unavailable=tuple(p.processor for p in PROVIDER_CATALOG),
        )


# ===========================================================================
# Module 2 — Risk Engine
# ===========================================================================

def test_fraud_check_reports_gap_instead_of_faking_a_score():
    assessment = evaluate_payment_risk(amount_usd=100.0)
    fraud = next(f for f in assessment.findings if f.check is RiskCheck.FRAUD_SCORE)
    assert "PLANNED" in fraud.detail


def test_duplicate_payment_forces_manual_approval():
    assessment = evaluate_payment_risk(amount_usd=5_000.0, recent_amounts=(5_000.0,))
    dup = next(f for f in assessment.findings if f.check is RiskCheck.DUPLICATE_PAYMENT)
    assert dup.passed is False
    assert assessment.requires_manual_approval is True


def test_deposit_over_hic_cap_is_a_hard_stop():
    # Deposit > 1/3 of contract must hard-stop (block), not merely warn.
    assessment = evaluate_payment_risk(
        amount_usd=40_000.0, contract_value=90_000.0, is_deposit=True)
    deposit = next(f for f in assessment.findings if f.check is RiskCheck.DEPOSIT_POLICY)
    assert deposit.passed is False
    assert deposit.hard_stop is True
    assert assessment.blocked is True


def test_compliant_deposit_passes():
    assessment = evaluate_payment_risk(
        amount_usd=25_000.0, contract_value=90_000.0, is_deposit=True)
    deposit = next(f for f in assessment.findings if f.check is RiskCheck.DEPOSIT_POLICY)
    assert deposit.passed is True
    assert assessment.blocked is False


def test_amount_over_threshold_triggers_manual_approval():
    assessment = evaluate_payment_risk(amount_usd=6_000.0)
    assert assessment.requires_manual_approval is True


def test_clean_small_payment_needs_no_manual_approval():
    assessment = evaluate_payment_risk(amount_usd=500.0)
    assert assessment.requires_manual_approval is False
    assert assessment.blocked is False


# ===========================================================================
# Governance invariant — orchestration never moves money on its own
# ===========================================================================

def test_fund_movement_is_blocked_and_escalated():
    rule = authority_for_fund_movement()
    assert rule.action_type == "payment_approval"
    assert rule.tag is TruthTag.BLOCKED
    assert rule.disposition is Disposition.ESCALATE


def test_fund_movement_is_never_autonomous():
    assert fund_movement_is_autonomous() is False


# ===========================================================================
# Enterprise modules & roadmap — structure and honesty
# ===========================================================================

def test_exactly_four_enterprise_modules_numbered_one_to_four():
    assert sorted(m.number for m in ENTERPRISE_MODULES) == [1, 2, 3, 4]


def test_treasury_is_planned_with_no_backing():
    treasury = get_module(3)
    assert treasury.name == "Treasury Command Center"
    assert treasury.status is ImplementationStatus.PLANNED
    # An honest PLANNED module must not cite backing it doesn't have.
    assert treasury.backed_by == ()


def test_non_planned_modules_cite_backing():
    for m in ENTERPRISE_MODULES:
        if m.status is not ImplementationStatus.PLANNED:
            assert m.backed_by, f"Module {m.number} ({m.name}) cites no backing"


def test_only_advisor_briefings_may_be_live():
    # Money-touching modules (routing, risk) cap at STAGED. Only the advisor's
    # executive briefings — already LIVE in the Authority Matrix — may be LIVE.
    for m in ENTERPRISE_MODULES:
        if m.name in {"Intelligent Payment Routing", "Risk Engine"}:
            assert m.governance_tag is TruthTag.STAGED


def test_roadmap_has_five_phases():
    assert sorted(p.number for p in ROADMAP) == [1, 2, 3, 4, 5]
    assert get_phase(1).name == "Payment Hub"
    assert get_phase(5).name == "Stephanie.ai"


def test_payment_hub_phase_lists_all_approved_rails():
    hub = get_phase(1)
    assert {"Stripe", "PayPal", "Apple Pay", "Google Pay", "ACH"} <= set(hub.deliverables)


def test_enterprise_phase_is_planned():
    assert get_phase(4).status is ImplementationStatus.PLANNED


def test_module_and_phase_lookups_reject_unknown():
    with pytest.raises(ValueError):
        get_module(99)
    with pytest.raises(ValueError):
        get_phase(99)
    with pytest.raises(ValueError):
        get_provider(PaymentProcessor.CHECK)  # not in the orchestration catalog


def test_modules_by_status_filters():
    planned = modules_by_status(ImplementationStatus.PLANNED)
    assert {m.name for m in planned} == {"Treasury Command Center"}
