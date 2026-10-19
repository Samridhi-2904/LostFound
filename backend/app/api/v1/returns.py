from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, require_staff
from app.models.claim import Claim, Return
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.handover import (
    CustodyTransferRequest,
    ReportLifecycleActionRequest,
    ReturnCreate,
    ReturnResponse,
)
from app.schemas.report import ReportDetailResponse
from app.services.report_service import ReportService
from app.services.return_service import ReturnService

router = APIRouter(tags=["Returns & Custody Handover"])


@router.post(
    "/staff/claims/{claim_id}/return",
    response_model=ReturnResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record verified item return and handover (Staff/Admin only)",
)
def record_return_handover(
    claim_id: int,
    return_in: ReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
) -> Any:
    """Record an official verified handover confirmation for an approved claim."""
    return_record = ReturnService.record_return(db, claim_id, return_in, current_user)
    return ReturnService.format_return_dict(return_record)


@router.get(
    "/claims/{claim_id}/return",
    response_model=ReturnResponse,
    summary="Get handover confirmation details for a claim (Claimant or Staff/Admin)",
)
def get_return_handover(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve verified handover details."""
    return_record = db.scalar(
        select(Return)
        .options(
            joinedload(Return.claim).joinedload(Claim.report),
            joinedload(Return.claim).joinedload(Claim.claimant),
            joinedload(Return.officer),
        )
        .where(Return.claim_id == claim_id)
    )
    if not return_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Handover confirmation record for claim #{claim_id} not found.",
        )

    is_claimant = return_record.claim and return_record.claim.claimed_by == current_user.user_id
    is_staff = current_user.role in (UserRole.STAFF, UserRole.ADMIN)

    if not is_claimant and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this handover record.",
        )

    return ReturnService.format_return_dict(return_record)


@router.post(
    "/staff/reports/{report_id}/custody-transfer",
    response_model=ReportDetailResponse,
    summary="Transfer physical custody of a found item (Staff/Admin only)",
)
def transfer_custody(
    report_id: int,
    transfer_in: CustodyTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
) -> Any:
    """Transfer found item physical custody and update storage reference."""
    report = ReturnService.transfer_custody(db, report_id, transfer_in, current_user)
    return ReportService.format_report_dict(report, current_user)


@router.post(
    "/staff/reports/{report_id}/archive",
    response_model=ReportDetailResponse,
    summary="Archive a report under policy workflow (Staff/Admin only)",
)
def archive_report(
    report_id: int,
    action_in: ReportLifecycleActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
) -> Any:
    """Explicitly archive a report with confirmed justification."""
    report = ReturnService.archive_report(db, report_id, action_in, current_user)
    return ReportService.format_report_dict(report, current_user)


@router.post(
    "/staff/reports/{report_id}/dispose",
    response_model=ReportDetailResponse,
    summary="Dispose of an unclaimed found item under policy (Staff/Admin only)",
)
def dispose_report(
    report_id: int,
    action_in: ReportLifecycleActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
) -> Any:
    """Dispose of an unclaimed found item with recorded confirmation."""
    report = ReturnService.dispose_report(db, report_id, action_in, current_user)
    return ReportService.format_report_dict(report, current_user)
