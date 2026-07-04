"""
NoblePort Journey Asset Model

Persistent form of a Journey Agent asset. Each row is one downstream asset the
Story Engine drafted from an operational artifact: the channel and audience it
serves, the rendered headline/body, its source artifact, whether it needs client
consent, its lifecycle status, who approved it, and the hash-chain links that make
the asset ledger tamper-evident (mirroring TrustRecord and LearningMemory).

The hash chain covers the *generated content*; approval state (status,
approved_by, approved_at) is operational metadata, so a human approving a draft
never breaks chain integrity.
"""

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class JourneyAsset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "journey_assets"

    # What it is
    channel: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    channel_name: Mapped[str] = mapped_column(String(100), nullable=False)
    medium: Mapped[str] = mapped_column(String(30), nullable=False)
    audience: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    # Rendered content
    headline: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    call_to_action: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    hashtags: Mapped[str] = mapped_column(Text, default="[]", nullable=False)  # JSON list
    content_gaps: Mapped[str] = mapped_column(Text, default="[]", nullable=False)  # JSON list

    # Source artifact
    source_artifact_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Governance: consent + human-approval gate
    requires_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_on_file: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False, index=True)
    approved_by: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    approved_at: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Chain integrity
    record_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    prev_hash: Mapped[str] = mapped_column(String(128), nullable=False)

    def __repr__(self) -> str:
        return (
            f"<JourneyAsset {self.channel!r} project={self.project_name!r} "
            f"status={self.status}>"
        )
