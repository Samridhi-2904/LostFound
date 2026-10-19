from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.enums import MatchStatus


class MatchResponse(BaseModel):
    """Advisory match suggestion details with explainable scoring breakdown."""

    model_config = ConfigDict(from_attributes=True)

    match_id: int
    lost_report_id: int
    found_report_id: int
    score: float
    match_reasons: str  # JSON formatted reasons breakdown
    status: MatchStatus
    created_at: datetime
    updated_at: datetime
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
