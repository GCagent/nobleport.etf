"""
NoblePort Smart CRM — Canonical Blueprint Registry (STAGED)

A Construction Smart CRM. Same full-stack concept as a general-purpose CRM, but
specialized for contractors, design-build firms, roofing, remodeling, ADUs, and
real estate development. This module is the single, authoritative,
machine-readable definition of that blueprint — the seven hubs, the AI agent
layer, the core data tables, the dashboard views, and the build phases — encoded
as typed data rather than prose.

It deliberately mirrors the NP-OS registry (``backend/core/np_os.py``): the
Smart CRM is the customer-/pipeline-facing view of the same single source of
truth NP-OS describes. Where NP-OS organizes the company into operating layers,
the Smart CRM organizes the same capabilities into the hubs a construction
operator actually works in day to day.

STAGING NOTICE
--------------
Per the architecture decision, the Smart CRM is **STAGED / DEVELOPMENT**. It is
a design blueprint expressed as code, not a live operational system. It becomes
operational only when wired to live Postgres/Supabase data, authenticated
users, Payment Node ledger events, and PermitStream feeds. ``STATUS`` below is
``"staged"`` and the API surfaces that flag on every response. Nothing here
moves money, files permits, or signs contracts.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Iterable


# ---------------------------------------------------------------------------
# Lifecycle status of the whole blueprint
# ---------------------------------------------------------------------------

STATUS = "staged"  # staged | development | live
STATUS_NOTE = (
    "Design blueprint expressed as code. Remains STAGED/DEVELOPMENT until "
    "connected to live Postgres/Supabase data, authenticated users, Payment "
    "Node ledger events, and PermitStream feeds."
)


# ---------------------------------------------------------------------------
# Hubs — the seven workspaces a construction operator lives in
# ---------------------------------------------------------------------------

class HubId(str, Enum):
    LEAD = "lead"
    SALES = "sales"
    PROJECT = "project"
    PERMITSTREAM = "permitstream"
    FINANCE = "finance"
    SERVICE = "service"
    REALTY = "realty"


@dataclass(frozen=True)
class Hub:
    """A single Smart CRM hub and the capability it owns."""

    id: HubId
    name: str
    purpose: str
    # The general-purpose CRM hub this replaces/specializes, if any.
    replaces: str | None = None
    features: tuple[str, ...] = ()
    # Inbound sources (Lead Hub) or ordered lifecycle (pipeline/status flow).
    sources: tuple[str, ...] = ()
    flow: tuple[str, ...] = ()
    metrics: tuple[str, ...] = ()
    integrations: tuple[str, ...] = ()
    priority_markets: tuple[str, ...] = ()
    # Core tables this hub reads/writes (names from CRM_TABLES).
    tables: tuple[str, ...] = ()
    # AI agent key (from CRM_AGENTS) that primarily drives this hub.
    primary_agent: str | None = None
    # Backend api router prefix that (will) realize it.
    api_prefix: str | None = None
    # Finance/contract/permit actions require a human approval gate.
    requires_human_approval: bool = False

    def to_dict(self) -> dict:
        return {
            "id": self.id.value,
            "name": self.name,
            "purpose": self.purpose,
            "replaces": self.replaces,
            "features": list(self.features),
            "sources": list(self.sources),
            "flow": list(self.flow),
            "metrics": list(self.metrics),
            "integrations": list(self.integrations),
            "priorityMarkets": list(self.priority_markets),
            "tables": list(self.tables),
            "primaryAgent": self.primary_agent,
            "apiPrefix": self.api_prefix,
            "requiresHumanApproval": self.requires_human_approval,
        }


# ---------------------------------------------------------------------------
# Core data layer — the single customer record everything connects to
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CRMTable:
    """A core table in the Smart CRM single source of truth."""

    name: str
    description: str
    # The model module that implements it, when one exists.
    model: str | None = None

    def to_dict(self) -> dict:
        return {"name": self.name, "description": self.description, "model": self.model}


# ---------------------------------------------------------------------------
# AI layer — Stephanie.ai agents
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CRMAgent:
    """An AI agent in the Stephanie.ai layer."""

    key: str
    name: str
    role: str
    # Backend implementation reference, when one exists.
    impl: str | None = None

    def to_dict(self) -> dict:
        return {"key": self.key, "name": self.name, "role": self.role, "impl": self.impl}


# ---------------------------------------------------------------------------
# Dashboards
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DashboardView:
    """A role-scoped dashboard view and the widgets it surfaces."""

    key: str
    name: str
    widgets: tuple[str, ...] = ()

    def to_dict(self) -> dict:
        return {"key": self.key, "name": self.name, "widgets": list(self.widgets)}


# ---------------------------------------------------------------------------
# Build phases
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class BuildPhase:
    """A phase of the recommended build order."""

    number: int
    name: str
    items: tuple[str, ...] = ()
    status: str = "planned"  # planned | in_progress | complete

    def to_dict(self) -> dict:
        return {
            "number": self.number,
            "name": self.name,
            "items": list(self.items),
            "status": self.status,
        }


# ---------------------------------------------------------------------------
# The registry data
# ---------------------------------------------------------------------------

HUBS: tuple[Hub, ...] = (
    Hub(
        id=HubId.LEAD,
        name="Lead Hub",
        purpose="Capture and route demand from every construction-specific source.",
        replaces="Marketing Hub",
        sources=(
            "QR Codes",
            "Website Forms",
            "CostCertified",
            "Facebook",
            "Instagram",
            "Google LSA",
            "Referral Partners",
            "Realtors",
            "PermitStream",
        ),
        flow=(
            "New Lead",
            "Trust Fit Qualified",
            "Inspection Scheduled",
            "Estimate Sent",
            "Deposit Received",
            "Production",
            "Completed",
            "Membership",
        ),
        tables=("contacts", "leads", "properties"),
        primary_agent="sales_agent",
        api_prefix="/api/leads",
    ),
    Hub(
        id=HubId.SALES,
        name="Sales Hub",
        purpose="The Trust Pipeline — qualify, follow up, estimate, and close.",
        replaces="Sales Hub",
        features=(
            "AI Qualification",
            "Follow-up automation",
            "Estimate generation",
            "Proposal tracking",
            "Close ratio analysis",
            "Agent scoreboards",
        ),
        metrics=("Leads", "Appointments", "Estimates", "Wins", "Revenue", "Close %"),
        tables=("opportunities", "estimates", "contacts", "leads"),
        primary_agent="sales_agent",
        api_prefix="/api/estimates",
    ),
    Hub(
        id=HubId.PROJECT,
        name="Project Hub",
        purpose="Run construction execution from the PM skill: schedule, log, track.",
        features=(
            "Daily Logs",
            "Scheduling",
            "Material Orders",
            "Inspection Tracking",
            "Change Orders",
            "Job Health Scores",
            "Production Calendar",
        ),
        flow=(
            "Pending",
            "Active",
            "Inspection",
            "Punch List",
            "Complete",
            "Warranty",
        ),
        tables=(
            "projects",
            "daily_logs",
            "materials",
            "purchase_orders",
            "subcontractors",
            "inspections",
            "change_orders",
        ),
        primary_agent="pm_agent",
        api_prefix="/api/jobs",
    ),
    Hub(
        id=HubId.PERMITSTREAM,
        name="PermitStream Hub",
        purpose="Construction-specific permit intelligence a generic CRM cannot offer.",
        features=(
            "Municipal permit feeds",
            "Chapter 91 tracking",
            "ADU tracking",
            "New construction monitoring",
            "Competitor intelligence",
            "Builder activity",
        ),
        priority_markets=(
            "Newburyport",
            "Ipswich",
            "Manchester-by-the-Sea",
            "Essex",
            "Hamilton",
            "Wenham",
            "Beverly",
            "Marblehead",
        ),
        tables=("permits", "inspections", "properties"),
        primary_agent="permit_agent",
        api_prefix="/api/projects",
    ),
    Hub(
        id=HubId.FINANCE,
        name="Finance Hub",
        purpose="Move money with controls; connects directly to the Payment Node.",
        features=(
            "Deposits",
            "Progress Payments",
            "Change Orders",
            "Retentions",
            "Invoice Tracking",
            "Stripe",
            "Mercury",
        ),
        integrations=("Stripe", "Mercury"),
        metrics=(
            "HIC deposit compliance",
            "Human approval gates",
            "Audit trail",
            "Ledger",
        ),
        tables=("invoices", "payments", "contracts", "change_orders", "audit_log"),
        primary_agent="finance_agent",
        api_prefix="/api/payments",
        requires_human_approval=True,
    ),
    Hub(
        id=HubId.SERVICE,
        name="Service Hub",
        purpose="Post-project management: warranties, memberships, recurring service.",
        features=(
            "Warranty requests",
            "Maintenance memberships",
            "Roof inspections",
            "Annual checkups",
            "Service dispatch",
        ),
        tables=("warranties", "service_requests", "contacts", "properties"),
        primary_agent="pm_agent",
        api_prefix="/api/schedules",
    ),
    Hub(
        id=HubId.REALTY,
        name="Realty Hub",
        purpose="A unique NoblePort advantage: property and development intelligence.",
        features=(
            "Property search",
            "Off-market opportunities",
            "Land analysis",
            "ADU feasibility",
            "Development tracking",
            "Investor matching",
        ),
        tables=("properties", "companies", "opportunities"),
        primary_agent="design_agent",
        api_prefix="/api/projects",
    ),
)


CRM_TABLES: tuple[CRMTable, ...] = (
    CRMTable("contacts", "The single customer record — homeowner, investor, realtor, PM, commercial.", "backend.models.contact.Contact"),
    CRMTable("properties", "Physical property: parcel, assessed value, permit history, roof age, insurance.", "backend.models.property.Property"),
    CRMTable("companies", "Organizations NoblePort does business with.", "backend.models.company.Company"),
    CRMTable("leads", "Inbound demand and pipeline position.", "backend.models.lead.Lead"),
    CRMTable("opportunities", "A specific job opportunity (roofing, ADU, kitchen, …) in the Trust Pipeline.", "backend.models.opportunity.Opportunity"),
    CRMTable("estimates", "Priced scopes and proposals.", "backend.models.estimate.Estimate"),
    CRMTable("contracts", "Executed agreements binding scope, price, and terms.", "backend.models.contract.Contract"),
    CRMTable("projects", "Construction projects under management.", "backend.models.project.Project"),
    CRMTable("daily_logs", "Field daily logs and site reports.", "backend.models.daily_log.DailyLog"),
    CRMTable("materials", "Catalog of materials used on jobs.", "backend.models.material.Material"),
    CRMTable("purchase_orders", "Material orders placed against a project.", "backend.models.material.PurchaseOrder"),
    CRMTable("vendors", "Material and service suppliers.", "backend.models.vendor.Vendor"),
    CRMTable("subcontractors", "Trade partners performing work.", "backend.models.vendor.Subcontractor"),
    CRMTable("inspections", "Scheduled and completed inspections.", "backend.models.inspection.Inspection"),
    CRMTable("permits", "Permit applications and their status.", "backend.models.permit.Permit"),
    CRMTable("change_orders", "Approved/pending scope changes.", "backend.models.change_order.ChangeOrder"),
    CRMTable("invoices", "Billed amounts and line items.", "backend.models.invoice.Invoice"),
    CRMTable("payments", "Inbound and outbound money movement.", "backend.models.payment.Payment"),
    CRMTable("warranties", "Post-project warranty coverage windows.", "backend.models.warranty.Warranty"),
    CRMTable("service_requests", "Warranty/maintenance/service work and dispatch.", "backend.models.service_request.ServiceRequest"),
    CRMTable("audit_log", "Append-only record of sensitive/approval-gated actions.", "backend.models.audit.AuditLog"),
    CRMTable("activity_log", "CRM relationship timeline of touchpoints.", "backend.models.audit.ActivityLog"),
)


CRM_AGENTS: tuple[CRMAgent, ...] = (
    CRMAgent("stephanie_executive", "Stephanie Executive", "Executive dashboard and coordination.", "backend.agents.stephanie.StephanieAgent"),
    CRMAgent("sales_agent", "Sales Agent", "Lead qualification and follow-up."),
    CRMAgent("pm_agent", "PM Agent", "Project execution.", "backend.agents.gcagent.GCAgent"),
    CRMAgent("permit_agent", "Permit Agent", "Permit intelligence.", "backend.agents.permit_stream.PermitStreamAgent"),
    CRMAgent("finance_agent", "Finance Agent", "Payment monitoring (advisory; approvals are human)."),
    CRMAgent("estimator_agent", "Estimator Agent", "Pricing and proposals."),
    CRMAgent("design_agent", "Design Agent", "Decks, ADUs, additions, roofing design."),
)


DASHBOARD_VIEWS: tuple[DashboardView, ...] = (
    DashboardView(
        "ceo", "CEO View",
        (
            "Total Pipeline",
            "Open Jobs",
            "Revenue",
            "Gross Profit",
            "PermitStream Leads",
            "Crew Utilization",
            "Cash Position",
        ),
    ),
    DashboardView(
        "sales", "Sales View",
        ("Lead Board", "Estimates", "Follow-ups", "Close Ratio"),
    ),
    DashboardView(
        "pm", "PM View",
        ("Active Jobs", "Inspections", "Deliveries", "Subs", "Daily Logs"),
    ),
    DashboardView(
        "finance", "Finance View",
        ("Deposits", "Outstanding AR", "Payments Due", "Ledger"),
    ),
)


BUILD_PHASES: tuple[BuildPhase, ...] = (
    BuildPhase(
        1, "Phase 1 — Foundations",
        ("CRM Core", "Lead Hub", "Sales Hub", "Project Hub"),
    ),
    BuildPhase(
        2, "Phase 2 — Intelligence & Money",
        ("PermitStream Integration", "Payment Node Integration", "AI Agents"),
    ),
    BuildPhase(
        3, "Phase 3 — Expansion",
        ("Realty Hub", "Membership Program", "Mobile App"),
    ),
)


# ---------------------------------------------------------------------------
# The registry
# ---------------------------------------------------------------------------

class SmartCRM:
    """Read-only index over the Smart CRM blueprint.

    Built from module-level constants so it is deterministic and importable
    everywhere. Helper methods provide lookups and a single ``system_map()``
    serialization for the API and any dashboard.
    """

    version = "0.1.0"
    name = "NoblePort Construction Smart CRM"
    abbreviation = "NP-CRM"

    def __init__(
        self,
        hubs: Iterable[Hub] = HUBS,
        tables: Iterable[CRMTable] = CRM_TABLES,
        agents: Iterable[CRMAgent] = CRM_AGENTS,
        dashboards: Iterable[DashboardView] = DASHBOARD_VIEWS,
        phases: Iterable[BuildPhase] = BUILD_PHASES,
    ) -> None:
        self._hubs: tuple[Hub, ...] = tuple(hubs)
        self._tables: tuple[CRMTable, ...] = tuple(tables)
        self._agents: tuple[CRMAgent, ...] = tuple(agents)
        self._dashboards: tuple[DashboardView, ...] = tuple(dashboards)
        self._phases: tuple[BuildPhase, ...] = tuple(phases)
        self._by_id: dict[HubId, Hub] = {hub.id: hub for hub in self._hubs}

    # -- accessors ----------------------------------------------------------

    @property
    def hubs(self) -> tuple[Hub, ...]:
        return self._hubs

    @property
    def tables(self) -> tuple[CRMTable, ...]:
        return self._tables

    @property
    def agents(self) -> tuple[CRMAgent, ...]:
        return self._agents

    @property
    def dashboards(self) -> tuple[DashboardView, ...]:
        return self._dashboards

    @property
    def build_phases(self) -> tuple[BuildPhase, ...]:
        return self._phases

    def hub(self, hub_id: HubId | str) -> Hub:
        key = HubId(hub_id) if not isinstance(hub_id, HubId) else hub_id
        return self._by_id[key]

    def table_names(self) -> list[str]:
        return [t.name for t in self._tables]

    def agent_keys(self) -> list[str]:
        return [a.key for a in self._agents]

    def tables_for_hub(self, hub_id: HubId | str) -> list[CRMTable]:
        wanted = set(self.hub(hub_id).tables)
        return [t for t in self._tables if t.name in wanted]

    # -- integrity ----------------------------------------------------------

    def validate(self) -> None:
        """Assert internal consistency. Raises ValueError on any violation."""
        # Every HubId is represented exactly once.
        seen = [hub.id for hub in self._hubs]
        if len(seen) != len(set(seen)):
            raise ValueError("Duplicate hub ids in Smart CRM registry")
        missing = set(HubId) - set(seen)
        if missing:
            raise ValueError(
                f"Smart CRM registry missing hubs: {sorted(m.value for m in missing)}"
            )

        # Every table referenced by a hub exists in the core catalog.
        known = set(self.table_names())
        for hub in self._hubs:
            for table in hub.tables:
                if table not in known:
                    raise ValueError(
                        f"Hub {hub.id.value} references unknown table {table!r}"
                    )

        # Every hub's primary agent is a real agent.
        known_agents = set(self.agent_keys())
        for hub in self._hubs:
            if hub.primary_agent and hub.primary_agent not in known_agents:
                raise ValueError(
                    f"Hub {hub.id.value} references unknown agent {hub.primary_agent!r}"
                )

        # Table names are unique.
        if len(self.table_names()) != len(known):
            raise ValueError("Duplicate table names in Smart CRM registry")

        # Agent keys are unique.
        if len(self.agent_keys()) != len(known_agents):
            raise ValueError("Duplicate agent keys in Smart CRM registry")

        # Finance hub must require human approval (no autonomous money movement).
        finance = self._by_id[HubId.FINANCE]
        if not finance.requires_human_approval:
            raise ValueError("Finance Hub must require human approval gates")

        # Build phases are numbered 1..N without gaps.
        numbers = sorted(p.number for p in self._phases)
        if numbers != list(range(1, len(self._phases) + 1)):
            raise ValueError(f"Build phases must be numbered 1..N, got {numbers}")

    # -- serialization ------------------------------------------------------

    def system_map(self) -> dict:
        """The full, serializable Smart CRM blueprint."""
        return {
            "name": self.name,
            "abbreviation": self.abbreviation,
            "version": self.version,
            "status": STATUS,
            "statusNote": STATUS_NOTE,
            "summary": (
                "A Construction Smart CRM specialized for contractors, design-build "
                "firms, roofing, remodeling, ADUs, and real estate development. Seven "
                "hubs over one customer record, driven by the Stephanie.ai agent layer."
            ),
            "hubs": [hub.to_dict() for hub in self._hubs],
            "coreTables": [t.to_dict() for t in self._tables],
            "agents": [a.to_dict() for a in self._agents],
            "dashboards": [d.to_dict() for d in self._dashboards],
            "buildPhases": [p.to_dict() for p in self._phases],
        }


# Singleton instance. Validated at import so a malformed registry fails fast.
SMART_CRM = SmartCRM()
SMART_CRM.validate()


__all__ = [
    "STATUS",
    "STATUS_NOTE",
    "HubId",
    "Hub",
    "CRMTable",
    "CRMAgent",
    "DashboardView",
    "BuildPhase",
    "SmartCRM",
    "HUBS",
    "CRM_TABLES",
    "CRM_AGENTS",
    "DASHBOARD_VIEWS",
    "BUILD_PHASES",
    "SMART_CRM",
]
