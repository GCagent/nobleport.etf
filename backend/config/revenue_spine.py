"""
Revenue Spine

The core operational workflow that everything else supports.
Every feature, agent, and integration exists to accelerate this sequence:

    Lead → Intake → Estimate → Permit → Build → Invoice → Closeout

This module defines the canonical stages, their gates, and the system
surfaces that power each transition. The revenue spine is the product.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class SpineStage(str, Enum):
    LEAD = "lead"
    INTAKE = "intake"
    ESTIMATE = "estimate"
    PERMIT = "permit"
    BUILD = "build"
    INVOICE = "invoice"
    CLOSEOUT = "closeout"


@dataclass(frozen=True)
class StageGate:
    """Condition that must be met before advancing to the next stage."""
    name: str
    enforced: bool
    human_required: bool


@dataclass(frozen=True)
class SpineStageConfig:
    stage: SpineStage
    display_name: str
    systems: tuple[str, ...]
    gates: tuple[StageGate, ...]
    kpis: tuple[str, ...]


REVENUE_SPINE: tuple[SpineStageConfig, ...] = (
    SpineStageConfig(
        stage=SpineStage.LEAD,
        display_name="Lead Capture",
        systems=("Stephanie.ai", "HubSpot", "Website"),
        gates=(
            StageGate("contact_info_captured", enforced=True, human_required=False),
            StageGate("project_type_classified", enforced=True, human_required=False),
        ),
        kpis=("lead_volume", "response_time_hours", "source_attribution"),
    ),
    SpineStageConfig(
        stage=SpineStage.INTAKE,
        display_name="Project Intake",
        systems=("Stephanie.ai", "LiveKit", "Google Calendar"),
        gates=(
            StageGate("voice_intake_completed", enforced=True, human_required=False),
            StageGate("site_visit_scheduled", enforced=False, human_required=True),
            StageGate("scope_documented", enforced=True, human_required=False),
        ),
        kpis=("intake_completion_rate", "avg_intake_duration_min", "homeowner_nps"),
    ),
    SpineStageConfig(
        stage=SpineStage.ESTIMATE,
        display_name="Estimate & Proposal",
        systems=("GCagent.ai", "Backend", "Stripe"),
        gates=(
            StageGate("estimate_generated", enforced=True, human_required=False),
            StageGate("estimate_reviewed_by_pm", enforced=True, human_required=True),
            StageGate("proposal_sent", enforced=True, human_required=True),
            StageGate("deposit_collected", enforced=True, human_required=False),
        ),
        kpis=("estimate_turnaround_days", "win_rate", "avg_deal_value"),
    ),
    SpineStageConfig(
        stage=SpineStage.PERMIT,
        display_name="Permitting",
        systems=("PermitStream.ai", "AHJ Portals"),
        gates=(
            StageGate("permit_application_prepared", enforced=True, human_required=False),
            StageGate("permit_submitted_by_human", enforced=True, human_required=True),
            StageGate("permit_issued", enforced=True, human_required=False),
        ),
        kpis=("permit_cycle_days", "correction_rate", "ahj_median_days"),
    ),
    SpineStageConfig(
        stage=SpineStage.BUILD,
        display_name="Construction",
        systems=("GCagent.ai", "Buildertrend", "Field Crews"),
        gates=(
            StageGate("mobilization_complete", enforced=True, human_required=True),
            StageGate("gp_above_floor", enforced=True, human_required=False),
            StageGate("inspections_passed", enforced=True, human_required=True),
        ),
        kpis=("schedule_variance_days", "gp_forecast_pct", "rfi_resolution_days"),
    ),
    SpineStageConfig(
        stage=SpineStage.INVOICE,
        display_name="Invoicing & Collections",
        systems=("Backend", "Stripe", "QuickBooks"),
        gates=(
            StageGate("milestone_invoiced", enforced=True, human_required=False),
            StageGate("payment_received", enforced=True, human_required=False),
        ),
        kpis=("ar_days", "collection_rate", "overdue_amount"),
    ),
    SpineStageConfig(
        stage=SpineStage.CLOSEOUT,
        display_name="Project Closeout",
        systems=("GCagent.ai", "Backend"),
        gates=(
            StageGate("punch_list_complete", enforced=True, human_required=True),
            StageGate("final_invoice_paid", enforced=True, human_required=False),
            StageGate("warranty_docs_delivered", enforced=True, human_required=True),
        ),
        kpis=("closeout_cycle_days", "final_gp_pct", "client_satisfaction"),
    ),
)


def get_stage(stage: SpineStage) -> SpineStageConfig:
    for config in REVENUE_SPINE:
        if config.stage == stage:
            return config
    raise ValueError(f"Unknown stage: {stage}")


def get_human_required_gates() -> list[tuple[SpineStage, StageGate]]:
    """All gates across the spine that require human action."""
    return [
        (config.stage, gate)
        for config in REVENUE_SPINE
        for gate in config.gates
        if gate.human_required
    ]


def get_enforced_gates() -> list[tuple[SpineStage, StageGate]]:
    """All gates that are currently enforced (blocking advancement)."""
    return [
        (config.stage, gate)
        for config in REVENUE_SPINE
        for gate in config.gates
        if gate.enforced
    ]


# ===========================================================================
# 20-Agent Revenue Spine — role decomposition
# ===========================================================================
#
# The "20-agent revenue spine" is not 20 standalone services. It is the
# revenue spine above, decomposed into the twenty operational ROLES that move
# a job from first contact to closeout — each one owned by an agent in the
# NoblePort mesh (backend/agents) and, where built, reachable as a routed task
# through the AgentMesh orchestrator (backend/agents/orchestrator.EVENT_ROUTING).
#
# This table is the single source of truth for "where does role N live?".
# It maps each role to:
#   - its owning spine stage (None for cross-cutting governance/executive roles),
#   - the agent family that owns it (string mirrors agents.base.AgentFamily),
#   - the mesh task that delivers it today (None if not yet wired), and
#   - an honest implementation status backed by concrete modules.
#
# It deliberately references EXISTING code rather than inventing a parallel
# system. Genuinely-unbuilt roles are marked PLANNED, not dressed up as done.


class ImplementationStatus(str, Enum):
    """How much of a role actually exists in the codebase today."""

    IMPLEMENTED = "implemented"  # Wired into the mesh / backed by real models & services
    PARTIAL = "partial"          # Core path exists; some sub-capabilities still to build
    PLANNED = "planned"          # Decomposed and assigned, but not yet built


# Agent family identifiers. These mirror backend.agents.base.AgentFamily by
# VALUE so this config module stays import-light (no dependency on the agent
# mesh). The cross-check that these stay in sync lives in the test suite.
class SpineAgentFamily(str, Enum):
    STEPHANIE = "Stephanie"
    GCAGENT = "GCagent"
    PERMIT_STREAM = "PermitStream"
    CYBORG = "Cyborg"
    AUDIT_BEACON = "AuditBeacon"
    RECURSIVE_LEARNING = "RecursiveLearning"
    JOURNEY = "Journey"


@dataclass(frozen=True)
class SpineRoleConfig:
    """One of the twenty roles that compose the revenue spine."""

    number: int                       # Canonical role number, 1..20
    role: str                         # Human-readable name, e.g. "Lead Intake"
    stage: SpineStage | None          # Owning stage; None = cross-cutting layer
    agent_family: SpineAgentFamily    # Agent that owns this role
    primary_task: str | None          # AgentMesh routed task delivering it (None if unwired)
    status: ImplementationStatus
    backed_by: tuple[str, ...]        # Concrete modules/models/services that implement it
    notes: str = ""


REVENUE_SPINE_ROLES: tuple[SpineRoleConfig, ...] = (
    SpineRoleConfig(
        number=1,
        role="Lead Intake",
        stage=SpineStage.LEAD,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task="lead_created",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/lead.py", "backend/api/leads.py",
                   "backend/agents/stephanie.py:route_intake"),
    ),
    SpineRoleConfig(
        number=2,
        role="Qualification",
        stage=SpineStage.INTAKE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task="route_intake",
        status=ImplementationStatus.PARTIAL,
        backed_by=("backend/agents/stephanie.py:route_intake",),
        notes="Value/source/address heuristics live in route_intake; a dedicated "
              "weighted qualification score is not yet a separate model.",
    ),
    SpineRoleConfig(
        number=3,
        role="Estimate",
        stage=SpineStage.ESTIMATE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task="estimate_created",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/estimate.py", "backend/api/estimates.py",
                   "backend/services/proposal_engine.py"),
    ),
    SpineRoleConfig(
        number=4,
        role="Proposal",
        stage=SpineStage.ESTIMATE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task="estimate_sent",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/proposal.py", "backend/api/proposals.py",
                   "backend/services/proposal_engine.py"),
    ),
    SpineRoleConfig(
        number=5,
        role="Contract",
        stage=SpineStage.ESTIMATE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task=None,
        status=ImplementationStatus.PLANNED,
        backed_by=("backend/core/np_os.py (Contracts table)",
                   "src/lib/nemoclaw/signer-gateway.ts"),
        notes="Contracts are catalogued in NP-OS and the signing gateway exists "
              "on the frontend; a backend contract model/agent task is not built.",
    ),
    SpineRoleConfig(
        number=6,
        role="eSign",
        stage=SpineStage.ESTIMATE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task=None,
        status=ImplementationStatus.PLANNED,
        backed_by=("src/lib/nemoclaw/signer-gateway.ts",
                   "contracts/HumanApprovalGateway.sol"),
        notes="Human-approval signing gate is enforced today via the proposal "
              "deposit gate; a dedicated envelope-tracking agent task is planned.",
    ),
    SpineRoleConfig(
        number=7,
        role="Deposit Collection",
        stage=SpineStage.ESTIMATE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task="estimate_won",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/job.py:deposit_gate_passed",
                   "backend/services/proposal_engine.py",
                   "backend/services/stripe_service.py"),
    ),
    SpineRoleConfig(
        number=8,
        role="Payment Node",
        stage=SpineStage.INVOICE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task=None,
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/payment.py", "backend/api/payments.py",
                   "backend/services/stripe_service.py"),
        notes="Delivered as a Stripe service + webhook flow rather than a mesh "
              "task; reconciliation writes to the payments ledger.",
    ),
    SpineRoleConfig(
        number=9,
        role="PermitStream",
        stage=SpineStage.PERMIT,
        agent_family=SpineAgentFamily.PERMIT_STREAM,
        primary_task="assess_permit_risk",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/agents/permit_stream.py", "backend/models/permit.py"),
    ),
    SpineRoleConfig(
        number=10,
        role="Inspection",
        stage=SpineStage.PERMIT,
        agent_family=SpineAgentFamily.PERMIT_STREAM,
        primary_task="track_inspection_schedule",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/inspection.py",
                   "backend/agents/permit_stream.py:track_inspection_schedule"),
    ),
    SpineRoleConfig(
        number=11,
        role="Change Order",
        stage=SpineStage.BUILD,
        agent_family=SpineAgentFamily.GCAGENT,
        primary_task="detect_scope_creep",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/change_order.py", "backend/api/change_orders.py",
                   "backend/agents/gcagent.py:detect_scope_creep"),
    ),
    SpineRoleConfig(
        number=12,
        role="Production",
        stage=SpineStage.BUILD,
        agent_family=SpineAgentFamily.GCAGENT,
        primary_task="assess_job_health",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/agents/gcagent.py:assess_job_health",
                   "backend/agents/gcagent.py:forecast_schedule",
                   "backend/models/job.py", "backend/models/schedule.py"),
    ),
    SpineRoleConfig(
        number=13,
        role="Daily Log",
        stage=SpineStage.BUILD,
        agent_family=SpineAgentFamily.GCAGENT,
        primary_task="daily_log_submitted",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/models/daily_log.py",
                   "backend/agents/gcagent.py:generate_daily_field_report"),
    ),
    SpineRoleConfig(
        number=14,
        role="Margin Protection",
        stage=SpineStage.BUILD,
        agent_family=SpineAgentFamily.GCAGENT,
        primary_task="analyze_cost_variance",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/agents/gcagent.py:analyze_cost_variance",),
    ),
    SpineRoleConfig(
        number=15,
        role="Collections",
        stage=SpineStage.INVOICE,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task=None,
        status=ImplementationStatus.PLANNED,
        backed_by=("backend/models/invoice.py", "backend/api/invoices.py"),
        notes="Invoice model carries balance_due/due_date; an aging + dunning "
              "agent task is not yet built.",
    ),
    SpineRoleConfig(
        number=16,
        role="Vendor Intelligence",
        stage=SpineStage.BUILD,
        agent_family=SpineAgentFamily.GCAGENT,
        primary_task=None,
        status=ImplementationStatus.PLANNED,
        backed_by=("backend/core/np_os.py (Vendors table)",),
        notes="Vendors are catalogued in NP-OS; a vendor model and scoring task "
              "are not yet built.",
    ),
    SpineRoleConfig(
        number=17,
        role="Executive Briefing",
        stage=None,
        agent_family=SpineAgentFamily.STEPHANIE,
        primary_task="generate_ops_brief",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/agents/stephanie.py:generate_ops_brief",
                   "backend/api/ops_brief.py"),
        notes="Cross-cutting: synthesizes signals from every stage.",
    ),
    SpineRoleConfig(
        number=18,
        role="Memory Governance",
        stage=None,
        agent_family=SpineAgentFamily.CYBORG,
        primary_task="audit_compliance",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/governance/truth_layer.py",
                   "backend/governance/authority_matrix.py",
                   "backend/learning/memory.py"),
        notes="Cross-cutting: Truth-Layer tagging governs every output.",
    ),
    SpineRoleConfig(
        number=19,
        role="Authority Chain",
        stage=None,
        agent_family=SpineAgentFamily.AUDIT_BEACON,
        primary_task="verify_chain_integrity",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/agents/audit_beacon.py",
                   "backend/core/proof_of_trust.py",
                   "backend/governance/authority_matrix.py"),
        notes="Cross-cutting: hash-chain ledger + authority verification.",
    ),
    SpineRoleConfig(
        number=20,
        role="Closeout",
        stage=SpineStage.CLOSEOUT,
        agent_family=SpineAgentFamily.GCAGENT,
        primary_task="generate_closeout_package",
        status=ImplementationStatus.IMPLEMENTED,
        backed_by=("backend/agents/gcagent.py:generate_closeout_package",
                   "backend/models/project.py", "backend/models/permit.py",
                   "backend/models/inspection.py", "backend/models/invoice.py",
                   "backend/models/payment.py", "backend/models/media.py"),
    ),
)


def get_role(number: int) -> SpineRoleConfig:
    """Return the role config for a canonical role number (1..20)."""
    for role in REVENUE_SPINE_ROLES:
        if role.number == number:
            return role
    raise ValueError(f"Unknown spine role number: {number}")


def roles_for_stage(stage: SpineStage) -> list[SpineRoleConfig]:
    """All roles owned by a given spine stage."""
    return [r for r in REVENUE_SPINE_ROLES if r.stage == stage]


def roles_for_family(family: SpineAgentFamily) -> list[SpineRoleConfig]:
    """All roles owned by a given agent family."""
    return [r for r in REVENUE_SPINE_ROLES if r.agent_family == family]


def roles_by_status(status: ImplementationStatus) -> list[SpineRoleConfig]:
    """All roles at a given implementation status."""
    return [r for r in REVENUE_SPINE_ROLES if r.status == status]


def unbuilt_roles() -> list[SpineRoleConfig]:
    """Roles still to build — the honest backlog for the 20-agent spine."""
    return [
        r for r in REVENUE_SPINE_ROLES
        if r.status is not ImplementationStatus.IMPLEMENTED
    ]
