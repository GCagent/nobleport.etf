"""
NoblePort Opportunity Model (Smart CRM Core Data Layer)

A specific revenue opportunity tied to a contact and (usually) a property:
roofing, addition, ADU, deck, bath, kitchen, siding, windows, or maintenance.
This is what moves through the Sales Hub Trust Pipeline before it becomes a
Project.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from enum import Enum as PyEnum

from sqlalchemy import Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class OpportunityType(str, PyEnum):
    ROOFING = "roofing"
    ADDITION = "addition"
    ADU = "adu"
    DECK = "deck"
    BATH = "bath"
    KITCHEN = "kitchen"
    SIDING = "siding"
    WINDOWS = "windows"
    MAINTENANCE = "maintenance"


class OpportunityStage(str, PyEnum):
    NEW_LEAD = "new_lead"
    TRUST_FIT_QUALIFIED = "trust_fit_qualified"
    INSPECTION_SCHEDULED = "inspection_scheduled"
    ESTIMATE_SENT = "estimate_sent"
    DEPOSIT_RECEIVED = "deposit_received"
    PRODUCTION = "production"
    COMPLETED = "completed"
    MEMBERSHIP = "membership"
    LOST = "lost"


class Opportunity(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "opportunities"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    opportunity_type: Mapped[OpportunityType] = mapped_column(
        Enum(OpportunityType), nullable=False
    )
    stage: Mapped[OpportunityStage] = mapped_column(
        Enum(OpportunityStage), default=OpportunityStage.NEW_LEAD, nullable=False
    )

    # Relationships
    contact_id: Mapped[str | None] = mapped_column(
        ForeignKey("contacts.id"), nullable=True
    )
    property_id: Mapped[str | None] = mapped_column(
        ForeignKey("properties.id"), nullable=True
    )
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"), nullable=True)

    # Forecasting
    estimated_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    probability: Mapped[float | None] = mapped_column(Float, nullable=True)

    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Opportunity {self.name} ({self.stage.value})>"
