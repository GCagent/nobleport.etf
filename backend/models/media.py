"""
NoblePort Media & Photo Model

Centralized media repository with folder organization,
photo annotations, access control, and job/task attachment.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class MediaType(str, PyEnum):
    PHOTO = "photo"
    VIDEO = "video"
    DOCUMENT = "document"
    BLUEPRINT = "blueprint"
    PERMIT = "permit"
    CONTRACT = "contract"
    RECEIPT = "receipt"
    INSPECTION_REPORT = "inspection_report"
    OTHER = "other"


class PhotoTag(str, PyEnum):
    BEFORE = "before"
    AFTER = "after"
    PROGRESS = "progress"
    ISSUE = "issue"
    SAFETY = "safety"
    INSPECTION = "inspection"
    DELIVERY = "delivery"
    GENERAL = "general"


class AccessLevel(str, PyEnum):
    PRIVATE = "private"
    INTERNAL = "internal"
    CLIENT_VISIBLE = "client_visible"
    PUBLIC = "public"


class MediaFolder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "media_folders"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )
    parent_folder_id: Mapped[str | None] = mapped_column(
        ForeignKey("media_folders.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_level: Mapped[AccessLevel] = mapped_column(
        Enum(AccessLevel), default=AccessLevel.INTERNAL, nullable=False
    )

    def __repr__(self) -> str:
        return f"<MediaFolder {self.name}>"


class MediaFile(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "media_files"

    # Relationships
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )
    folder_id: Mapped[str | None] = mapped_column(
        ForeignKey("media_folders.id"), nullable=True
    )
    daily_log_id: Mapped[str | None] = mapped_column(
        ForeignKey("daily_logs.id"), nullable=True
    )
    schedule_item_id: Mapped[str | None] = mapped_column(
        ForeignKey("schedule_items.id"), nullable=True
    )

    # File Info
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    media_type: Mapped[MediaType] = mapped_column(
        Enum(MediaType), default=MediaType.PHOTO, nullable=False
    )

    # Photo Metadata
    photo_tag: Mapped[PhotoTag | None] = mapped_column(
        Enum(PhotoTag), nullable=True
    )
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)
    taken_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gps_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Access
    access_level: Mapped[AccessLevel] = mapped_column(
        Enum(AccessLevel), default=AccessLevel.INTERNAL, nullable=False
    )
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # IPFS / On-chain storage hash
    ipfs_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<MediaFile {self.filename} ({self.media_type.value})>"


class PhotoAnnotation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "photo_annotations"

    media_file_id: Mapped[str] = mapped_column(
        ForeignKey("media_files.id"), nullable=False, index=True
    )

    # Annotation Data
    annotation_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # circle, arrow, rectangle, text, freehand
    label: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Position (percentage-based for resolution independence)
    x_percent: Mapped[float] = mapped_column(Float, nullable=False)
    y_percent: Mapped[float] = mapped_column(Float, nullable=False)
    width_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Style
    color: Mapped[str] = mapped_column(String(20), default="#FF0000", nullable=False)
    stroke_width: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    # Author
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Issue linkage
    is_issue: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    issue_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<PhotoAnnotation {self.annotation_type} on {self.media_file_id}>"
