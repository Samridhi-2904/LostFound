from typing import Any, List
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_db, require_staff
from app.models.enums import ModerationStatus
from app.models.report import FoundItem, ItemReport
from app.models.user import User
from app.schemas.report import (
    ReportDetailResponse,
    ReportStatusTransition,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/staff/reports", tags=["Staff Report Moderation"])


class ModerationDecision(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Moderation notes or justification")


@router.get(
    "/pending",
    response_model=List[ReportDetailResponse],
    summary="List reports pending moderation review (Staff/Admin only)",
)
def get_pending_reports(
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff),
) -> Any:
    """Retrieve all reports awaiting staff verification or rejection."""
    reports = db.scalars(
        select(ItemReport)
        .options(
            joinedload(ItemReport.category),
            joinedload(ItemReport.creator),
            joinedload(ItemReport.lost_item),
            joinedload(ItemReport.found_item).joinedload(FoundItem.custody_location),
            selectinload(ItemReport.status_history),
        )
        .where(ItemReport.moderation_status == ModerationStatus.PENDING_REVIEW)
        .order_by(ItemReport.date_reported.asc())
    ).all()
    return [ReportService.format_report_dict(r, current_staff) for r in reports]


@router.post(
    "/{report_id}/verify",
    response_model=ReportDetailResponse,
    summary="Verify an item report (Staff/Admin only)",
)
def verify_report(
    report_id: int,
    decision: ModerationDecision,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff),
) -> Any:
    """Approve and verify an item report, making it publicly searchable."""
    report = ReportService.moderate_report(
        db,
        report_id=report_id,
        new_status=ModerationStatus.VERIFIED,
        staff_user=current_staff,
        reason=decision.reason,
    )
    return ReportService.format_report_dict(report, current_staff)


@router.post(
    "/{report_id}/reject",
    response_model=ReportDetailResponse,
    summary="Reject an item report (Staff/Admin only)",
)
def reject_report(
    report_id: int,
    decision: ModerationDecision,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff),
) -> Any:
    """Reject an item report for policy violation or spam."""
    report = ReportService.moderate_report(
        db,
        report_id=report_id,
        new_status=ModerationStatus.REJECTED,
        staff_user=current_staff,
        reason=decision.reason,
    )
    return ReportService.format_report_dict(report, current_staff)


@router.patch(
    "/{report_id}/status",
    response_model=ReportDetailResponse,
    summary="Transition report lifecycle or custody (Staff/Admin only)",
)
def transition_report_status(
    report_id: int,
    transition: ReportStatusTransition,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff),
) -> Any:
    """Update report lifecycle state or transfer custody location."""
    report = ReportService.transition_status(
        db,
        report_id=report_id,
        transition=transition,
        staff_user=current_staff,
    )
    return ReportService.format_report_dict(report, current_staff)
