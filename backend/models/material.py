"""
NoblePort Material & Purchase Order Models (Smart CRM Core Data Layer)

Materials are the catalog of items used on jobs; purchase orders track ordering
those materials from vendors against a project. Feeds the Project Hub material
ordering workflow and the Accounting layer's job-cost reporting.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class Material(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "materials"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    unit_cost: Mapped[float | None] = mapped_column(Float, nullable=True)

    preferred_vendor_id: Mapped[str | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Material {self.name}>"


class PurchaseOrderStatus(str, PyEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ORDERED = "ordered"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class PurchaseOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "purchase_orders"

    po_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT, nullable=False
    )

    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True
    )
    vendor_id: Mapped[str | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )

    total_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    expected_delivery: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<PurchaseOrder {self.po_number or self.id} ({self.status.value})>"
