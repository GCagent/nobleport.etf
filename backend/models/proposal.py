"""
NoblePort Proposal Model

The Proposal Engine turns an approved estimate into a clean, priced,
client-ready document. Where the Estimate carries the headline numbers and
the lead link, the Proposal carries the detail layer the client actually
signs off on: line items (with labor/material split and allowances),
inclusions, exclusions, schedule assumptions, and a payment schedule.

Rule (from the Design-Build OS spec):
    No vague scope goes to contract. Every proposal needs inclusions,
    exclusions, payment terms, and schedule assumptions before it can be
    sent or accepted.

Flow:
    Estimate (WON-track) -> Proposal (DRAFT -> SENT -> ACCEPTED/SIGNED)
    -> Deposit Gate (job creation via RevenueEngine.approve_estimate)
"""

from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class ProposalStatus(str, PyEnum):
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    ACCEPTED = "accepted"
    SIGNED = "signed"
    DECLINED = "declined"
    EXPIRED = "expired"


class ScopeKind(str, PyEnum):
    INCLUSION = "inclusion"
    EXCLUSION = "exclusion"
    ASSUMPTION = "assumption"


class MilestoneType(str, PyEnum):
    DEPOSIT = "deposit"
    PROGRESS = "progress"
    FINAL = "final"


class ProposalLineItem(Base, UUIDMixin, TimestampMixin):
    """A single priced line on the proposal, with labor/material split."""

    __tablename__ = "proposal_line_items"

    proposal_id: Mapped[str] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False, index=True
    )

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Labor/material split. unit_cost is per-unit; the line total is
    # quantity * (labor_cost + material_cost).
    labor_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    material_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Classification
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cost_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Allowance flag — a budgeted line the client may adjust via change order.
    is_allowance: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    proposal: Mapped["Proposal"] = relationship(back_populates="line_items")

    def recalc(self) -> None:
        self.total = self.quantity * (self.labor_cost + self.material_cost)

    def __repr__(self) -> str:
        return f"<ProposalLineItem {self.description} ${self.total:,.2f}>"


class ProposalScopeItem(Base, UUIDMixin, TimestampMixin):
    """An inclusion, exclusion, or schedule assumption on the proposal."""

    __tablename__ = "proposal_scope_items"

    proposal_id: Mapped[str] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[ScopeKind] = mapped_column(Enum(ScopeKind), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    proposal: Mapped["Proposal"] = relationship(back_populates="scope_items")

    def __repr__(self) -> str:
        return f"<ProposalScopeItem {self.kind.value}: {self.text[:40]}>"


class ProposalMilestone(Base, UUIDMixin, TimestampMixin):
    """A payment-schedule milestone (deposit, progress draw, or final)."""

    __tablename__ = "proposal_milestones"

    proposal_id: Mapped[str] = mapped_column(
        ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger: Mapped[str | None] = mapped_column(String(255), nullable=True)
    milestone_type: Mapped[MilestoneType] = mapped_column(
        Enum(MilestoneType), default=MilestoneType.PROGRESS, nullable=False
    )
    percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    proposal: Mapped["Proposal"] = relationship(back_populates="milestones")

    def __repr__(self) -> str:
        return f"<ProposalMilestone {self.name} {self.percent:.0f}% ${self.amount:,.2f}>"


class Proposal(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "proposals"

    # Source estimate (system-of-record for the headline number + lead link).
    estimate_id: Mapped[str] = mapped_column(
        ForeignKey("estimates.id"), nullable=False, index=True
    )
    lead_id: Mapped[str | None] = mapped_column(
        ForeignKey("leads.id"), nullable=True, index=True
    )

    # Identity
    proposal_number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Client (denormalized from lead/estimate for a stable document of record)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    project_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Status
    status: Mapped[ProposalStatus] = mapped_column(
        Enum(ProposalStatus), default=ProposalStatus.DRAFT, nullable=False
    )

    # Financial rollups (derived from line items)
    labor_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    material_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    allowance_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_percent: Mapped[float] = mapped_column(
        Float, default=30.0, nullable=False
    )
    deposit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Terms / narrative
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Lifecycle timestamps
    valid_until: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    viewed_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # E-sign readiness — captured when the client accepts/signs.
    signer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signer_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signature_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signed_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    line_items: Mapped[list[ProposalLineItem]] = relationship(
        back_populates="proposal",
        cascade="all, delete-orphan",
        order_by="ProposalLineItem.sort_order",
    )
    scope_items: Mapped[list[ProposalScopeItem]] = relationship(
        back_populates="proposal",
        cascade="all, delete-orphan",
        order_by="ProposalScopeItem.sort_order",
    )
    milestones: Mapped[list[ProposalMilestone]] = relationship(
        back_populates="proposal",
        cascade="all, delete-orphan",
        order_by="ProposalMilestone.sort_order",
    )

    def __repr__(self) -> str:
        return (
            f"<Proposal {self.proposal_number} ${self.total:,.2f} "
            f"({self.status.value})>"
        )
