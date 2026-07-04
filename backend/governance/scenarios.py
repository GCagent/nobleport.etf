"""
Stephanie.ai — Governance Scenario Suite

A deterministic, reproducible set of actions that exercises every row of the
Authority Matrix plus the escalation triggers and fail-closed paths. Running
this suite through the gate yields a real, repeatable metrics baseline.

Honesty note: this is a *coverage* suite, not production traffic. It proves the
gate behaves correctly across the documented surface and gives a stable number
to track as rules change. It does not claim to represent real-world volume.
"""

from __future__ import annotations

from backend.governance.authority_matrix import Lane
from backend.governance.stephanie_gate import ActionRequest

# One request per Authority Matrix row, mapped to a representative lane, plus
# explicit escalation-trigger and fail-closed cases.
SCENARIO_SUITE: tuple[ActionRequest, ...] = (
    # --- Authority Matrix rows (Section 05) ---
    ActionRequest("construction_scope_draft", Lane.CONSTRUCTION, "Draft scope for kitchen remodel"),
    ActionRequest("change_order_preparation", Lane.CONSTRUCTION, "AWO for added electrical"),
    ActionRequest("payment_approval", Lane.CONSTRUCTION, "Approve $12k sub payment", amount_usd=12000),
    ActionRequest("permit_checklist_generation", Lane.PERMITSTREAM, "Newbury building permit checklist"),
    ActionRequest("legal_opinion", Lane.SYSTEMS, "Opinion on lien enforceability", regulated_action=True),
    ActionRequest("securities_trading", Lane.CAPITAL, "Rebalance token position", regulated_action=True),
    ActionRequest("investor_memo_draft", Lane.REALTY, "Memo for 236 High Road deal"),
    ActionRequest("engineering_certification", Lane.DESIGN_BUILD, "Stamp structural beam calc", regulated_action=True),
    ActionRequest("crm_routing", Lane.REALTY, "Route new lead to pipeline"),
    ActionRequest("executive_briefing", Lane.SYSTEMS, "Daily ops brief"),
    ActionRequest("budget_decision_over_5000", Lane.CONSTRUCTION, "Approve $8k material order", amount_usd=8000),

    # --- Escalation-trigger cases (Section 01) ---
    # A normally-LIVE action demoted by a >$5,000 budget trigger.
    ActionRequest("crm_routing", Lane.REALTY, "CRM action tied to $9k incentive", amount_usd=9000),
    # External stakeholder communication forces escalation.
    ActionRequest("executive_briefing", Lane.SYSTEMS, "Brief external investor", external_stakeholder=True),
    # Architectural change request.
    ActionRequest("executive_briefing", Lane.SYSTEMS, "Change agent mesh topology", architectural_change=True),

    # --- Fail-closed cases (unknown action types) ---
    ActionRequest("autonomous_wire_transfer", Lane.CAPITAL, "Unlisted action — must fail closed"),
    ActionRequest("file_mechanics_lien", Lane.CONSTRUCTION, "Unlisted legal action — must fail closed"),

    # --- Lane-restriction case ---
    # A LIVE-type action inside an execution-restricted lane.
    ActionRequest("crm_routing", Lane.KUZO_TRADING, "CRM in trading lane — restricted"),
)
