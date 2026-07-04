"""
NoblePort Lead Model

Tracks construction project leads with Buildertrend sync support.
"""

from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class LeadStatus(str, PyEnum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL_SENT = "proposal_sent"
    NEGOTIATING = "negotiating"
    WON = "won"
    LOST = "lost"
    ARCHIVED = "archived"


class LeadSource(str, PyEnum):
    WEBSITE = "website"
    REFERRAL = "referral"
    BUILDERTREND = "buildertrend"
    COLD_CALL = "cold_call"
    TRADE_SHOW = "trade_show"
    SOCIAL_MEDIA = "social_media"
    PARTNER = "partner"
    OTHER = "other"


class Lead(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "leads"

    # Contact Info
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Lead Details
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus), default=LeadStatus.NEW, nullable=False
    )
    source: Mapped[LeadSource] = mapped_column(
        Enum(LeadSource), default=LeadSource.OTHER, nullable=False
    )
    estimated_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Property / Project Location
    property_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Assignment
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    follow_up_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Lead {self.first_name} {self.last_name} ({self.status.value})>"
