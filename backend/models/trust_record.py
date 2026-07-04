"""
NoblePort Trust Record Model

Proof of Trust layer: immutable audit trail for every action in the system.
Each record is hash-chained to the previous one, creating a tamper-evident
ledger that proves who did what, who approved it, and what AI suggested.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class TrustApprovalType(str, PyEnum):
    AUTO = "auto"
    HUMAN = "human"
    MULTI_SIG = "multi_sig"
    POLICY = "policy"
    NONE = "none"


class TrustRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "trust_records"

    # Who acted
    actor: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    agent_family: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # What happened
    action: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subject_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    detail: Mapped[str] = mapped_column(Text, nullable=False)

    # What approved it
    approval_type: Mapped[TrustApprovalType] = mapped_column(
        Enum(TrustApprovalType), default=TrustApprovalType.NONE, nullable=False
    )
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approval_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # What AI suggested
    ai_suggested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    human_overrode_ai: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # What document supports it
    document_ref: Mapped[str | None] = mapped_column(String(500), nullable=True)
    document_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # What payment occurred
    payment_id: Mapped[str | None] = mapped_column(
        ForeignKey("payments.id"), nullable=True, index=True
    )
    payment_amount: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Chain integrity
    record_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    prev_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    chain_anchor: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(50), default="committed", nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<TrustRecord {self.action} by {self.actor} ({self.status})>"
