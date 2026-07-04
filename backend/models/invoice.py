"""
NoblePort Invoice Model

Construction invoice and payment tracking with Buildertrend sync.
"""

from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class InvoiceStatus(str, PyEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    DISPUTED = "disputed"
    VOIDED = "voided"


class PaymentMethod(str, PyEnum):
    CHECK = "check"
    ACH = "ach"
    WIRE = "wire"
    CREDIT_CARD = "credit_card"
    CRYPTO = "crypto"
    OTHER = "other"


class InvoiceLineItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoice_line_items"

    invoice_id: Mapped[str] = mapped_column(
        ForeignKey("invoices.id"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    cost_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<InvoiceLineItem {self.description} ${self.total:.2f}>"


class Invoice(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "invoices"

    # Relationship
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )

    # Invoice Details
    invoice_number: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Financial
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    balance_due: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Dates
    issue_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    due_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Parties
    vendor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vendor_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Payment
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        Enum(PaymentMethod), nullable=True
    )
    payment_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Retention
    retention_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    retention_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Approval
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approval_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)

    # Draw / Progress Billing
    draw_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    percent_complete: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<Invoice {self.invoice_number} ${self.total:.2f} ({self.status.value})>"
