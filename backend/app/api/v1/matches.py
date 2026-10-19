from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_staff
from app.models.enums import MatchStatus
from app.models.match import MatchSuggestion
from app.models.report import ItemReport
from app.models.user import User
from app.schemas.match import MatchResponse

router = APIRouter(tags=["Matches"])


@router.get(
    "/matches/me",
    response_model=List[MatchResponse],
    summary="List potential matches for reports created by current user",
)
def get_user_matches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve advisory match suggestions for items reported by the authenticated user."""
    # Find report IDs created by current user
    user_report_ids = db.scalars(
        select(ItemReport.report_id).where(ItemReport.created_by == current_user.user_id)
    ).all()

    if not user_report_ids:
        return []

    matches = db.scalars(
        select(MatchSuggestion)
        .where(
            or_(
                MatchSuggestion.lost_report_id.in_(user_report_ids),
                MatchSuggestion.found_report_id.in_(user_report_ids),
            )
        )
        .order_by(MatchSuggestion.score.desc())
    ).all()

    return matches


@router.get(
    "/staff/matches",
    response_model=List[MatchResponse],
    summary="List all match suggestions (Staff/Admin only)",
)
def get_staff_matches(
    status_filter: Optional[MatchStatus] = Query(None, alias="status"),
    min_score: Optional[float] = Query(None, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff),
) -> Any:
    """Staff review queue for potential match suggestions."""
    query = select(MatchSuggestion).order_by(MatchSuggestion.score.desc())

    if status_filter:
        query = query.where(MatchSuggestion.status == status_filter)
    if min_score is not None:
        query = query.where(MatchSuggestion.score >= min_score)

    return db.scalars(query).all()


@router.post(
    "/staff/matches/{match_id}/review",
    response_model=MatchResponse,
    summary="Mark match suggestion as reviewed (Staff/Admin only)",
)
def review_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff),
) -> Any:
    """Mark advisory match suggestion as reviewed by staff."""
    match = db.scalar(select(MatchSuggestion).where(MatchSuggestion.match_id == match_id))
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match suggestion not found.")

    match.status = MatchStatus.REVIEWED
    match.reviewed_by = current_staff.user_id
    match.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(match)
    return match


@router.post(
    "/staff/matches/{match_id}/dismiss",
    response_model=MatchResponse,
    summary="Dismiss match suggestion (Staff/Admin only)",
)
def dismiss_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(require_staff),
) -> Any:
    """Dismiss irrelevant or false-positive match suggestion."""
    match = db.scalar(select(MatchSuggestion).where(MatchSuggestion.match_id == match_id))
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match suggestion not found.")

    match.status = MatchStatus.DISMISSED
    match.reviewed_by = current_staff.user_id
    match.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(match)
    return match
