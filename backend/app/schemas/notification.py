from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.enums import NotificationType


class NotificationResponse(BaseModel):
    """In-app privacy-safe notification details."""

    model_config = ConfigDict(from_attributes=True)

    notification_id: int
    user_id: int
    title: str
    message: str
    type: NotificationType
    related_report_id: Optional[int] = None
    related_claim_id: Optional[int] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
