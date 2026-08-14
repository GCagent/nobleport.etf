"""
NoblePort Command Board Ledger

Backend mirror of the five linked Airtable ledgers that power the
"nobleport-project-dashboard" Command Board, so GCagent and the FastAPI
surfaces read the same canonical shape the dashboard does.

The five ledgers:
    1. BidOpportunity   — the bid pipeline (open / weighted / hit rate)
    2. BuildProject     — the production ledger, with the roll-ups the
                          Command Board shows (Revised Contract Value,
                          AR Balance, Balance Remaining, Forecast GP/Margin)
    3. ChangeOrderAWO   — change orders & additional work orders on a build
    4. ProjectEvent     — the evidence log (one row per recorded event)
    5. ProjectFinancial — the financial ledger (contract/CO/invoice/payment/cost)

Every row carries an EVIDENCE LABEL — VERIFIED / REPORTED / ESTIMATED — so a
number never reads as a metric unless it is backed. This mirrors the platform's
existing honesty discipline (`backend/config/operational_truth.py` and the
verification framework): a figure's *evidence level* travels with the figure.

Relationship to the transactional models: this is a reporting/operating layer
keyed on the canonical `projects.id`. Where a ledger row corresponds to a
transactional record it links to it (`build_projects.job_id -> jobs.id`), but
the Command Board ledger is intentionally denormalized for executive reporting
and is not a replacement for `jobs` / `change_orders` / `payments`.
"""

from enum import Enum as PyEnum

from sqlalchemy import Date, Enum, Float, ForeignKey, String, Text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class EvidenceLabel(str, PyEnum):
    """How well-backed a row's figures are. Never let an ESTIMATED value be
    presented as a measured metric."""

    VERIFIED = "verified"    # Backed by a source artifact (contract, invoice, bank record)
    REPORTED = "reported"    # Stated by a person / external system, not yet verified
    ESTIMATED = "estimated"  # A model or judgement call, not an observation


class JobCategory(str, PyEnum):
    """Work category, shared by bids and builds for per-category roll-ups."""

    NEW_CONSTRUCTION = "new_construction"
    RENOVATION = "renovation"
    KITCHEN = "kitchen"
    BATHROOM = "bathroom"
    DECK = "deck"
    ROOF = "roof"
    WINDOWS = "windows"
    ADDITION = "addition"
    ADU = "adu"
    SIDING = "siding"
    COMMERCIAL = "commercial"
    OTHER = "other"


class BidStatus(str, PyEnum):
    BIDDING = "bidding"
    WON = "won"
    ON_HOLD = "on_hold"
    LOST = "lost"


class BuildStatus(str, PyEnum):
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    PUNCH_LIST = "punch_list"
    COMPLETE = "complete"
    WARRANTY = "warranty"


class BidOpportunity(Base, UUIDMixin, TimestampMixin):
    """A bid in the pipeline. Powers open-pipeline, weighted, and hit-rate KPIs."""

    __tablename__ = "bid_opportunities"

    # A bid may not yet have a project record; link when it exists.
    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[JobCategory] = mapped_column(
        Enum(JobCategory), default=JobCategory.OTHER, nullable=False
    )
    status: Mapped[BidStatus] = mapped_column(
        Enum(BidStatus), default=BidStatus.BIDDING, nullable=False, index=True
    )

    bid_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    win_probability: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    due_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    submitted_at: Mapped[str | None] = mapped_column(Date, nullable=True)
    decision_at: Mapped[str | None] = mapped_column(Date, nullable=True)

    follow_up_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_label: Mapped[EvidenceLabel] = mapped_column(
        Enum(EvidenceLabel), default=EvidenceLabel.REPORTED, nullable=False
    )

    @hybrid_property
    def weighted_value(self) -> float:
        """Bid amount weighted by win probability — the pipeline KPI input."""
        return (self.bid_amount or 0.0) * (self.win_probability or 0.0)

    def __repr__(self) -> str:
        return f"<BidOpportunity {self.name} ${self.bid_amount:,.0f} ({self.status.value})>"


