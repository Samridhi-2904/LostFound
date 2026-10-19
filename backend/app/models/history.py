from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.report import ItemReport
    from app.models.user import User


class ReportStatusHistory(Base):
    """Audit trail of status and custody transitions for an item report."""

    __tablename__ = "report_status_histories"

    history_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    previous_lifecycle_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    new_lifecycle_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    previous_moderation_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    new_moderation_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    previous_custody_location_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("custody_locations.custody_location_id", ondelete="SET NULL"),
        nullable=True,
    )
    new_custody_location_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("custody_locations.custody_location_id", ondelete="SET NULL"),
        nullable=True,
    )
    changed_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id"),
        nullable=True,
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    report: Mapped["ItemReport"] = relationship("ItemReport", back_populates="status_history")
    actor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[changed_by])


class AuditLog(Base):
    """System-wide security and compliance audit log for sensitive operations."""

    __tablename__ = "audit_logs"

    audit_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)  # Safe structured JSON/text summary
    correlation_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    actor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[actor_user_id])
