from datetime import datetime, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=List[NotificationResponse],
    summary="Get notifications for current user",
)
@router.get(
    "/me",
    response_model=List[NotificationResponse],
    summary="Get notifications for current user",
)
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve notifications for the current authenticated user, ordered unread first then newest."""
    notifications = db.scalars(
        select(Notification)
        .where(Notification.user_id == current_user.user_id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
    ).all()
    return notifications


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark a specific notification as read."""
    notif = db.scalar(
        select(Notification).where(
            Notification.notification_id == notification_id,
            Notification.user_id == current_user.user_id,
        )
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    if not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)

    return notif


@router.post(
    "/read-all",
    summary="Mark all notifications as read",
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark all unread notifications for current user as read."""
    now = datetime.now(timezone.utc)
    db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.user_id,
            Notification.is_read == False,
        )
        .values(is_read=True, read_at=now)
    )
    db.commit()
    return {"message": "All notifications marked as read."}