class BuildProject(Base, UUIDMixin, TimestampMixin):
    """A build-side job in the production ledger.

    Stores the components; the roll-ups the Command Board displays
    (Revised Contract Value, AR Balance, Balance Remaining, Forecast Gross
    Profit / Margin %) are derived properties so they cannot drift from inputs.
    """

    __tablename__ = "build_projects"

    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )
    # Link to the transactional job when one exists.
    job_id: Mapped[str | None] = mapped_column(
        ForeignKey("jobs.id"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[JobCategory] = mapped_column(
        Enum(JobCategory), default=JobCategory.OTHER, nullable=False
    )
    status: Mapped[BuildStatus] = mapped_column(
        Enum(BuildStatus), default=BuildStatus.ACTIVE, nullable=False, index=True
    )
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Roll-up inputs
    original_contract_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    approved_change_orders: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_billed: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_collected: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    forecast_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_label: Mapped[EvidenceLabel] = mapped_column(
        Enum(EvidenceLabel), default=EvidenceLabel.REPORTED, nullable=False
    )

    # ---- Roll-ups (mirror the Airtable formula columns) -------------------
    @hybrid_property
    def revised_contract_value(self) -> float:
        return (self.original_contract_value or 0.0) + (self.approved_change_orders or 0.0)

    @hybrid_property
    def ar_balance(self) -> float:
        """Billed but not yet collected."""
        return (self.total_billed or 0.0) - (self.total_collected or 0.0)

    @hybrid_property
    def balance_remaining(self) -> float:
        """Revised contract value not yet billed."""
        return self.revised_contract_value - (self.total_billed or 0.0)

    @hybrid_property
    def forecast_gross_profit(self) -> float:
        return self.revised_contract_value - (self.forecast_cost or 0.0)

    @hybrid_property
    def forecast_margin_pct(self) -> float:
        rcv = self.revised_contract_value
        return (self.forecast_gross_profit / rcv * 100.0) if rcv else 0.0

    def __repr__(self) -> str:
        return f"<BuildProject {self.name} RCV=${self.revised_contract_value:,.0f} ({self.status.value})>"


class ChangeOrderAWO(Base, UUIDMixin, TimestampMixin):
    """Command Board change order / additional work order on a build."""

    __tablename__ = "cb_change_orders"

    build_project_id: Mapped[str] = mapped_column(
        ForeignKey("build_projects.id"), nullable=False, index=True
    )
    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )

    number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="proposed", nullable=False)

    evidence_label: Mapped[EvidenceLabel] = mapped_column(
        Enum(EvidenceLabel), default=EvidenceLabel.REPORTED, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ChangeOrderAWO {self.title} ${self.amount:,.0f} ({self.status})>"


class ProjectEvent(Base, UUIDMixin, TimestampMixin):
    """Evidence log — one row per recorded event across bid or build."""

    __tablename__ = "project_events"

    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )
    build_project_id: Mapped[str | None] = mapped_column(
        ForeignKey("build_projects.id"), nullable=True, index=True
    )
    bid_opportunity_id: Mapped[str | None] = mapped_column(
        ForeignKey("bid_opportunities.id"), nullable=True, index=True
    )

    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occurred_at: Mapped[str | None] = mapped_column(Date, nullable=True)

    evidence_label: Mapped[EvidenceLabel] = mapped_column(
        Enum(EvidenceLabel), default=EvidenceLabel.REPORTED, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProjectEvent {self.event_type} ({self.evidence_label.value})>"


class ProjectFinancial(Base, UUIDMixin, TimestampMixin):
    """Financial ledger entry — contract / change order / invoice / payment / cost."""

    __tablename__ = "project_financials"

    build_project_id: Mapped[str | None] = mapped_column(
        ForeignKey("build_projects.id"), nullable=True, index=True
    )
    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )

    entry_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[str | None] = mapped_column(Date, nullable=True)

    evidence_label: Mapped[EvidenceLabel] = mapped_column(
        Enum(EvidenceLabel), default=EvidenceLabel.REPORTED, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProjectFinancial {self.entry_type} ${self.amount:,.0f} ({self.evidence_label.value})>"
