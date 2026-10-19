import math
from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, get_optional_current_user
from app.models.enums import LifecycleStatus, ModerationStatus, ReportType, UserRole
from app.models.report import FoundItem, ItemReport
from app.models.user import User
from app.schemas.report import (
    ReportCreate,
    ReportDetailResponse,
    ReportStatusHistoryResponse,
    ReportUpdate,
)
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "",
    summary="List and search item reports (Public-safe)",
)
def list_reports(
    q: Optional[str] = Query(None, description="Keyword search in title, description, or marks"),
    report_type: Optional[ReportType] = Query(None, description="Filter by 'lost' or 'found'"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    location: Optional[str] = Query(None, description="Filter by approximate location"),
    colour: Optional[str] = Query(None, description="Filter by item colour"),
    date_from: Optional[datetime] = Query(None, description="Earliest date lost or found"),
    date_to: Optional[datetime] = Query(None, description="Latest date lost or found"),
    lifecycle_status: Optional[LifecycleStatus] = Query(None, description="Filter by lifecycle status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    envelope: bool = Query(False, description="Wrap in pagination envelope metadata object"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> Any:
    """Browse and filter lost/found reports. Visitors only see verified, non-archived reports."""
    is_staff_or_admin = current_user and current_user.role in (UserRole.STAFF, UserRole.ADMIN)

    base_query = select(ItemReport)

    # Privacy filter: unauthenticated visitors only see verified reports
    if not is_staff_or_admin:
        base_query = base_query.where(
            ItemReport.moderation_status == ModerationStatus.VERIFIED,
            ItemReport.lifecycle_status.notin_([LifecycleStatus.ARCHIVED, LifecycleStatus.DISPOSED]),
        )

    # Apply filters
    if report_type:
        base_query = base_query.where(ItemReport.report_type == report_type)

    if category_id:
        base_query = base_query.where(ItemReport.category_id == category_id)

    if colour:
        base_query = base_query.where(ItemReport.colour.ilike(f"%{colour.strip()}%"))

    if location:
        base_query = base_query.where(ItemReport.location.ilike(f"%{location.strip()}%"))

    if date_from:
        base_query = base_query.where(ItemReport.date_lost_found >= date_from)

    if date_to:
        base_query = base_query.where(ItemReport.date_lost_found <= date_to)

    if lifecycle_status:
        base_query = base_query.where(ItemReport.lifecycle_status == lifecycle_status)

    if q:
        search_term = f"%{q.strip()}%"
        base_query = base_query.where(
            or_(
                ItemReport.item_name.ilike(search_term),
                ItemReport.description.ilike(search_term),
                ItemReport.distinguishing_marks.ilike(search_term),
                ItemReport.case_reference.ilike(search_term),
            )
        )

    # Count total matching records for pagination metadata
    count_query = select(func.count()).select_from(base_query.subquery())
    total = db.scalar(count_query) or 0

    # Fetch paginated results with eager loads
    data_query = (
        base_query
        .options(
            joinedload(ItemReport.category),
            joinedload(ItemReport.lost_item),
            joinedload(ItemReport.found_item).joinedload(FoundItem.custody_location),
        )
        .order_by(ItemReport.date_reported.desc())
    )
    offset = (page - 1) * page_size
    reports = db.scalars(data_query.offset(offset).limit(page_size)).unique().all()

    items = [ReportService.format_report_dict(r, current_user) for r in reports]
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    if envelope:
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    return items


@router.post(
    "",
    response_model=ReportDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new lost or found item report",
)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new report under the authenticated user's account."""
    report = ReportService.create_report(db, report_in, current_user)
    return ReportService.format_report_dict(report, current_user)


@router.get(
    "/{report_id}",
    summary="Get item report details (Actor-aware privacy)",
)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> Any:
    """Fetch report details. Returns owner/staff fields if authenticated and permitted."""
    report = ReportService.get_by_id(db, report_id)
    return ReportService.format_report_dict(report, current_user)


@router.patch(
    "/{report_id}",
    response_model=ReportDetailResponse,
    summary="Update report details (Owner or Staff/Admin)",
)
def update_report(
    report_id: int,
    report_in: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update editable report details within allowable lifecycle states."""
    report = ReportService.update_report(db, report_id, report_in, current_user)
    return ReportService.format_report_dict(report, current_user)


@router.post(
    "/{report_id}/close",
    response_model=ReportDetailResponse,
    summary="Close or archive an open report",
)
def close_report(
    report_id: int,
    reason: Optional[str] = Query(None, description="Optional closure reason"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Close an open report, transitioning its lifecycle status to 'archived'."""
    report = ReportService.close_report(db, report_id, current_user, reason=reason)
    return ReportService.format_report_dict(report, current_user)


@router.get(
    "/{report_id}/history",
    response_model=List[ReportStatusHistoryResponse],
    summary="Get status and custody history for a report",
)
def get_report_history(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve full audit history for a report. Restricted to owner, staff, or admin."""
    report = ReportService.get_by_id(db, report_id)
    is_owner = report.created_by == current_user.user_id
    is_staff = current_user.role in (UserRole.STAFF, UserRole.ADMIN)
    if not (is_owner or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this report's history.",
        )
    return report.status_history
