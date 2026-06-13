"""
NoblePort Construction Empire Registry

The single machine-readable map of every company, platform, module, and
integration in the NoblePort Construction ecosystem. Each entry carries a
DeploymentStatus from the Operational Truth Matrix, so the empire map can
never drift from ground truth: dashboards, investor decks, and the
/api/empire surface all read from this registry.

Status discipline (mirrors operational_truth.py):
  LIVE         Operational today, producing real-world effects.
  STAGED       Built/in development, requires human approval or hardening.
  MODELED      Designed and simulated; not yet verified as live production.
  INTERNAL_R&D Research track; no external claims permitted.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from backend.config.operational_truth import DeploymentStatus


class EmpireCategory(str, Enum):
    CORE_COMPANY = "core_company"
    OPERATIONS_PLATFORM = "operations_platform"
    MOBILE_PLATFORM = "mobile_platform"
    SALES_CRM = "sales_crm"
    FINANCIAL_PLATFORM = "financial_platform"
    SERVICE_PLATFORM = "service_platform"
    INFRASTRUCTURE = "infrastructure"
    WEB_PROPERTY = "web_property"


@dataclass(frozen=True)
class EmpireAsset:
    key: str
    name: str
    category: EmpireCategory
    status: DeploymentStatus
    description: str
    capabilities: tuple[str, ...] = ()
    integrations: tuple[str, ...] = ()
    repo_surface: str | None = None  # where the asset lives in this repository

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "name": self.name,
            "category": self.category.value,
            "status": self.status.value,
            "description": self.description,
            "capabilities": list(self.capabilities),
            "integrations": list(self.integrations),
            "repo_surface": self.repo_surface,
        }


EMPIRE_REGISTRY: tuple[EmpireAsset, ...] = (
    # ── Core construction companies ───────────────────────────────────
    EmpireAsset(
        key="nobleport_construction",
        name="NoblePort Construction LLC",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.LIVE,
        description="Primary general-contracting entity; revenue spine owner",
        capabilities=("general contracting", "estimating", "production"),
    ),
    EmpireAsset(
        key="nobleport_roofing",
        name="NoblePort Roofing & Restoration",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.LIVE,
        description="Roofing and restoration division",
        repo_surface="docs/ (roofing proposals: 20 61st Street, Newburyport)",
    ),
    EmpireAsset(
        key="nobleport_design_build",
        name="NoblePort Design & Build",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.LIVE,
        description="Design-build delivery arm: concept through execution",
    ),
    EmpireAsset(
        key="nobleport_re_development",
        name="NoblePort Real Estate Development LLC",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.STAGED,
        description="Development entity for owned-asset projects",
        repo_surface="docs/realty/236-high-road-newbury.md",
    ),
    EmpireAsset(
        key="nobleport_realty",
        name="NoblePort Realty",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.STAGED,
        description="Brokerage and asset-listing entity",
        repo_surface="docs/realty/",
    ),
    EmpireAsset(
        key="nobleport_capital",
        name="NoblePort Capital",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.MODELED,
        description="Capital/treasury entity; structures not yet verified live",
    ),
    EmpireAsset(
        key="nobleport_networks",
        name="NoblePort Networks",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.STAGED,
        description="Network infrastructure entity; claimed node metrics remain MODELED",
    ),
    EmpireAsset(
        key="nobleport_systems",
        name="NoblePort Systems",
        category=EmpireCategory.CORE_COMPANY,
        status=DeploymentStatus.STAGED,
        description="Software and platform-engineering entity",
    ),

    # ── Construction operations platforms ─────────────────────────────
    EmpireAsset(
        key="nobleport_os",
        name="NoblePort OS",
        category=EmpireCategory.OPERATIONS_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Central operating system across the revenue spine",
        capabilities=(
            "leads", "sales", "estimating", "contracts", "permits",
            "production", "billing", "change orders", "closeout",
        ),
        repo_surface="backend/ (FastAPI app: leads, estimates, jobs, payments, change orders)",
    ),
    EmpireAsset(
        key="bid_engine",
        name="Bid Engine",
        category=EmpireCategory.OPERATIONS_PLATFORM,
        status=DeploymentStatus.LIVE,
        description="Proposal generation and cost estimating",
        capabilities=(
            "proposal generation", "cost estimating", "scope development",
            "margin calculations", "client presentation",
        ),
        repo_surface="backend/api/estimates.py",
    ),
    EmpireAsset(
        key="pmagent",
        name="PMagent",
        category=EmpireCategory.OPERATIONS_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Construction operations controller",
        capabilities=(
            "scheduling", "budget tracking", "material procurement",
            "change orders", "job costing", "closeout documentation",
        ),
        repo_surface="backend/api/schedules.py, backend/api/change_orders.py",
    ),
    EmpireAsset(
        key="gcagent",
        name="GCagent.ai",
        category=EmpireCategory.OPERATIONS_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="General contractor workflow engine",
        capabilities=(
            "field operations", "daily logs", "trade coordination",
            "material tracking", "schedule management", "executive briefs",
        ),
        repo_surface="gcagent/, backend/agents/gcagent.py",
    ),
    EmpireAsset(
        key="permitstream",
        name="PermitStream",
        category=EmpireCategory.OPERATIONS_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Permit and compliance platform (MA municipalities)",
        capabilities=(
            "building permits", "inspection tracking", "zoning research",
            "regulatory monitoring", "municipal workflows",
        ),
        repo_surface="backend/agents/permit_stream.py, contracts/MassachusettsBuildingPermits.sol",
    ),
    EmpireAsset(
        key="stephanie",
        name="Stephanie.ai",
        category=EmpireCategory.OPERATIONS_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Executive AI coordination layer with executable governance",
        capabilities=(
            "workflow orchestration", "reporting", "routing",
            "notifications", "dashboard oversight",
        ),
        repo_surface="backend/agents/stephanie.py, backend/governance/",
    ),
    EmpireAsset(
        key="cyborg",
        name="Cyborg",
        category=EmpireCategory.OPERATIONS_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Security and infrastructure monitoring",
        capabilities=("system health", "security monitoring", "infrastructure oversight"),
        repo_surface="backend/agents/cyborg.py",
    ),

    # ── Mobile platforms ──────────────────────────────────────────────
    EmpireAsset(
        key="nobleport_mobile",
        name="NoblePort Mobile v2.7",
        category=EmpireCategory.MOBILE_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Field and executive mobile platform",
        capabilities=(
            "pipeline", "jobs", "change orders", "client operations",
            "web3", "executive dashboard", "production tracking",
        ),
    ),

    # ── Sales & CRM platforms ─────────────────────────────────────────
    EmpireAsset(
        key="trust_pipeline",
        name="Trust Pipeline",
        category=EmpireCategory.SALES_CRM,
        status=DeploymentStatus.LIVE,
        description="Stage-gated sales pipeline",
        capabilities=(
            "new lead", "trust fit qualified", "inspection scheduled",
            "estimate sent", "closed won", "nurture/lost",
        ),
        repo_surface="backend/api/trust.py, backend/api/leads.py",
    ),
    EmpireAsset(
        key="lead_command_center",
        name="Lead Command Center",
        category=EmpireCategory.SALES_CRM,
        status=DeploymentStatus.STAGED,
        description="Lead routing, territory assignment, agent management",
        repo_surface="backend/api/leads.py",
    ),
    EmpireAsset(
        key="sales_router",
        name="Sales Router",
        category=EmpireCategory.SALES_CRM,
        status=DeploymentStatus.STAGED,
        description="Opportunity distribution, lead scoring, follow-up management",
    ),
    EmpireAsset(
        key="estimate_board",
        name="Estimate Board",
        category=EmpireCategory.SALES_CRM,
        status=DeploymentStatus.LIVE,
        description="Proposal management, revision tracking, approval workflows",
        repo_surface="backend/api/estimates.py",
    ),
    EmpireAsset(
        key="deposit_gate",
        name="Deposit Gate",
        category=EmpireCategory.SALES_CRM,
        status=DeploymentStatus.STAGED,
        description="Contract-to-payment transition gate",
        repo_surface="backend/config/revenue_spine.py",
    ),

    # ── Financial platforms ───────────────────────────────────────────
    EmpireAsset(
        key="payment_node",
        name="NoblePort Payment Node",
        category=EmpireCategory.FINANCIAL_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Construction-only payment system (staged/hardened)",
        capabilities=(
            "payment approvals", "ledger management", "revenue tracking",
            "reconciliation", "customer payment portal",
        ),
        integrations=("stripe", "mercury"),
        repo_surface="backend/api/payments.py, backend/services/stripe_service.py",
    ),
    EmpireAsset(
        key="erc1400_finance",
        name="ERC-1400 Construction Finance",
        category=EmpireCategory.FINANCIAL_PLATFORM,
        status=DeploymentStatus.INTERNAL_RD,
        description="Security-token construction finance workflows; not live production",
        repo_surface="contracts/NBPTSecurityToken1400.sol, docs/tokenization/",
    ),
    EmpireAsset(
        key="re_tokenization",
        name="Real Estate Tokenization",
        category=EmpireCategory.FINANCIAL_PLATFORM,
        status=DeploymentStatus.INTERNAL_RD,
        description="Tokenized real estate / payment rails; not verified live",
        repo_surface="docs/tokenization/erc1400-land-parcel-playbook.md",
    ),

    # ── Service platforms ─────────────────────────────────────────────
    EmpireAsset(
        key="roofing_division",
        name="Roofing Division Platform",
        category=EmpireCategory.SERVICE_PLATFORM,
        status=DeploymentStatus.LIVE,
        description="Roofing estimating and proposals",
        capabilities=(
            "roof takeoffs", "material calculations",
            "aerial measurements", "proposal generation",
        ),
    ),
    EmpireAsset(
        key="property_maintenance",
        name="Property Maintenance Platform",
        category=EmpireCategory.SERVICE_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Membership management, recurring service scheduling, asset tracking",
        repo_surface="backend/models/maintenance.py",
    ),
    EmpireAsset(
        key="adu_platform",
        name="ADU Platform",
        category=EmpireCategory.SERVICE_PLATFORM,
        status=DeploymentStatus.STAGED,
        description="Intake, feasibility review, permit workflow, budget analysis",
    ),
    EmpireAsset(
        key="design_build_platform",
        name="Design-Build Platform",
        category=EmpireCategory.SERVICE_PLATFORM,
        status=DeploymentStatus.LIVE,
        description="Concept design, scope development, cost estimating, execution",
    ),

    # ── Technology infrastructure ─────────────────────────────────────
    EmpireAsset(
        key="replit_env",
        name="Replit Development Environment",
        category=EmpireCategory.INFRASTRUCTURE,
        status=DeploymentStatus.LIVE,
        description="Primary deployment platform",
    ),
    EmpireAsset(
        key="hubspot",
        name="HubSpot Integration",
        category=EmpireCategory.INFRASTRUCTURE,
        status=DeploymentStatus.STAGED,
        description="CRM and sales management sync",
        repo_surface="backend/services/hubspot_sync.py",
    ),
    EmpireAsset(
        key="telegram_connect",
        name="TelegramConnect",
        category=EmpireCategory.INFRASTRUCTURE,
        status=DeploymentStatus.STAGED,
        description="Field communications channel",
    ),
    EmpireAsset(
        key="docusign",
        name="DocuSign Integration",
        category=EmpireCategory.INFRASTRUCTURE,
        status=DeploymentStatus.STAGED,
        description="Contract execution",
    ),
    EmpireAsset(
        key="stripe",
        name="Stripe Payment Processing",
        category=EmpireCategory.INFRASTRUCTURE,
        status=DeploymentStatus.STAGED,
        description="Customer payments (staged/hardened workflows)",
        repo_surface="backend/services/stripe_service.py",
    ),
    EmpireAsset(
        key="mercury",
        name="Mercury Banking",
        category=EmpireCategory.INFRASTRUCTURE,
        status=DeploymentStatus.STAGED,
        description="Treasury management",
    ),

    # ── Web properties ────────────────────────────────────────────────
    EmpireAsset(
        key="web_nobleport_io",
        name="NoblePort.io",
        category=EmpireCategory.WEB_PROPERTY,
        status=DeploymentStatus.LIVE,
        description="Primary web property",
    ),
    EmpireAsset(
        key="web_nobleport_systems",
        name="NoblePort Systems site",
        category=EmpireCategory.WEB_PROPERTY,
        status=DeploymentStatus.STAGED,
        description="Systems entity web property",
    ),
    EmpireAsset(
        key="web_nobleport_net",
        name="NoblePort.net",
        category=EmpireCategory.WEB_PROPERTY,
        status=DeploymentStatus.STAGED,
        description="Networks entity web property",
    ),
    EmpireAsset(
        key="web_nobleport_roofing",
        name="NoblePort Roofing site",
        category=EmpireCategory.WEB_PROPERTY,
        status=DeploymentStatus.LIVE,
        description="Roofing division web property",
    ),
    EmpireAsset(
        key="web_nobleport_ai",
        name="NoblePort.ai",
        category=EmpireCategory.WEB_PROPERTY,
        status=DeploymentStatus.STAGED,
        description="AI platform web property",
    ),
)


_BY_KEY: dict[str, EmpireAsset] = {a.key: a for a in EMPIRE_REGISTRY}


def get_asset(key: str) -> EmpireAsset | None:
    return _BY_KEY.get(key)


def get_assets_by_category(category: EmpireCategory) -> list[EmpireAsset]:
    return [a for a in EMPIRE_REGISTRY if a.category == category]


def get_assets_by_status(status: DeploymentStatus) -> list[EmpireAsset]:
    return [a for a in EMPIRE_REGISTRY if a.status == status]


def get_operational_today() -> list[EmpireAsset]:
    """Assets safe to present as operational right now — LIVE only."""
    return get_assets_by_status(DeploymentStatus.LIVE)


def get_empire_summary() -> dict:
    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for asset in EMPIRE_REGISTRY:
        by_status[asset.status.value] = by_status.get(asset.status.value, 0) + 1
        by_category[asset.category.value] = by_category.get(asset.category.value, 0) + 1
    return {
        "total_assets": len(EMPIRE_REGISTRY),
        "by_status": by_status,
        "by_category": by_category,
        "live_assets": [a.key for a in get_operational_today()],
    }


def get_empire_map() -> dict:
    """Full empire map grouped by category, every asset truth-labeled."""
    grouped: dict[str, list[dict]] = {}
    for asset in EMPIRE_REGISTRY:
        grouped.setdefault(asset.category.value, []).append(asset.to_dict())
    return {"summary": get_empire_summary(), "categories": grouped}
