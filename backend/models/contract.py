"""
NoblePort Contract Model (Smart CRM Core Data Layer)

An executed agreement binding scope, price, and terms — the bridge between a
won Opportunity/Estimate and a live Project. Tracks HIC-compliant deposit
terms and (optionally) an on-chain reference.

STAGED: part of the Smart CRM blueprint. Contract execution always requires a
human approval gate — no agent signs contracts. See backend/core/smart_crm.py.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class ContractStatus(str, PyEnum):
    DRAFT = "draft"
    SENT = "sent"
    SIGNED = "signed"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Contract(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contracts"

    contract_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus), default=ContractStatus.DRAFT, nullable=False
    )

    # Relationships
    contact_id: Mapped[str | None] = mapped_column(
        ForeignKey("contacts.id"), nullable=True
    )
    opportunity_id: Mapped[str | None] = mapped_column(
        ForeignKey("opportunities.id"), nullable=True
    )
    estimate_id: Mapped[str | None] = mapped_column(
        ForeignKey("estimates.id"), nullable=True
    )
    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True
    )

    # Terms
    total_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    deposit_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Massachusetts HIC caps deposits — flag tracked for compliance review.
    hic_deposit_compliant: Mapped[bool | None] = mapped_column(nullable=True)

    signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # On-chain / e-sign references
    docusign_envelope_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    onchain_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Contract {self.contract_number or self.id} ({self.status.value})>"
