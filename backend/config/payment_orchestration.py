"""
Payment Orchestration Architecture — executable classification, decisioning & roadmap.

This module encodes the approved NoblePort payment orchestration architecture as
typed, testable data and pure decision functions rather than prose. It is the
single source of truth for:

  * the **truth-status classification** — what is an approved design decision vs
    what still requires production validation (deployment, sandbox, PCI, live
    webhooks, QuickBooks sync, financing APIs, voice execution);
  * the **multi-provider processor catalog** (Stripe + PayPal rails, ACH, and the
    Apple Pay / Google Pay wallets that settle through a rail);
  * the **four enterprise modules** — Intelligent Payment Routing, Risk Engine,
    Treasury Command Center, Executive AI Financial Advisor;
  * the **intelligent-routing and risk decision logic**; and
  * the **five-phase implementation roadmap**.

Governance invariant (non-negotiable)
-------------------------------------
Stephanie.ai is the ORCHESTRATION layer, never an autonomous financial
decision-maker. Every fund-moving action this module can recommend resolves to
`payment_approval` in the Authority Matrix, which is BLOCKED -> ESCALATE: the
recommendation is *prepared* here and *authorized* only by a human, logged to
the immutable ledger. The routing and risk functions therefore return STAGED
recommendations and assessments; **none of them move money**. This mirrors the
payment-node skill ("never release funds autonomously") and keeps the whole
stack consistent with the HITL governance framework.

Honesty discipline
-------------------
Following backend/config/revenue_spine.py: capabilities are tagged with an
honest ImplementationStatus and every claim cites concrete backing. Planned
capabilities are marked PLANNED, not dressed up as done.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from backend.config.revenue_spine import ImplementationStatus
from backend.governance.authority_matrix import (
    BUDGET_ESCALATION_THRESHOLD,
    AuthorityRule,
    Disposition,
    lookup_authority,
)
from backend.governance.truth_layer import TruthTag
from backend.models.payment import PaymentProcessor

# ===========================================================================
# Truth-status classification
# ===========================================================================
#
# The architecture review drew a hard line between an approved design decision
# and a verified production capability. We encode that line so dashboards and
# audits read the same status the review assigned — and so no one can quietly
# promote "pending validation" to "done".


class TruthStatus(str, Enum):
    """Approved design vs capability still pending production validation."""

    APPROVED = "approved"  # Architecture/strategy decision is approved (the design is settled)
    PENDING = "pending"    # Requires production validation before it can be claimed as real


@dataclass(frozen=True)
class CapabilityClassification:
    capability: str
    status: TruthStatus
    note: str = ""


# Verbatim from the approved review. APPROVED items are settled design
# decisions; PENDING items are explicitly NOT claimed as operational until the
# named validation has been performed and evidenced.
CLASSIFICATION: tuple[CapabilityClassification, ...] = (
    # ---- Approved architecture & strategy --------------------------------
    CapabilityClassification(
        "Payment orchestration architecture", TruthStatus.APPROVED,
        "Design of the orchestration layer is approved."),
    CapabilityClassification(
        "Stripe + PayPal multi-provider strategy", TruthStatus.APPROVED,
        "Multi-rail strategy approved; PayPal added to the processor enum."),
    CapabilityClassification(
        "Stephanie.ai orchestration role", TruthStatus.APPROVED,
        "Stephanie orchestrates; she is not an autonomous financial decision-maker."),
    CapabilityClassification(
        "Revenue Spine integration", TruthStatus.APPROVED,
        "Orchestration plugs into the existing Lead->Closeout spine."),
    # ---- Pending production validation -----------------------------------
    CapabilityClassification(
        "Production deployment", TruthStatus.PENDING,
        "Not deployed to production."),
    CapabilityClassification(
        "End-to-end sandbox validation", TruthStatus.PENDING,
        "Full provider sandbox run not yet evidenced end to end."),
    CapabilityClassification(
        "PCI/security validation", TruthStatus.PENDING,
        "PCI scope and security review outstanding."),
    CapabilityClassification(
        "Live webhook verification", TruthStatus.PENDING,
        "Live provider webhook signatures not yet verified in production."),
    CapabilityClassification(
        "QuickBooks synchronization verification", TruthStatus.PENDING,
        "Accounting sync not verified against a live ledger."),
    CapabilityClassification(
        "Financing API integrations", TruthStatus.PENDING,
        "Third-party financing integrations not built."),
    CapabilityClassification(
        "Voice payment execution testing", TruthStatus.PENDING,
        "Voice-initiated payment path (strong-auth) not tested."),
)


def approved_capabilities() -> list[CapabilityClassification]:
    return [c for c in CLASSIFICATION if c.status is TruthStatus.APPROVED]


def pending_capabilities() -> list[CapabilityClassification]:
    return [c for c in CLASSIFICATION if c.status is TruthStatus.PENDING]


# ===========================================================================
# Multi-provider processor catalog
# ===========================================================================
#
# Grounded in the real PaymentProcessor enum (anti-drift: the test asserts every
# entry maps to a real enum member). Apple Pay / Google Pay are wallets — they
# settle through an underlying rail, so they are listed as `wallets` on the rail
# that clears them, NOT as standalone processors.


@dataclass(frozen=True)
class ProviderConfig:
    processor: PaymentProcessor
    display_name: str
    status: ImplementationStatus
    domestic: bool
    international: bool
    wallets: tuple[str, ...]          # wallet methods this rail settles (e.g. apple_pay)
    backed_by: tuple[str, ...]
    note: str = ""


PROVIDER_CATALOG: tuple[ProviderConfig, ...] = (
    ProviderConfig(
        processor=PaymentProcessor.STRIPE,
        display_name="Stripe",
        status=ImplementationStatus.IMPLEMENTED,
        domestic=True,
        international=True,
        wallets=("apple_pay", "google_pay"),
        backed_by=("backend/services/stripe_service.py", "backend/api/payments.py",
                   "backend/models/payment.py"),
        note="Primary rail today: checkout sessions, webhooks, deposit gate.",
    ),
    ProviderConfig(
        processor=PaymentProcessor.PAYPAL,
        display_name="PayPal",
        status=ImplementationStatus.PARTIAL,
        domestic=True,
        international=True,
        wallets=(),
        backed_by=("backend/config/settings.py:paypal_client_id",
                   "backend/core/secrets/inventory.py (paypal-client-id, paypal-secret)"),
        note="Tier-1 credentials configured and processor enum value added; "
             "a PayPal service client and webhook handler are not yet built.",
    ),
    ProviderConfig(
        processor=PaymentProcessor.ACH,
        display_name="ACH bank transfer",
        status=ImplementationStatus.PARTIAL,
        domestic=True,
        international=False,
        wallets=(),
        backed_by=("backend/models/payment.py:PaymentProcessor.ACH",),
        note="Enum + routing preference exist; a dedicated ACH initiation flow "
             "is not yet built. Preferred rail for large invoices (lowest cost).",
    ),
)

PROVIDER_BY_PROCESSOR: dict[PaymentProcessor, ProviderConfig] = {
    p.processor: p for p in PROVIDER_CATALOG
}


def get_provider(processor: PaymentProcessor) -> ProviderConfig:
    try:
        return PROVIDER_BY_PROCESSOR[processor]
    except KeyError as exc:
        raise ValueError(f"No provider config for {processor!r}") from exc


# ===========================================================================
# Module 1 — Intelligent Payment Routing
# ===========================================================================
#
# Selects the most appropriate rail by configurable business rules. It RECOMMENDS
# only: the recommendation is STAGED and always requires human approval before
# any fund movement (see authority_for_fund_movement below).

# Invoices at/above this amount prefer ACH (lowest processing cost) when ACH is
# available. Configurable business rule; default chosen conservatively.
ACH_INVOICE_THRESHOLD_USD: float = 25_000.0


class RoutingStrategy(str, Enum):
    CUSTOMER_PREFERENCE = "customer_preference"
    INTERNATIONAL = "international"
    ACH_OVER_THRESHOLD = "ach_over_threshold"
    LOWEST_COST = "lowest_cost"
    FAILOVER = "failover"


@dataclass(frozen=True)
class RoutingRecommendation:
    processor: PaymentProcessor
    strategy: RoutingStrategy
    tag: TruthTag                       # always STAGED — a recommendation, never an execution
    rationale: str
    failover_applied: bool = False

    @property
    def requires_human_approval(self) -> bool:
        # Fund movement is BLOCKED/ESCALATE in the Authority Matrix; a routing
        # recommendation can never authorize a release on its own.
        return True


# Ordered fallback preference for failover (standard rail first, then PayPal,
# then ACH). Filtered by availability and — for international payments — by
# international support.
DEFAULT_COST_ORDER: tuple[PaymentProcessor, ...] = (
    PaymentProcessor.STRIPE,
    PaymentProcessor.PAYPAL,
    PaymentProcessor.ACH,
)


def _available(processor: PaymentProcessor,
               unavailable: frozenset[PaymentProcessor]) -> bool:
    return processor not in unavailable


def recommend_processor(
    *,
    amount_usd: float,
    customer_preference: PaymentProcessor | None = None,
    international: bool = False,
    unavailable: tuple[PaymentProcessor, ...] = (),
) -> RoutingRecommendation:
    """
    Recommend a settlement rail from configurable business rules.

    The preferred rail is chosen by precedence (availability-independent):
      1. Honoured customer preference.
      2. International -> a rail that supports international settlement (Stripe).
      3. Invoice >= ACH threshold -> ACH (lowest cost on large invoices).
      4. Otherwise the standard lowest-cost rail (Stripe).

    Then automatic failover applies: if the preferred rail is unavailable, the
    next available rail is chosen and the recommendation is marked FAILOVER
    (honouring the international constraint, so a domestic-only rail is never
    used for an international payment).

    The result is ALWAYS tagged STAGED and ALWAYS requires human approval before
    funds move. This function selects a rail; it does not charge anyone.
    """
    if amount_usd < 0:
        raise ValueError("amount_usd must be non-negative")

    down = frozenset(unavailable)

    # --- Determine the PREFERRED rail by business rules (ignoring availability).
    if customer_preference is not None and customer_preference in PROVIDER_BY_PROCESSOR:
        preferred = customer_preference
        strategy = RoutingStrategy.CUSTOMER_PREFERENCE
    elif international:
        preferred = PaymentProcessor.STRIPE
        strategy = RoutingStrategy.INTERNATIONAL
    elif amount_usd >= ACH_INVOICE_THRESHOLD_USD:
        preferred = PaymentProcessor.ACH
        strategy = RoutingStrategy.ACH_OVER_THRESHOLD
    else:
        preferred = PaymentProcessor.STRIPE
        strategy = RoutingStrategy.LOWEST_COST

    # --- Availability / failover.
    if _available(preferred, down):
        chosen = preferred
        failover = False
    else:
        fallback_order = [
            p for p in DEFAULT_COST_ORDER
            if _available(p, down) and (not international or get_provider(p).international)
        ]
        if not fallback_order:
            raise ValueError("No payment rail available to route to")
        chosen = fallback_order[0]
        failover = True
        strategy = RoutingStrategy.FAILOVER

    provider = get_provider(chosen)
    rationale = {
        RoutingStrategy.CUSTOMER_PREFERENCE: f"Honouring customer preference: {provider.display_name}.",
        RoutingStrategy.INTERNATIONAL: f"International payment routed to {provider.display_name}.",
        RoutingStrategy.ACH_OVER_THRESHOLD: (
            f"Invoice ${amount_usd:,.0f} >= ${ACH_INVOICE_THRESHOLD_USD:,.0f}; "
            f"routing to ACH for lowest processing cost."),
        RoutingStrategy.LOWEST_COST: f"Lowest-cost available rail: {provider.display_name}.",
        RoutingStrategy.FAILOVER: f"Preferred rail unavailable; failed over to {provider.display_name}.",
    }[strategy]

    return RoutingRecommendation(
        processor=chosen,
        strategy=strategy,
        tag=TruthTag.STAGED,
        rationale=rationale,
        failover_applied=failover,
    )


# ===========================================================================
# Module 2 — Risk Engine
# ===========================================================================
#
# Evaluates a payment BEFORE it is staged for human approval. It can hold a
# payment for manual approval or hard-stop it; it can never clear it for
# autonomous execution.


class RiskCheck(str, Enum):
    FRAUD_SCORE = "fraud_score"
    DUPLICATE_PAYMENT = "duplicate_payment"
    CHANGE_ORDER_VALIDATION = "change_order_validation"
    DEPOSIT_POLICY = "deposit_policy"
    PAYMENT_HISTORY = "payment_history"
    MANUAL_APPROVAL_TRIGGER = "manual_approval_trigger"


@dataclass(frozen=True)
class RiskFinding:
    check: RiskCheck
    passed: bool
    detail: str
    forces_manual_approval: bool = False
    hard_stop: bool = False


@dataclass(frozen=True)
class RiskAssessment:
    findings: tuple[RiskFinding, ...]

    @property
    def blocked(self) -> bool:
        """A hard-stop finding (e.g. deposit over HIC cap) blocks outright."""
        return any(f.hard_stop for f in self.findings)

    @property
    def requires_manual_approval(self) -> bool:
        return self.blocked or any(f.forces_manual_approval for f in self.findings)

    @property
    def failed(self) -> tuple[RiskFinding, ...]:
        return tuple(f for f in self.findings if not f.passed)


def evaluate_payment_risk(
    *,
    amount_usd: float,
    contract_value: float | None = None,
    is_deposit: bool = False,
    recent_amounts: tuple[float, ...] = (),
    prior_failed_payments: int = 0,
) -> RiskAssessment:
    """
    Run the configured risk checks over a proposed payment.

    Outcomes are advisory toward the human gate:
      * `hard_stop`  -> the payment is BLOCKED (e.g. deposit exceeds the MA HIC
        cap — a hard stop per the payment-node skill, not a warning).
      * `forces_manual_approval` -> the payment must be held for a human even if
        it would otherwise have been routine.

    Nothing here releases funds. The fraud-score check is honestly PLANNED: no
    external scoring engine is integrated yet, so it reports that rather than
    fabricating a score.
    """
    findings: list[RiskFinding] = []

    # Fraud score — PLANNED. Do not fabricate a score; report the gap.
    findings.append(RiskFinding(
        check=RiskCheck.FRAUD_SCORE,
        passed=True,
        detail="PLANNED: external fraud-scoring engine not yet integrated.",
    ))

    # Duplicate payment detection.
    is_dup = amount_usd in recent_amounts
    findings.append(RiskFinding(
        check=RiskCheck.DUPLICATE_PAYMENT,
        passed=not is_dup,
        detail=(f"Amount ${amount_usd:,.2f} matches a recent payment — possible duplicate."
                if is_dup else "No duplicate detected."),
        forces_manual_approval=is_dup,
    ))

    # Deposit policy — MA HIC cap (use 1/3 of contract as the available bound).
    if is_deposit and contract_value is not None:
        cap = contract_value / 3.0
        over_cap = amount_usd > cap
        findings.append(RiskFinding(
            check=RiskCheck.DEPOSIT_POLICY,
            passed=not over_cap,
            detail=(f"Deposit ${amount_usd:,.2f} exceeds MA HIC cap of ${cap:,.2f} "
                    f"(1/3 of contract)." if over_cap
                    else f"Deposit within MA HIC cap (${cap:,.2f})."),
            forces_manual_approval=over_cap,
            hard_stop=over_cap,
        ))

    # Payment history.
    history_ok = prior_failed_payments == 0
    findings.append(RiskFinding(
        check=RiskCheck.PAYMENT_HISTORY,
        passed=history_ok,
        detail=(f"{prior_failed_payments} prior failed payment(s) on this customer."
                if not history_ok else "Clean payment history."),
        forces_manual_approval=prior_failed_payments >= 2,
    ))

    # Manual-approval trigger on amount — reuses the governance escalation
    # threshold so the risk engine and the Authority Matrix agree.
    over_threshold = amount_usd > BUDGET_ESCALATION_THRESHOLD
    findings.append(RiskFinding(
        check=RiskCheck.MANUAL_APPROVAL_TRIGGER,
        passed=True,  # not a failure; a routing of authority
        detail=(f"Amount ${amount_usd:,.2f} over ${BUDGET_ESCALATION_THRESHOLD:,.0f} "
                f"escalation threshold; manual approval required."
                if over_threshold else "Below escalation threshold."),
        forces_manual_approval=over_threshold,
    ))

    return RiskAssessment(findings=tuple(findings))


# ===========================================================================
# Governance tie — fund movement is always a human authorization
# ===========================================================================

# The single action type every fund-moving recommendation collapses to.
FUND_MOVEMENT_ACTION: str = "payment_approval"


def authority_for_fund_movement() -> AuthorityRule:
    """
    The Authority Matrix rule that governs releasing funds. It is BLOCKED ->
    ESCALATE by design: orchestration prepares, a human authorizes. Callers use
    this to prove (in tests and at runtime) that no orchestration path can grant
    autonomous execution of a payment.
    """
    rule = lookup_authority(FUND_MOVEMENT_ACTION)
    if rule is None:  # pragma: no cover - defensive; matrix defines this row
        raise RuntimeError("payment_approval missing from the Authority Matrix")
    return rule


def fund_movement_is_autonomous() -> bool:
    """Always False: the matrix never permits autonomous fund movement."""
    return authority_for_fund_movement().disposition is Disposition.EXECUTE


# ===========================================================================
# The four enterprise modules
# ===========================================================================


@dataclass(frozen=True)
class EnterpriseModule:
    number: int
    name: str
    status: ImplementationStatus
    governance_tag: TruthTag       # the strongest tag any output of this module may carry
    capabilities: tuple[str, ...]
    backed_by: tuple[str, ...]
    note: str = ""


ENTERPRISE_MODULES: tuple[EnterpriseModule, ...] = (
    EnterpriseModule(
        number=1,
        name="Intelligent Payment Routing",
        status=ImplementationStatus.PARTIAL,
        governance_tag=TruthTag.STAGED,
        capabilities=(
            "Lowest processing cost",
            "Customer preference",
            "ACH for invoices over a configurable threshold",
            "Automatic failover if a provider is unavailable",
            "International versus domestic routing",
        ),
        backed_by=("backend/config/payment_orchestration.py:recommend_processor",),
        note="Decision logic exists as a pure, STAGED recommender; live rail "
             "health signals and a cost model are still to wire in.",
    ),
    EnterpriseModule(
        number=2,
        name="Risk Engine",
        status=ImplementationStatus.PARTIAL,
        governance_tag=TruthTag.STAGED,
        capabilities=(
            "Fraud score",
            "Duplicate payment detection",
            "Change-order validation",
            "Deposit policy compliance",
            "Customer payment history",
            "Manual approval triggers for higher-risk cases",
        ),
        backed_by=("backend/config/payment_orchestration.py:evaluate_payment_risk",
                   "backend/models/job.py:deposit_gate_passed"),
        note="Duplicate/deposit-policy/history/threshold checks implemented; "
             "external fraud scoring is PLANNED (reported honestly, not faked).",
    ),
    EnterpriseModule(
        number=3,
        name="Treasury Command Center",
        status=ImplementationStatus.PLANNED,
        governance_tag=TruthTag.STAGED,
        capabilities=(
            "Cash-position forecasting",
            "Working-capital forecasting",
            "Vendor payment scheduling",
            "Equipment financing visibility",
            "Payroll forecasting",
            "Tax reserve tracking",
            "Insurance reserve tracking",
        ),
        backed_by=(),
        note="Not built. Vendor payment scheduling depends on the PLANNED "
             "Vendor Intelligence spine role (revenue_spine role #16).",
    ),
    EnterpriseModule(
        number=4,
        name="Executive AI Financial Advisor",
        status=ImplementationStatus.PARTIAL,
        governance_tag=TruthTag.LIVE,  # briefings are LIVE per the Authority Matrix
        capabilities=(
            "Projected cash runway",
            "Largest profit drivers",
            "Largest margin risks",
            "Collections requiring attention",
            "Forecasted labor shortages",
            "Material cost trends",
            "Revenue forecast",
            "Gross profit forecast",
            "Working capital forecast",
        ),
        backed_by=("backend/agents/stephanie.py:generate_ops_brief",
                   "backend/api/ops_brief.py"),
        note="Executive briefing exists and is LIVE; the financial-forecasting "
             "depth above is still being built on top of it. Advice only — "
             "every high-impact action remains human-authorized.",
    ),
)

MODULE_BY_NUMBER: dict[int, EnterpriseModule] = {m.number: m for m in ENTERPRISE_MODULES}


def get_module(number: int) -> EnterpriseModule:
    try:
        return MODULE_BY_NUMBER[number]
    except KeyError as exc:
        raise ValueError(f"Unknown enterprise module: {number}") from exc


def modules_by_status(status: ImplementationStatus) -> list[EnterpriseModule]:
    return [m for m in ENTERPRISE_MODULES if m.status == status]


# ===========================================================================
# Five-phase implementation roadmap
# ===========================================================================


@dataclass(frozen=True)
class RoadmapPhase:
    number: int
    name: str
    deliverables: tuple[str, ...]
    status: ImplementationStatus


ROADMAP: tuple[RoadmapPhase, ...] = (
    RoadmapPhase(
        number=1,
        name="Payment Hub",
        deliverables=("Stripe", "PayPal", "Apple Pay", "Google Pay", "ACH", "Client Portal"),
        status=ImplementationStatus.PARTIAL,
    ),
    RoadmapPhase(
        number=2,
        name="Revenue Spine",
        deliverables=("Proposal", "eSign", "Deposits", "Job creation", "FieldOps",
                      "QuickBooks synchronization"),
        status=ImplementationStatus.PARTIAL,
    ),
    RoadmapPhase(
        number=3,
        name="Intelligence",
        deliverables=("AI routing", "Executive dashboard", "Cash-flow forecasting",
                      "Job-cost analytics", "WIP reporting"),
        status=ImplementationStatus.PARTIAL,
    ),
    RoadmapPhase(
        number=4,
        name="Enterprise",
        deliverables=("Financing integrations", "Treasury management",
                      "Optional digital asset settlement module",
                      "Carbon registry integration", "Solar incentive integration"),
        status=ImplementationStatus.PLANNED,
    ),
    RoadmapPhase(
        number=5,
        name="Stephanie.ai",
        deliverables=("Voice payments (with strong authentication)",
                      "Executive briefings", "Predictive financial planning",
                      "Autonomous recommendations presented for human approval",
                      "Continuous learning from completed projects"),
        status=ImplementationStatus.PLANNED,
    ),
)

PHASE_BY_NUMBER: dict[int, RoadmapPhase] = {p.number: p for p in ROADMAP}


def get_phase(number: int) -> RoadmapPhase:
    try:
        return PHASE_BY_NUMBER[number]
    except KeyError as exc:
        raise ValueError(f"Unknown roadmap phase: {number}") from exc
