from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import NotificationType, enum_values

if TYPE_CHECKING:
    from app.models.user import User


class Notification(Base):
    """In-app privacy-safe notification for users regarding matches and claim decisions."""

    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, native_enum=False, length=30, values_callable=enum_values),
        default=NotificationType.SYSTEM,
        nullable=False,
    )
    related_report_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="SET NULL"),
        nullable=True,
    )
    related_claim_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("claims.claim_id", ondelete="SET NULL"),
        nullable=True,
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")
