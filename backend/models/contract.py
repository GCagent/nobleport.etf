"""
NoblePort Contract Model

The Contract is the durable document of record created the moment a client
e-signs a proposal. Where the Proposal is a living sales document (edited,
versioned, re-sent), the Contract is a frozen snapshot of exactly what both
parties committed to: pricing, payment schedule, scope, and the signature
record — plus the running current value as approved change orders land.

Spine role #5 (backend/config/revenue_spine.py):
    Proposal (SIGNED) -> Contract (EXECUTED) -> Deposit Gate -> Job
    Deposit clears -> Contract ACTIVE -> ... -> COMPLETE / TERMINATED

The original signed numbers are never mutated. Change orders adjust
current_value only, so "what was signed" and "what it is now" are always
both answerable.
"""

from enum import Enum as PyEnum

from sqlalchemy import (
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


class ContractStatus(str, PyEnum):
    EXECUTED = "executed"      # Signed by client; deposit not yet cleared
    ACTIVE = "active"          # Deposit cleared; work authorized
    COMPLETE = "complete"      # Closeout finished
    TERMINATED = "terminated"  # Ended before completion


class ContractMilestone(Base, UUIDMixin, TimestampMixin):
    """Frozen copy of a payment-schedule milestone from the signed proposal."""

    __tablename__ = "contract_milestones"

    contract_id: Mapped[str] = mapped_column(
        ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger: Mapped[str | None] = mapped_column(String(255), nullable=True)
    milestone_type: Mapped[str] = mapped_column(String(50), nullable=False)
    percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    contract: Mapped["Contract"] = relationship(back_populates="milestones")

    def __repr__(self) -> str:
        return (
            f"<ContractMilestone {self.name} {self.percent:g}% "
            f"${self.amount:,.2f}>"
        )


class Contract(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contracts"

    # Provenance — one contract per signed proposal.
    proposal_id: Mapped[str] = mapped_column(
        ForeignKey("proposals.id"), nullable=False, unique=True, index=True
    )
    estimate_id: Mapped[str] = mapped_column(
        ForeignKey("estimates.id"), nullable=False, index=True
    )
    lead_id: Mapped[str | None] = mapped_column(
        ForeignKey("leads.id"), nullable=True, index=True
    )
    job_id: Mapped[str | None] = mapped_column(
        ForeignKey("jobs.id"), nullable=True, index=True
    )

    # Identity
    contract_number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Client (frozen from the signed proposal)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    project_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus), default=ContractStatus.EXECUTED, nullable=False
    )

    # Financial snapshot at signing — never mutated after execution.
    labor_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    material_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    allowance_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    original_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Running value: original_value + approved change orders.
    current_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change_order_total: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )

    # Scope snapshot — JSON: {line_items, inclusions, exclusions, assumptions}.
    scope_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Signature record (frozen from the signed proposal)
    signer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signer_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signature_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signed_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Lifecycle timestamps
    executed_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    activated_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terminated_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    termination_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    milestones: Mapped[list[ContractMilestone]] = relationship(
        back_populates="contract",
        cascade="all, delete-orphan",
        order_by="ContractMilestone.sort_order",
    )

    def __repr__(self) -> str:
        return (
            f"<Contract {self.contract_number} ${self.current_value:,.2f} "
            f"({self.status.value})>"
        )
