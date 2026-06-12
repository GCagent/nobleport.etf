"""
The 50-Module Catalog

Builds one ModuleSpec per control-register row. Each spec declares its
capabilities and its implementation bindings — repo paths that are checked
against the filesystem, exactly like the program manifest, so "bound" is
measured rather than asserted. Modules with no artifacts yet are honest
scaffolds; nothing in this catalog pretends to be built.
"""

from __future__ import annotations

from backend.stephanie.framework import ModuleSpec
from backend.systems.control_register import CONTROL_REGISTER

# capabilities + implementation bindings per register key. Keys absent here
# get a generic capability and no bindings (scaffold).
_EXTRAS: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "stephanie_core": (
        ("route_intake", "generate_ops_brief", "log_decisions"),
        ("backend/agents/stephanie.py", "backend/agents/orchestrator.py"),
    ),
    "construction_intake": (
        ("capture_lead", "classify_project", "create_intake"),
        ("backend/api/leads.py", "backend/models/lead.py"),
    ),
    "construction_orchestration": (
        ("advance_revenue_loop", "stage_gates", "pipeline_snapshot"),
        ("backend/core/revenue_loop.py", "backend/services/revenue_engine.py"),
    ),
    "scope_estimate_engine": (
        ("create_estimate", "markup_calculation", "deposit_calculation"),
        ("backend/services/revenue_engine.py", "backend/api/estimates.py"),
    ),
    "proposal_generator": (
        ("build_proposal", "payment_schedule", "scope_lines"),
        ("src/lib/roofing/proposals.ts",),
    ),
    "awo_flow": (
        ("create_change_order", "approve_change_order"),
        ("backend/api/change_orders.py", "backend/models/change_order.py"),
    ),
    "invoice_payment_tracking": (
        ("list_invoices", "track_payment_status", "deposit_gate"),
        ("backend/api/invoices.py", "backend/api/payments.py"),
    ),
    "change_order_ledger": (
        ("append", "verify_chain", "net_delta"),
        ("backend/stephanie/impl/change_order_ledger.py",),
    ),
    "job_cost_tracker": (
        ("track_costs", "margin_calculation"),
        ("backend/models/job.py",),
    ),
    "production_board": (
        ("milestones", "job_health", "blockers"),
        ("src/app/dashboard/jobs/page.tsx",),
    ),
    "gcagent": (
        ("coordinate_workflow", "advise"),
        ("backend/agents/gcagent.py",),
    ),
    "gcagent_compliance": (
        ("flag_compliance_state", "detect_anomalies"),
        ("backend/agents/gcagent.py",),
    ),
    "permitstream": (
        ("assess_permit_risk", "forecast_timeline", "check_zoning", "ahj_intelligence"),
        ("backend/agents/permit_stream.py",),
    ),
    "manual_permit_fallback": (
        ("prepare_permit_package",),
        ("backend/agents/permit_stream.py",),
    ),
    "roofing_takeoff": (
        ("takeoff",),
        ("backend/stephanie/impl/roofing_takeoff.py",),
    ),
    "stripe_mercury_node": (
        ("create_checkout", "verify_webhook", "handle_events"),
        ("backend/services/stripe_service.py",),
    ),
    "admin_approval_gate": (
        ("classify_action", "stage_for_human"),
        ("backend/governance/stephanie_gate.py",),
    ),
    "jsonl_ledger": (
        ("record_trust_event", "verify_chain"),
        ("backend/core/proof_of_trust.py",),
    ),
    "hubspot_router": (
        ("sync_deals", "handle_webhook"),
        ("backend/services/hubspot_sync.py",),
    ),
    "sales_sim_layer": (
        ("run_simulation", "gppi_leaderboard", "route_leads"),
        ("backend/sales/simulation.py", "backend/sales/gppi.py"),
    ),
    "daily_exec_brief": (
        ("generate_ops_brief",),
        ("backend/api/ops_brief.py", "backend/agents/stephanie.py"),
    ),
    "lead_command_pipeline": (
        ("grade_lead", "route_leads"),
        ("backend/sales/lead_routing.py",),
    ),
    "kuzo_safe_swap": (
        ("quote", "simulate", "policy_check"),
        ("backend/trading/broker.py", "backend/trading/strategy.py"),
    ),
    "kuzo_dashboard": (
        ("feed", "trade_log", "alerts"),
        ("backend/trading/mcp_server.py",),
    ),
    "kuzo_policy_engine": (
        ("allowlist", "slippage_gate", "notional_caps"),
        ("backend/trading/risk.py",),
    ),
    "nbpt_contracts": (
        ("erc1400_token", "approval_gateway"),
        ("contracts/NBPTSecurityToken1400.sol", "contracts/HumanApprovalGateway.sol"),
    ),
    "nbpt_token_economy": (
        ("token_model",),
        ("docs/tokenization/erc1400-nbpt-usdc.md",),
    ),
    "zksbt_identity": (
        ("did_resolution",),
        ("src/lib/ensDidResolver.ts",),
    ),
    "cyborg_identity": (
        ("identity_architecture", "kill_switches"),
        ("backend/agents/cyborg.py",),
    ),
    "audit_beacon_sol": (
        ("audit_trail",),
        ("backend/agents/audit_beacon.py",),
    ),
    "stephanie_voice_video": (
        ("voice_console", "transcripts"),
        ("src/components/dashboard/VoiceConsole.tsx", "src/app/dashboard/voice/page.tsx"),
    ),
}

_DEFAULT_CAPABILITY = ("specified",)


def build_catalog() -> list[ModuleSpec]:
    """All 50 register rows as ModuleSpecs — bound where artifacts exist."""
    specs: list[ModuleSpec] = []
    for row in CONTROL_REGISTER:
        capabilities, bindings = _EXTRAS.get(row.key, (_DEFAULT_CAPABILITY, ()))
        specs.append(
            ModuleSpec(
                key=row.key,
                name=row.name,
                register_num=row.num,
                category=row.category,
                function=row.function,
                bucket=row.bucket,
                capabilities=capabilities,
                bindings=bindings,
                human_gated=row.human_gated,
            )
        )
    return specs
