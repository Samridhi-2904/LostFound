from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ClaimStatus, enum_values

if TYPE_CHECKING:
    from app.models.report import ItemReport
    from app.models.user import User


class Claim(Base):
    """Claim submitted by a user for an eligible found item report."""

    __tablename__ = "claims"

    claim_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("item_reports.report_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    claimed_by: Mapped[int] = mapped_column(
        ForeignKey("users.user_id"),
        index=True,
        nullable=False,
    )
    ownership_evidence: Mapped[str] = mapped_column(Text, nullable=False)  # Private claimant evidence
    status: Mapped[ClaimStatus] = mapped_column(
        Enum(ClaimStatus, native_enum=False, length=30, values_callable=enum_values),
        default=ClaimStatus.PENDING,
        index=True,
        nullable=False,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
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
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Private staff notes
    decision_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    report: Mapped["ItemReport"] = relationship("ItemReport", back_populates="claims")
    claimant: Mapped["User"] = relationship(
        "User",
        back_populates="claims",
        foreign_keys=[claimed_by],
    )
    reviewer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by])
    return_record: Mapped[Optional["Return"]] = relationship(
        "Return",
        back_populates="claim",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Return(Base):
    """Verified handover confirmation record created when an item is returned."""

    __tablename__ = "returns"

    return_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    claim_id: Mapped[int] = mapped_column(
        ForeignKey("claims.claim_id"),
        unique=True,
        index=True,
        nullable=False,
    )
    recorded_by: Mapped[int] = mapped_column(
        ForeignKey("users.user_id"),
        nullable=False,
    )
    returned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    recipient_confirmation: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )  # Verification method / confirmation details
    condition_of_item: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    claim: Mapped["Claim"] = relationship("Claim", back_populates="return_record")
    officer: Mapped["User"] = relationship("User", foreign_keys=[recorded_by])
