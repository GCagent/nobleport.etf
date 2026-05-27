"""
NoblePort 50-Module Registry + Agent Tool Definitions

Canonical seed data for the internal MCP operating model.
Every module starts at BLOCKED until its source table is wired.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModuleDef:
    module_id: int
    module_name: str
    owner_agent: str
    layer: str
    kpi_name: str
    kpi_unit: str
    source_table: str | None
    blocked_reason: str
    next_action: str


@dataclass(frozen=True)
class ToolDef:
    agent_name: str
    tool_name: str
    module_name: str
    approval_level: str
    write_capable: bool
    description: str


# ─── Agent Definitions ────────────────────────────────────────

AGENT_DEFINITIONS: list[dict] = [
    {
        "agent_name": "Stephanie.ai",
        "endpoint": "http://localhost:3100/mcp",
        "owner_domain": "stephanie.nobleport.eth",
        "status": "staged",
        "description": "Executive orchestrator / front door",
        "hard_boundary": "Routes, summarizes, recommends. No direct execution.",
    },
    {
        "agent_name": "GCagent.ai",
        "endpoint": "http://localhost:3200/mcp",
        "owner_domain": "gcagent.nobleport.eth",
        "status": "staged",
        "description": "Construction execution, estimating, scope, field ops",
        "hard_boundary": "No permit approval, no legal signoff.",
    },
    {
        "agent_name": "PermitStream.ai",
        "endpoint": "http://localhost:3300/mcp",
        "owner_domain": "permitstream.nobleport.eth",
        "status": "staged",
        "description": "Permit intake, AHJ rules, deficiency checks",
        "hard_boundary": "No stamped engineering judgment.",
    },
    {
        "agent_name": "Cyborg.ai",
        "endpoint": "http://localhost:3400/mcp",
        "owner_domain": "cyborg.nobleport.eth",
        "status": "staged",
        "description": "Security, policy, compliance, risk gates",
        "hard_boundary": "No treasury movement.",
    },
    {
        "agent_name": "Borg.ai",
        "endpoint": "http://localhost:3500/mcp",
        "owner_domain": "borg.nobleport.eth",
        "status": "staged",
        "description": "System automation, infrastructure, job runners",
        "hard_boundary": "No autonomous write without audit.",
    },
    {
        "agent_name": "Kuzo.io",
        "endpoint": "http://localhost:3600/mcp",
        "owner_domain": "kuzo.nobleport.eth",
        "status": "staged",
        "description": "Customer/vendor/project interface layer",
        "hard_boundary": "No source-of-truth mutation without validation.",
    },
]


# ─── 50 Modules ──────────────────────────────────────────────

MODULE_DEFINITIONS: tuple[ModuleDef, ...] = (
    # Executive / Platform Layer (1-10)
    ModuleDef(1, "Executive Command Center", "Stephanie.ai", "Executive", "Daily decisions routed", "count", "mcp_call_log", "", ""),
    ModuleDef(2, "Lead Intake", "Stephanie.ai", "Executive", "New leads captured", "count", "leads", "", ""),
    ModuleDef(3, "Customer Profile Engine", "Kuzo.io", "Executive", "Complete client profiles", "count", "customer_profiles", "", ""),
    ModuleDef(4, "Project Registry", "Stephanie.ai", "Executive", "Active projects", "count", "projects", "", ""),
    ModuleDef(5, "Workflow Router", "Stephanie.ai", "Executive", "Correct routing rate", "percent", "mcp_call_log", "", ""),
    ModuleDef(6, "Approval Queue", "Cyborg.ai", "Executive", "Pending human approvals", "count", "approval_events", "", ""),
    ModuleDef(7, "AuditBeacon", "Cyborg.ai", "Executive", "Actions audit-logged", "percent", "audit_log", "", ""),
    ModuleDef(8, "Truth Ledger", "Cyborg.ai", "Executive", "LIVE/MODELED/BLOCKED ratio", "ratio", "nobleport_module_registry", "", ""),
    ModuleDef(9, "Notification Center", "Kuzo.io", "Executive", "Alerts acknowledged", "count", "notifications", "", ""),
    ModuleDef(10, "KPI Dashboard", "Stephanie.ai", "Executive", "Modules reporting live data", "count", "kpi_snapshot", "", ""),

    # Construction / GCagent.ai Layer (11-20)
    ModuleDef(11, "Estimate Engine", "GCagent.ai", "Construction", "Estimates created per week", "count", "estimates", "", ""),
    ModuleDef(12, "Scope Builder", "GCagent.ai", "Construction", "Scope line items generated", "count", "scope_items", "", ""),
    ModuleDef(13, "AWO Engine", "GCagent.ai", "Construction", "AWOs identified / approved / invoiced", "count", "change_orders", "", ""),
    ModuleDef(14, "Job Costing", "GCagent.ai", "Construction", "Actual vs budget variance", "currency", "jobs", "", ""),
    ModuleDef(15, "Schedule Builder", "GCagent.ai", "Construction", "Schedule slippage days", "days", "schedule_items", "", ""),
    ModuleDef(16, "Subcontractor Manager", "GCagent.ai", "Construction", "Sub response time", "hours", "vendor_comms", "", ""),
    ModuleDef(17, "Material Procurement", "GCagent.ai", "Construction", "Materials ordered on time", "percent", "purchase_orders", "", ""),
    ModuleDef(18, "Field Daily Logs", "GCagent.ai", "Construction", "Logs submitted per active job", "count", "daily_logs", "", ""),
    ModuleDef(19, "Punch List", "GCagent.ai", "Construction", "Open punch items", "count", "punch_list", "", ""),
    ModuleDef(20, "Closeout Package", "GCagent.ai", "Construction", "Closeout completion percent", "percent", "closeout_docs", "", ""),

    # PermitStream.ai Layer (21-30)
    ModuleDef(21, "Permit Intake", "PermitStream.ai", "Permitting", "Permit packets started", "count", "permit_intake", "", ""),
    ModuleDef(22, "AHJ Rules Engine", "PermitStream.ai", "Permitting", "Jurisdictions supported", "count", "ahj_rulesets", "", ""),
    ModuleDef(23, "Deficiency Checker", "PermitStream.ai", "Permitting", "Issues found before submission", "count", "deficiency_log", "", ""),
    ModuleDef(24, "Document Checklist", "PermitStream.ai", "Permitting", "Missing docs per permit", "count", "doc_checklist", "", ""),
    ModuleDef(25, "Zoning Review", "PermitStream.ai", "Permitting", "Zoning risks flagged", "count", "zoning_review", "", ""),
    ModuleDef(26, "Conservation Trigger", "PermitStream.ai", "Permitting", "Wetland / flood flags", "count", "conservation_flags", "", ""),
    ModuleDef(27, "Structural Stamp Tracker", "PermitStream.ai", "Permitting", "Engineering stamps required", "count", "stamp_requirements", "", ""),
    ModuleDef(28, "Inspection Scheduler", "PermitStream.ai", "Permitting", "Inspections scheduled / pass / fail", "count", "inspections", "", ""),
    ModuleDef(29, "Rejection Tracker", "PermitStream.ai", "Permitting", "Rejections prevented / received", "count", "permit_rejections", "", ""),
    ModuleDef(30, "CO / Final Approval", "PermitStream.ai", "Permitting", "Final approvals received", "count", "certificates_of_occupancy", "", ""),

    # Security / Cyborg.ai Layer (31-40)
    ModuleDef(31, "Policy Gate", "Cyborg.ai", "Security", "Policy checks passed / failed", "count", "policy_events", "", ""),
    ModuleDef(32, "Identity / Role Access", "Cyborg.ai", "Security", "Unauthorized attempts blocked", "count", "auth_events", "", ""),
    ModuleDef(33, "Prompt Injection Defense", "Cyborg.ai", "Security", "Suspicious prompts blocked", "count", "ai_security_logs", "", ""),
    ModuleDef(34, "Tool Permission Guard", "Cyborg.ai", "Security", "Denied tool calls", "count", "mcp_call_log", "", ""),
    ModuleDef(35, "Treasury Firewall", "Cyborg.ai", "Security", "Unauthorized treasury attempts", "count", "treasury_events", "", ""),
    ModuleDef(36, "Vendor Risk Check", "Cyborg.ai", "Security", "Vendors missing docs", "count", "vendor_compliance", "", ""),
    ModuleDef(37, "Insurance / License Tracker", "Cyborg.ai", "Security", "Expired docs", "count", "compliance_docs", "", ""),
    ModuleDef(38, "Immutable Audit Chain", "Cyborg.ai", "Security", "Anchored audit events", "count", "audit_chain_anchors", "", ""),
    ModuleDef(39, "Incident Response", "Cyborg.ai", "Security", "Open incidents", "count", "incidents", "", ""),
    ModuleDef(40, "Risk Score Engine", "Cyborg.ai", "Security", "Project risk score", "score", "risk_scores", "", ""),

    # Borg.ai / Infrastructure Layer (41-50)
    ModuleDef(41, "Job Runner", "Borg.ai", "Infrastructure", "Successful automation runs", "count", "automation_runs", "", ""),
    ModuleDef(42, "Worker Health", "Borg.ai", "Infrastructure", "Worker uptime", "percent", "worker_health", "", ""),
    ModuleDef(43, "Queue Monitor", "Borg.ai", "Infrastructure", "Failed / delayed jobs", "count", "queue_metrics", "", ""),
    ModuleDef(44, "Backup Monitor", "Borg.ai", "Infrastructure", "Last successful backup", "timestamp", "backup_logs", "", ""),
    ModuleDef(45, "Deployment Tracker", "Borg.ai", "Infrastructure", "Deploy success rate", "percent", "deployments", "", ""),
    ModuleDef(46, "Error Monitor", "Borg.ai", "Infrastructure", "Open system errors", "count", "error_logs", "", ""),
    ModuleDef(47, "API Health", "Borg.ai", "Infrastructure", "Endpoint uptime / latency", "percent", "api_health_checks", "", ""),
    ModuleDef(48, "Database Health", "Borg.ai", "Infrastructure", "DB latency / storage / locks", "ms", "db_metrics", "", ""),
    ModuleDef(49, "File Processing", "Borg.ai", "Infrastructure", "PDFs / images processed", "count", "file_events", "", ""),
    ModuleDef(50, "Revenue Workflow Ops", "Borg.ai", "Infrastructure", "Lead-to-closeout conversion", "percent", "leads", "", ""),
)


# ─── Agent Tool Definitions ──────────────────────────────────

TOOL_DEFINITIONS: tuple[ToolDef, ...] = (
    # GCagent.ai
    ToolDef("GCagent.ai", "gcagent.create_scope", "Scope Builder", "L2", True, "Generate scope breakdown from intake data"),
    ToolDef("GCagent.ai", "gcagent.price_estimate", "Estimate Engine", "L2", True, "Create cost estimate from scope"),
    ToolDef("GCagent.ai", "gcagent.generate_awo", "AWO Engine", "L3", True, "Generate additional work order"),
    ToolDef("GCagent.ai", "gcagent.update_job_cost", "Job Costing", "L2", True, "Update actual costs against budget"),
    ToolDef("GCagent.ai", "gcagent.create_punch_list", "Punch List", "L2", True, "Create punch list from inspection"),
    ToolDef("GCagent.ai", "gcagent.generate_closeout_package", "Closeout Package", "L3", True, "Generate closeout documentation"),
    ToolDef("GCagent.ai", "gcagent.log_daily", "Field Daily Logs", "L1", True, "Submit daily field log"),
    ToolDef("GCagent.ai", "gcagent.update_schedule", "Schedule Builder", "L2", True, "Update project schedule"),
    ToolDef("GCagent.ai", "gcagent.request_material", "Material Procurement", "L2", True, "Create material purchase request"),
    ToolDef("GCagent.ai", "gcagent.manage_sub", "Subcontractor Manager", "L2", True, "Manage subcontractor communication"),

    # PermitStream.ai
    ToolDef("PermitStream.ai", "permitstream.check_ahj_requirements", "AHJ Rules Engine", "L0", False, "Look up AHJ requirements for jurisdiction"),
    ToolDef("PermitStream.ai", "permitstream.run_deficiency_scan", "Deficiency Checker", "L1", False, "Scan permit package for deficiencies"),
    ToolDef("PermitStream.ai", "permitstream.build_permit_checklist", "Document Checklist", "L1", True, "Build document checklist for permit"),
    ToolDef("PermitStream.ai", "permitstream.flag_engineer_stamp", "Structural Stamp Tracker", "L0", False, "Check if engineering stamp is required"),
    ToolDef("PermitStream.ai", "permitstream.schedule_inspection", "Inspection Scheduler", "L3", True, "Schedule inspection with AHJ"),
    ToolDef("PermitStream.ai", "permitstream.track_permit_status", "Permit Intake", "L0", False, "Get current permit status"),
    ToolDef("PermitStream.ai", "permitstream.check_zoning", "Zoning Review", "L0", False, "Review zoning compliance for parcel"),
    ToolDef("PermitStream.ai", "permitstream.check_conservation", "Conservation Trigger", "L0", False, "Check wetland/flood zone triggers"),
    ToolDef("PermitStream.ai", "permitstream.track_rejection", "Rejection Tracker", "L0", False, "Track AHJ rejection history"),
    ToolDef("PermitStream.ai", "permitstream.check_co_status", "CO / Final Approval", "L0", False, "Check certificate of occupancy status"),

    # Cyborg.ai
    ToolDef("Cyborg.ai", "cyborg.policy_check", "Policy Gate", "L0", False, "Run policy validation on action"),
    ToolDef("Cyborg.ai", "cyborg.security_scan_prompt", "Prompt Injection Defense", "L0", False, "Scan prompt for injection attempts"),
    ToolDef("Cyborg.ai", "cyborg.validate_tool_permission", "Tool Permission Guard", "L0", False, "Validate agent tool permission"),
    ToolDef("Cyborg.ai", "cyborg.verify_vendor_docs", "Vendor Risk Check", "L0", False, "Verify vendor compliance documents"),
    ToolDef("Cyborg.ai", "cyborg.score_project_risk", "Risk Score Engine", "L0", False, "Calculate project risk score"),
    ToolDef("Cyborg.ai", "cyborg.prewrite_audit_event", "Immutable Audit Chain", "L0", True, "Create pre-write audit event"),
    ToolDef("Cyborg.ai", "cyborg.check_insurance", "Insurance / License Tracker", "L0", False, "Check vendor insurance/license status"),
    ToolDef("Cyborg.ai", "cyborg.check_treasury_auth", "Treasury Firewall", "L4", False, "Validate treasury operation authorization"),
    ToolDef("Cyborg.ai", "cyborg.log_incident", "Incident Response", "L2", True, "Log security incident"),
    ToolDef("Cyborg.ai", "cyborg.check_identity", "Identity / Role Access", "L0", False, "Verify identity and role access"),

    # Borg.ai
    ToolDef("Borg.ai", "borg.run_job", "Job Runner", "L2", True, "Execute automation job"),
    ToolDef("Borg.ai", "borg.check_worker_health", "Worker Health", "L0", False, "Check worker process health"),
    ToolDef("Borg.ai", "borg.monitor_queue", "Queue Monitor", "L0", False, "Monitor job queue status"),
    ToolDef("Borg.ai", "borg.verify_backup", "Backup Monitor", "L0", False, "Verify last backup status"),
    ToolDef("Borg.ai", "borg.check_api_health", "API Health", "L0", False, "Check API endpoint health"),
    ToolDef("Borg.ai", "borg.process_file", "File Processing", "L1", True, "Process uploaded file (PDF/image)"),
    ToolDef("Borg.ai", "borg.check_db_health", "Database Health", "L0", False, "Check database performance metrics"),
    ToolDef("Borg.ai", "borg.track_deployment", "Deployment Tracker", "L0", False, "Track deployment status"),
    ToolDef("Borg.ai", "borg.check_errors", "Error Monitor", "L0", False, "Check open system errors"),
    ToolDef("Borg.ai", "borg.check_revenue_flow", "Revenue Workflow Ops", "L0", False, "Check revenue spine conversion metrics"),

    # Kuzo.io
    ToolDef("Kuzo.io", "kuzo.capture_lead", "Lead Intake", "L2", True, "Capture new lead from intake"),
    ToolDef("Kuzo.io", "kuzo.update_customer_profile", "Customer Profile Engine", "L2", True, "Update customer profile data"),
    ToolDef("Kuzo.io", "kuzo.send_customer_update", "Notification Center", "L3", True, "Send customer-facing update"),
    ToolDef("Kuzo.io", "kuzo.collect_document", "Customer Profile Engine", "L1", True, "Collect document from customer"),
    ToolDef("Kuzo.io", "kuzo.show_project_portal_status", "Project Registry", "L0", False, "Show project status for portal"),
    ToolDef("Kuzo.io", "kuzo.capture_customer_approval", "Approval Queue", "L3", True, "Capture customer approval for AWO/change"),
)


def get_modules_by_agent(agent_name: str) -> list[ModuleDef]:
    return [m for m in MODULE_DEFINITIONS if m.owner_agent == agent_name]


def get_modules_by_layer(layer: str) -> list[ModuleDef]:
    return [m for m in MODULE_DEFINITIONS if m.layer == layer]


def get_tools_by_agent(agent_name: str) -> list[ToolDef]:
    return [t for t in TOOL_DEFINITIONS if t.agent_name == agent_name]
