"""
NoblePort Selections Model

Tracks client selections for finishes, materials, fixtures, and design decisions.
Central source of truth for procurement and execution accuracy.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class SelectionStatus(str, PyEnum):
    PENDING = "pending"
    SELECTED = "selected"
    APPROVED = "approved"
    ORDERED = "ordered"
    RECEIVED = "received"
    INSTALLED = "installed"
    CHANGED = "changed"
    CANCELLED = "cancelled"


class SelectionCategory(str, PyEnum):
    FLOORING = "flooring"
    CABINETRY = "cabinetry"
    COUNTERTOPS = "countertops"
    FIXTURES = "fixtures"
    LIGHTING = "lighting"
    PAINT = "paint"
    TILE = "tile"
    APPLIANCES = "appliances"
    HARDWARE = "hardware"
    WINDOWS = "windows"
    DOORS = "doors"
    ROOFING = "roofing"
    SIDING = "siding"
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    HVAC = "hvac"
    LANDSCAPING = "landscaping"
    OTHER = "other"


class Selection(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "selections"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )

    # Selection Details
    category: Mapped[SelectionCategory] = mapped_column(
        Enum(SelectionCategory), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SelectionStatus] = mapped_column(
        Enum(SelectionStatus), default=SelectionStatus.PENDING, nullable=False
    )

    # Product Info
    manufacturer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    color_finish: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supplier: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Pricing
    unit_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    allowance_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    variance: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Location within project
    room_location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Lead Time
    lead_time_days: Mapped[int | None] = mapped_column(nullable=True)
    order_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expected_delivery: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Approval
    selected_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Change tracking
    is_change_order: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    original_selection_id: Mapped[str | None] = mapped_column(
        ForeignKey("selections.id"), nullable=True
    )

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    specification_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    def __repr__(self) -> str:
        return f"<Selection {self.name} ({self.category.value}) - {self.status.value}>"
