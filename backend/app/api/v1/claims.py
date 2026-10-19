from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, require_staff
from app.models.claim import Claim
from app.models.enums import ClaimStatus
from app.models.user import User
from app.schemas.claim import (
    ClaimCreate,
    ClaimDetailResponse,
    ClaimRespondMoreInfo,
    ClaimReviewRequest,
)
from app.services.claim_service import ClaimService

router = APIRouter(tags=["Claims"])


@router.post(
    "/reports/{report_id}/claims",
    response_model=ClaimDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an ownership claim for a found item report",
)
def submit_claim(
    report_id: int,
    claim_in: ClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Submit an ownership claim with private evidence for an eligible found report."""
    claim = ClaimService.create_claim(db, report_id, claim_in, current_user)
    return ClaimService.format_claim_dict(claim, current_user)


@router.get(
    "/claims/me",
    response_model=List[ClaimDetailResponse],
    summary="List all claims submitted by the authenticated user",
)
def get_my_claims(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve claims filed by the current user."""
    offset = (page - 1) * page_size
    claims = (
        db.scalars(
            select(Claim)
            .options(
                joinedload(Claim.report),
                joinedload(Claim.claimant),
                joinedload(Claim.reviewer),
                joinedload(Claim.return_record),
            )
            .where(Claim.claimed_by == current_user.user_id)
            .order_by(Claim.submitted_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return [ClaimService.format_claim_dict(c, current_user) for c in claims]


@router.get(
    "/claims/{claim_id}",
    response_model=ClaimDetailResponse,
    summary="Get claim details (Claimant or Staff/Admin)",
)
def get_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Fetch claim details. Evidence is private to claimant and staff."""
    claim = ClaimService.get_by_id(db, claim_id)
    return ClaimService.format_claim_dict(claim, current_user)


@router.post(
    "/claims/{claim_id}/respond",
    response_model=ClaimDetailResponse,
    summary="Provide additional evidence requested by staff",
)
def respond_more_info(
    claim_id: int,
    response_in: ClaimRespondMoreInfo,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Claimant responds to a more-information-requested state."""
    claim = ClaimService.respond_more_info(db, claim_id, response_in, current_user)
    return ClaimService.format_claim_dict(claim, current_user)


@router.post(
    "/claims/{claim_id}/cancel",
    response_model=ClaimDetailResponse,
    summary="Cancel active claim (Claimant only)",
)
def cancel_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Claimant cancels their active claim."""
    claim = ClaimService.cancel_claim(db, claim_id, current_user)
    return ClaimService.format_claim_dict(claim, current_user)


# =========================================================================
# Staff Moderation Endpoints
# =========================================================================

@router.get(
    "/staff/claims",
    response_model=List[ClaimDetailResponse],
    summary="Queue of claims for staff review (Staff/Admin only)",
)
def list_staff_claims(
    claim_status: Optional[ClaimStatus] = Query(None, description="Filter by claim status"),
    report_id: Optional[int] = Query(None, description="Filter by report ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
) -> Any:
    """Staff review queue for submitted claims."""
    query = (
        select(Claim)
        .options(
            joinedload(Claim.report),
            joinedload(Claim.claimant),
            joinedload(Claim.reviewer),
            joinedload(Claim.return_record),
        )
        .order_by(Claim.submitted_at.desc())
    )

    if claim_status:
        query = query.where(Claim.status == claim_status)
    if report_id:
        query = query.where(Claim.report_id == report_id)

    offset = (page - 1) * page_size
    claims = db.scalars(query.offset(offset).limit(page_size)).unique().all()
    return [ClaimService.format_claim_dict(c, current_user) for c in claims]


@router.post(
    "/staff/claims/{claim_id}/review",
    response_model=ClaimDetailResponse,
    summary="Staff review decision on a claim (Staff/Admin only)",
)
def review_claim(
    claim_id: int,
    review_in: ClaimReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
) -> Any:
    """Staff/Admin decides claim (approve, reject, or request-info). Disallows self-review."""
    claim = ClaimService.review_claim(db, claim_id, review_in, current_user)
    return ClaimService.format_claim_dict(claim, current_user)
