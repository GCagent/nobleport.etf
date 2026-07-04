"""
NoblePort Master Operating System (NP-OS) — Canonical System Registry

This module is the single, authoritative, machine-readable definition of the
NoblePort Master Operating System. Every layer described in the NP-OS spec —
Executive (Stephanie.ai), Revenue (Lead Command Center), Estimating (Bid
Engine), Project Operations (GCagent), Permit (PermitStream), Financial
(Payment Node), Accounting (Financial Command Center), Construction
Intelligence (Project Profitability Engine), Field Operations (Mobile
Operations), Customer (NobleNest), and Real Estate Development (NoblePort
Development) — is encoded here as typed data rather than prose.

The rest of the system already implements these layers as agents
(``backend/agents``), models (``backend/models``), and API routers
(``backend/api``). This registry is the index that binds them into one
operating system: it names each layer, its product, functions, status/pipeline
flow, and KPIs; enumerates the master database tables; pins the company North
Star metrics; and encodes Stephanie.ai's advisory-only authority boundary.

It is the executable answer to "what is NP-OS" — a contract the executive
dashboard, the agent mesh, and any external consumer can read to discover the
shape of the whole company without scraping documentation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable


# ---------------------------------------------------------------------------
# Layers (the eleven operating layers + the executive dashboard rollup)
# ---------------------------------------------------------------------------

class LayerId(str, Enum):
    EXECUTIVE = "executive"
    REVENUE = "revenue"
    ESTIMATING = "estimating"
    PROJECT_OPERATIONS = "project_operations"
    PERMIT = "permit"
    FINANCIAL = "financial"
    ACCOUNTING = "accounting"
    CONSTRUCTION_INTELLIGENCE = "construction_intelligence"
    FIELD_OPERATIONS = "field_operations"
    CUSTOMER = "customer"
    REAL_ESTATE_DEVELOPMENT = "real_estate_development"


# ---------------------------------------------------------------------------
# Authority model — what a coordination layer is and is NOT allowed to do.
# Stephanie.ai is advisory only. These boundaries mirror the governance
# Authority Matrix; the gate (backend/governance) is what enforces them at
# runtime, while this registry is the human/agent-readable declaration.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Authority:
    """Declared authority boundary for a coordination layer."""

    advisory_only: bool
    can_release_payments: bool
    can_submit_permits: bool
    can_execute_contracts: bool
    notes: str = ""

    def forbidden_actions(self) -> list[str]:
        out: list[str] = []
        if not self.can_release_payments:
            out.append("payment_release")
        if not self.can_submit_permits:
            out.append("permit_submission")
        if not self.can_execute_contracts:
            out.append("contract_execution")
        return out


# ---------------------------------------------------------------------------
# Layer definition
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Layer:
    """A single operating layer of NP-OS and the product that fronts it."""

    id: LayerId
    name: str
    product: str
    purpose: str
    functions: tuple[str, ...] = ()
    # Ordered lifecycle the layer drives (pipeline or status flow), if any.
    flow: tuple[str, ...] = ()
    kpis: tuple[str, ...] = ()
    outputs: tuple[str, ...] = ()
    # Master tables this layer reads/writes (names from MASTER_TABLES).
    tables: tuple[str, ...] = ()
    # Backend implementation references — agents/api modules that realize it.
    agent: str | None = None
    api_prefix: str | None = None
    authority: Authority | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id.value,
            "name": self.name,
            "product": self.product,
            "purpose": self.purpose,
            "functions": list(self.functions),
            "flow": list(self.flow),
            "kpis": list(self.kpis),
            "outputs": list(self.outputs),
            "tables": list(self.tables),
            "agent": self.agent,
            "apiPrefix": self.api_prefix,
            "authority": (
                {
                    "advisoryOnly": self.authority.advisory_only,
                    "canReleasePayments": self.authority.can_release_payments,
                    "canSubmitPermits": self.authority.can_submit_permits,
                    "canExecuteContracts": self.authority.can_execute_contracts,
                    "forbiddenActions": self.authority.forbidden_actions(),
                    "notes": self.authority.notes,
                }
                if self.authority is not None
                else None
            ),
        }


# ---------------------------------------------------------------------------
# Master database table catalog
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MasterTable:
    """A core table in the single source of truth."""

    name: str
    description: str
    # The model module that implements it, when one exists.
    model: str | None = None

    def to_dict(self) -> dict:
        return {"name": self.name, "description": self.description, "model": self.model}


# ---------------------------------------------------------------------------
# North Star metrics
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class NorthStarMetric:
    """A company-level metric everything rolls up into."""

    key: str
    label: str
    unit: str
    description: str
    # Layers that feed this metric.
    sources: tuple[LayerId, ...] = ()
    direction: str = "up"  # "up" => higher is better, "down" => lower is better

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "unit": self.unit,
            "description": self.description,
            "sources": [s.value for s in self.sources],
            "direction": self.direction,
        }


# ---------------------------------------------------------------------------
# The registry
# ---------------------------------------------------------------------------

# Stephanie.ai is advisory only. She coordinates and recommends; she never
# moves money, never files permits, never signs contracts.
STEPHANIE_AUTHORITY = Authority(
    advisory_only=True,
    can_release_payments=False,
    can_submit_permits=False,
    can_execute_contracts=False,
    notes=(
        "Executive coordination layer. Briefs, plans, monitors, and recommends. "
        "All money movement, permit submission, and contract execution require "
        "human approval and are enforced by the governance gate."
    ),
)


LAYERS: tuple[Layer, ...] = (
    Layer(
        id=LayerId.EXECUTIVE,
        name="Executive Layer",
        product="Stephanie.ai",
        purpose=(
            "Executive coordination: briefing, strategic planning, cross-system "
            "coordination, KPI monitoring, and governance oversight."
        ),
        functions=(
            "Executive briefing",
            "Strategic planning",
            "Cross-system coordination",
            "KPI monitoring",
            "Governance oversight",
        ),
        outputs=(
            "Daily Executive Brief",
            "Weekly Operations Report",
            "Risk Dashboard",
            "Strategic Recommendations",
        ),
        tables=("Audit Logs",),
        agent="backend.agents.stephanie.StephanieAgent",
        api_prefix="/api/ops-brief",
        authority=STEPHANIE_AUTHORITY,
    ),
    Layer(
        id=LayerId.REVENUE,
        name="Revenue Layer",
        product="Lead Command Center",
        purpose="Capture, qualify, and convert demand across the full sales pipeline.",
        functions=(
            "Lead capture",
            "Trust-fit qualification",
            "Pipeline management",
            "Sales rep assignment",
            "Revenue forecasting",
        ),
        flow=(
            "New Lead",
            "Trust Fit Qualified",
            "Inspection Scheduled",
            "Estimate Sent",
            "Deposit Received",
            "Permit Submitted",
            "Production",
            "Closed Won",
            "Maintenance Program",
        ),
        kpis=(
            "Lead Volume",
            "Close Rate",
            "Average Job Size",
            "Revenue Forecast",
            "Sales Velocity",
        ),
        tables=("Leads", "Clients", "Properties"),
        agent="backend.agents.stephanie.StephanieAgent",
        api_prefix="/api/leads",
    ),
    Layer(
        id=LayerId.ESTIMATING,
        name="Estimating Layer",
        product="NoblePort Bid Engine",
        purpose="Build scope, price work from cost/labor/material databases, and generate proposals.",
        functions=(
            "Scope Builder",
            "Cost Database",
            "Labor Database",
            "Material Database",
            "Proposal Generator",
            "Change Order Generator",
        ),
        outputs=(
            "Residential Estimates",
            "Commercial Estimates",
            "Design-Build Budgets",
            "Feasibility Studies",
        ),
        kpis=(
            "Win Rate",
            "Gross Margin",
            "Estimate Accuracy",
            "Change Order Ratio",
        ),
        tables=("Estimates", "Change Orders"),
        api_prefix="/api/estimates",
    ),
    Layer(
        id=LayerId.PROJECT_OPERATIONS,
        name="Project Operations Layer",
        product="GCagent",
        purpose="Run construction execution: scheduling, tasks, logs, and production tracking.",
        functions=(
            "Project Scheduling",
            "Task Assignment",
            "Daily Logs",
            "Site Reports",
            "Change Orders",
            "Production Tracking",
        ),
        flow=(
            "Preconstruction",
            "Permitting",
            "Mobilization",
            "Production",
            "Inspection",
            "Punch List",
            "Closeout",
        ),
        kpis=(
            "Schedule Variance",
            "Labor Utilization",
            "Completion Percentage",
            "Open Issues",
            "Inspection Pass Rate",
        ),
        tables=("Projects", "Tasks", "Change Orders"),
        agent="backend.agents.gcagent.GCAgent",
        api_prefix="/api/jobs",
    ),
    Layer(
        id=LayerId.PERMIT,
        name="Permit Layer",
        product="PermitStream",
        purpose="Track permits, inspections, municipalities, zoning, and compliance.",
        functions=(
            "Permit Tracking",
            "Inspection Tracking",
            "Municipality Monitoring",
            "Zoning Review",
            "Compliance Alerts",
        ),
        flow=("Essex County", "Seacoast NH", "Expansion Markets"),
        kpis=(
            "Permit Aging",
            "Inspection Success Rate",
            "Approval Cycle Time",
            "Permit Risk Score",
        ),
        tables=("Permits", "Inspections"),
        agent="backend.agents.permit_stream.PermitStreamAgent",
        api_prefix="/api/projects",
    ),
    Layer(
        id=LayerId.FINANCIAL,
        name="Financial Layer",
        product="NoblePort Payment Node",
        purpose="Move money with controls: customer/contractor/vendor payments, retention, draws.",
        functions=(
            "Customer Payments",
            "Contractor Payments",
            "Retention Tracking",
            "Draw Requests",
            "Vendor Payments",
        ),
        kpis=(
            "Cash Position",
            "AR Aging",
            "AP Aging",
            "Gross Margin",
            "Retention Held",
        ),
        outputs=(
            "HIC Compliance",
            "Human Approval Required",
            "Audit Logging",
            "Immutable Ledger",
        ),
        tables=("Payments", "Invoices", "Audit Logs"),
        api_prefix="/api/payments",
        authority=Authority(
            advisory_only=False,
            can_release_payments=True,  # only with human approval (gate-enforced)
            can_submit_permits=False,
            can_execute_contracts=False,
            notes="HIC compliance + human approval + immutable ledger on every release.",
        ),
    ),
    Layer(
        id=LayerId.ACCOUNTING,
        name="Accounting Layer",
        product="Financial Command Center",
        purpose="Track revenue, COGS, burden, and overhead; produce WIP and job-cost reporting.",
        functions=(
            "Revenue",
            "Cost of Goods Sold",
            "Labor Burden",
            "Subcontractors",
            "Equipment",
            "Insurance",
            "Overhead",
        ),
        outputs=(
            "WIP Schedule",
            "Job Cost Reports",
            "Cash Forecast",
            "Profitability Reports",
        ),
        tables=("Invoices", "Payments", "Vendors", "Subcontractors", "Equipment"),
        api_prefix="/api/invoices",
    ),
    Layer(
        id=LayerId.CONSTRUCTION_INTELLIGENCE,
        name="Construction Intelligence Layer",
        product="Project Profitability Engine",
        purpose="Per-project margin intelligence: forecast margin, detect overruns, raise alerts.",
        functions=(
            "Contract Value",
            "Approved COs",
            "Pending COs",
            "Actual Costs",
            "Remaining Costs",
            "Forecast Margin",
        ),
        outputs=(
            "Margin Below Target",
            "Labor Overrun",
            "Material Variance",
            "Permit Delay",
        ),
        tables=("Projects", "Change Orders", "Payments"),
        agent="backend.agents.gcagent.GCAgent",
        api_prefix="/api/revenue",
    ),
    Layer(
        id=LayerId.FIELD_OPERATIONS,
        name="Field Operations Layer",
        product="Mobile Operations",
        purpose="Field capture for PMs, superintendents, foremen, and sales inspectors.",
        functions=(
            "Daily Logs",
            "Time Tracking",
            "Photo Documentation",
            "Safety Reports",
            "Change Orders",
            "Material Requests",
        ),
        tables=("Tasks", "Photos", "Documents", "Change Orders"),
        agent="backend.agents.gcagent.GCAgent",
        api_prefix="/api/schedules",
    ),
    Layer(
        id=LayerId.CUSTOMER,
        name="Customer Layer",
        product="NobleNest",
        purpose="Own the customer relationship: property records, maintenance, memberships, upsell.",
        functions=(
            "Property Database",
            "Maintenance Tracking",
            "Service Requests",
            "Membership Plans",
            "Upgrade Opportunities",
        ),
        outputs=(
            "Roof",
            "Siding",
            "Windows",
            "HVAC",
            "Electrical",
            "Plumbing",
            "Paint History",
        ),
        tables=("Clients", "Properties"),
        api_prefix="/api/leads",
    ),
    Layer(
        id=LayerId.REAL_ESTATE_DEVELOPMENT,
        name="Real Estate Development Layer",
        product="NoblePort Development",
        purpose="Track long-horizon development from land acquisition to sale/lease.",
        functions=(
            "Land Acquisition",
            "Feasibility",
            "Entitlements",
            "Design",
            "Construction",
            "Sale/Lease",
        ),
        kpis=(
            "IRR",
            "ROI",
            "Carry Costs",
            "Construction Cost/SF",
            "Exit Value",
        ),
        tables=("Properties", "Projects", "Documents"),
        api_prefix="/api/projects",
    ),
)


MASTER_TABLES: tuple[MasterTable, ...] = (
    MasterTable("Clients", "People and organizations NoblePort does business with."),
    MasterTable("Properties", "Physical addresses and their system records."),
    MasterTable("Leads", "Inbound demand and pipeline position.", "backend.models.lead.Lead"),
    MasterTable("Estimates", "Priced scopes and proposals.", "backend.models.estimate.Estimate"),
    MasterTable("Contracts", "Executed agreements binding scope, price, and terms."),
    MasterTable("Projects", "Construction projects under management.", "backend.models.project.Project"),
    MasterTable("Tasks", "Schedule items and field work.", "backend.models.schedule.ScheduleItem"),
    MasterTable("Permits", "Permit applications and their status.", "backend.models.permit.Permit"),
    MasterTable("Inspections", "Scheduled and completed inspections.", "backend.models.inspection.Inspection"),
    MasterTable("Invoices", "Billed amounts and line items.", "backend.models.invoice.Invoice"),
    MasterTable("Payments", "Inbound and outbound money movement.", "backend.models.payment.Payment"),
    MasterTable("Change Orders", "Approved/pending scope changes.", "backend.models.change_order.ChangeOrder"),
    MasterTable("Vendors", "Material and service suppliers."),
    MasterTable("Subcontractors", "Trade partners performing work."),
    MasterTable("Employees", "Internal staff and field crews."),
    MasterTable("Equipment", "Owned and rented equipment."),
    MasterTable("Photos", "Field photo documentation.", "backend.models.media.MediaFile"),
    MasterTable("Documents", "Contracts, plans, and attachments."),
    MasterTable("Audit Logs", "Immutable hash-linked record of every action.", "backend.models.trust_record.TrustRecord"),
)


NORTH_STAR_METRICS: tuple[NorthStarMetric, ...] = (
    NorthStarMetric(
        "annual_revenue", "Annual Revenue", "USD",
        "Trailing/forecast revenue across all lanes.",
        (LayerId.REVENUE, LayerId.ACCOUNTING),
    ),
    NorthStarMetric(
        "gross_margin", "Gross Margin", "%",
        "Blended gross margin across active and closed work.",
        (LayerId.ESTIMATING, LayerId.CONSTRUCTION_INTELLIGENCE, LayerId.ACCOUNTING),
    ),
    NorthStarMetric(
        "backlog", "Backlog", "USD",
        "Contracted value not yet recognized as revenue.",
        (LayerId.REVENUE, LayerId.PROJECT_OPERATIONS),
    ),
    NorthStarMetric(
        "cash_position", "Cash Position", "USD",
        "Operating + reserve + escrow cash on hand.",
        (LayerId.FINANCIAL,),
    ),
    NorthStarMetric(
        "active_projects", "Active Projects", "count",
        "Projects currently in production or pre-closeout.",
        (LayerId.PROJECT_OPERATIONS,),
    ),
    NorthStarMetric(
        "permit_cycle_time", "Permit Cycle Time", "days",
        "Average days from submission to approval.",
        (LayerId.PERMIT,), direction="down",
    ),
    NorthStarMetric(
        "close_rate", "Close Rate", "%",
        "Share of qualified leads that close won.",
        (LayerId.REVENUE,),
    ),
    NorthStarMetric(
        "customer_satisfaction", "Customer Satisfaction", "score",
        "Aggregate customer satisfaction across delivered work.",
        (LayerId.CUSTOMER,),
    ),
    NorthStarMetric(
        "project_completion_rate", "Project Completion Rate", "%",
        "Projects completed on or ahead of schedule.",
        (LayerId.PROJECT_OPERATIONS,),
    ),
    NorthStarMetric(
        "safety_score", "Safety Score", "score",
        "Field safety performance from daily logs and safety reports.",
        (LayerId.FIELD_OPERATIONS,),
    ),
)


class MasterOperatingSystem:
    """Read-only index over the NP-OS definition.

    The registry is built from module-level constants so it is deterministic
    and importable everywhere. Helper methods provide lookups and a single
    ``system_map()`` serialization for the API and the executive dashboard.
    """

    version = "1.0.0"
    name = "NoblePort Master Operating System"
    abbreviation = "NP-OS"

    def __init__(
        self,
        layers: Iterable[Layer] = LAYERS,
        tables: Iterable[MasterTable] = MASTER_TABLES,
        north_star: Iterable[NorthStarMetric] = NORTH_STAR_METRICS,
    ) -> None:
        self._layers: tuple[Layer, ...] = tuple(layers)
        self._tables: tuple[MasterTable, ...] = tuple(tables)
        self._north_star: tuple[NorthStarMetric, ...] = tuple(north_star)
        self._by_id: dict[LayerId, Layer] = {layer.id: layer for layer in self._layers}

    # -- accessors ----------------------------------------------------------

    @property
    def layers(self) -> tuple[Layer, ...]:
        return self._layers

    @property
    def tables(self) -> tuple[MasterTable, ...]:
        return self._tables

    @property
    def north_star_metrics(self) -> tuple[NorthStarMetric, ...]:
        return self._north_star

    def layer(self, layer_id: LayerId | str) -> Layer:
        key = LayerId(layer_id) if not isinstance(layer_id, LayerId) else layer_id
        return self._by_id[key]

    def table_names(self) -> list[str]:
        return [t.name for t in self._tables]

    def tables_for_layer(self, layer_id: LayerId | str) -> list[MasterTable]:
        wanted = set(self.layer(layer_id).tables)
        return [t for t in self._tables if t.name in wanted]

    # -- integrity ----------------------------------------------------------

    def validate(self) -> None:
        """Assert internal consistency. Raises ValueError on any violation."""
        # Every LayerId is represented exactly once.
        seen = [layer.id for layer in self._layers]
        if len(seen) != len(set(seen)):
            raise ValueError("Duplicate layer ids in NP-OS registry")
        missing = set(LayerId) - set(seen)
        if missing:
            raise ValueError(f"NP-OS registry missing layers: {sorted(m.value for m in missing)}")

        # Every table referenced by a layer exists in the master catalog.
        known = set(self.table_names())
        for layer in self._layers:
            for table in layer.tables:
                if table not in known:
                    raise ValueError(
                        f"Layer {layer.id.value} references unknown table {table!r}"
                    )

        # Every North Star source is a real layer.
        for metric in self._north_star:
            for src in metric.sources:
                if src not in self._by_id:
                    raise ValueError(
                        f"North Star {metric.key} references unknown layer {src}"
                    )

        # The advisory-only invariant: any layer flagged advisory_only must not
        # be permitted to release payments, submit permits, or execute contracts.
        for layer in self._layers:
            auth = layer.authority
            if auth and auth.advisory_only:
                if auth.can_release_payments or auth.can_submit_permits or auth.can_execute_contracts:
                    raise ValueError(
                        f"Layer {layer.id.value} is advisory_only but claims execution authority"
                    )

    # -- serialization ------------------------------------------------------

    def system_map(self) -> dict:
        """The full, serializable NP-OS definition — the single source of truth."""
        return {
            "name": self.name,
            "abbreviation": self.abbreviation,
            "version": self.version,
            "summary": (
                "A single operating system where Stephanie.ai coordinates strategy, "
                "GCagent runs production, PermitStream manages compliance, the Payment "
                "Node controls cash movement, NobleNest manages customer relationships, "
                "and NoblePort Development tracks long-term real estate projects — all "
                "rolling up into one executive dashboard with a single source of truth."
            ),
            "layers": [layer.to_dict() for layer in self._layers],
            "masterTables": [t.to_dict() for t in self._tables],
            "northStarMetrics": [m.to_dict() for m in self._north_star],
        }


# Singleton instance. Validated at import so a malformed registry fails fast.
NP_OS = MasterOperatingSystem()
NP_OS.validate()


__all__ = [
    "LayerId",
    "Authority",
    "Layer",
    "MasterTable",
    "NorthStarMetric",
    "MasterOperatingSystem",
    "LAYERS",
    "MASTER_TABLES",
    "NORTH_STAR_METRICS",
    "NP_OS",
]
