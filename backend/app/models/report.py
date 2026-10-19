from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import LifecycleStatus, ModerationStatus, ReportType, enum_values

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.claim import Claim
    from app.models.custody import CustodyLocation
    from app.models.history import ReportStatusHistory
    from app.models.user import User


class ItemReport(Base):
    """Core domain model representing a reported lost or found item."""

    __tablename__ = "item_reports"

    report_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_reference: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.user_id"),
        index=True,
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.category_id"),
        index=True,
        nullable=False,
    )
    report_type: Mapped[ReportType] = mapped_column(
        Enum(ReportType, native_enum=False, length=10, values_callable=enum_values),
        index=True,
        nullable=False,
    )
    item_name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    date_reported: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    date_lost_found: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )
    location: Mapped[str] = mapped_column(
        String(200),
        index=True,
        nullable=False,
    )  # Approximate public location
    colour: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    distinguishing_marks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_preference: Mapped[str] = mapped_column(
        String(50),
        default="in_app",
        nullable=False,
    )
    contact_info_restricted: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )  # Restricted contact info
    moderation_status: Mapped[ModerationStatus] = mapped_column(
        Enum(ModerationStatus, native_enum=False, length=20, values_callable=enum_values),
        default=ModerationStatus.PENDING_REVIEW,
        index=True,
        nullable=False,
    )
    lifecycle_status: Mapped[LifecycleStatus] = mapped_column(
        Enum(LifecycleStatus, native_enum=False, length=20, values_callable=enum_values),
        default=LifecycleStatus.OPEN,
        index=True,
        nullable=False,
    )
    visibility: Mapped[str] = mapped_column(String(20), default="public", nullable=False)
    verified_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id"),
        nullable=True,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
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

    # Relationships
    creator: Mapped["User"] = relationship(
        "User",
        back_populates="reports",
        foreign_keys=[created_by],
    )
    category: Mapped["Category"] = relationship("Category", back_populates="reports")
    verifier: Mapped[Optional["User"]] = relationship("User", foreign_keys=[verified_by])

    lost_item: Mapped[Optional["LostItem"]] = relationship(
        "LostItem",
        back_populates="report",
        uselist=False,
        cascade="all, delete-orphan",
    )
    found_item: Mapped[Optional["FoundItem"]] = relationship(
        "FoundItem",
        back_populates="report",
        uselist=False,
        cascade="all, delete-orphan",
    )
    images: Mapped[List["ItemImage"]] = relationship(
        "ItemImage",
        back_populates="report",
        cascade="all, delete-orphan",
    )
    claims: Mapped[List["Claim"]] = relationship(
        "Claim",
        back_populates="report",
        cascade="all, delete-orphan",
    )
    status_history: Mapped[List["ReportStatusHistory"]] = relationship(
        "ReportStatusHistory",
        back_populates="report",
        cascade="all, delete-orphan",
    )


class LostItem(Base):
    """Subtype model holding attributes specific to lost item reports."""

    __tablename__ = "lost_items"

    report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="CASCADE"),
        primary_key=True,
    )
    last_seen_location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reward_offered: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    report: Mapped["ItemReport"] = relationship("ItemReport", back_populates="lost_item")


class FoundItem(Base):
    """Subtype model holding attributes specific to found item reports."""

    __tablename__ = "found_items"

    report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="CASCADE"),
        primary_key=True,
    )
    found_location: Mapped[str] = mapped_column(String(200), nullable=False)
    custody_location_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("custody_locations.custody_location_id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    storage_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    report: Mapped["ItemReport"] = relationship("ItemReport", back_populates="found_item")
    custody_location: Mapped[Optional["CustodyLocation"]] = relationship(
        "CustodyLocation",
        back_populates="found_items",
    )


class ItemImage(Base):
    """Uploaded image metadata attached to an item report."""

    __tablename__ = "item_images"

    image_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(String(255), nullable=False)  # Safe generated storage key
    display_filename: Mapped[str] = mapped_column(String(255), nullable=False)  # Sanitized original name
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., image/jpeg
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    report: Mapped["ItemReport"] = relationship("ItemReport", back_populates="images")
