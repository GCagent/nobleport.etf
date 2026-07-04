"""
NoblePort Base Model Mixins

Common fields and behaviors for all NoblePort database models.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UUIDMixin:
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )


class BuildertrendSyncMixin:
    """Tracks Buildertrend sync state for any entity."""

    buildertrend_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    bt_last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    bt_sync_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
