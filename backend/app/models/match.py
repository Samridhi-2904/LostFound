from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, Enum, Float, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MatchStatus, enum_values

if TYPE_CHECKING:
    from app.models.report import ItemReport
    from app.models.user import User


class MatchSuggestion(Base):
    """Advisory match suggestion computed between a lost report and a found report."""

    __tablename__ = "match_suggestions"
    __table_args__ = (
        UniqueConstraint("lost_report_id", "found_report_id", name="uq_match_lost_found"),
    )

    match_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lost_report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    found_report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    match_reasons: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-encoded explanation
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, native_enum=False, length=20, values_callable=enum_values),
        default=MatchStatus.NEW,
        index=True,
        nullable=False,
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
    reviewed_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id"),
        nullable=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    lost_report: Mapped["ItemReport"] = relationship("ItemReport", foreign_keys=[lost_report_id])
    found_report: Mapped["ItemReport"] = relationship("ItemReport", foreign_keys=[found_report_id])
    reviewer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by])
