from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ClaimStatus


class ClaimCreate(BaseModel):
    """Payload for submitting a claim on a found item report."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    ownership_evidence: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Detailed private proof of ownership (e.g. serial numbers, distinguishing marks, purchase receipt references)",
    )


class ClaimRespondMoreInfo(BaseModel):
    """Payload for providing additional evidence requested by staff."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    additional_evidence: str = Field(
        ...,
        min_length=5,
        max_length=5000,
        description="Additional ownership details or documentation provided in response to staff request",
    )


class ClaimReviewRequest(BaseModel):
    """Staff decision payload for evaluating a claim."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    decision: str = Field(
        ...,
        description="Review decision: 'approve', 'reject', or 'request-info'",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Internal staff review notes or instructions for the claimant",
    )
    decision_reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Summary reason recorded for decision (shared with claimant)",
    )


class ClaimDetailResponse(BaseModel):
    """Detailed claim representation with actor-aware privacy."""

    model_config = ConfigDict(from_attributes=True)

    claim_id: int
    report_id: int
    case_reference: Optional[str] = None
    item_name: Optional[str] = None
    claimed_by: int
    claimant_name: Optional[str] = None
    claimant_email: Optional[str] = None
    ownership_evidence: Optional[str] = None  # None for unauthorized viewers
    status: ClaimStatus
    submitted_at: datetime
    reviewed_by: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None  # Restricted to staff/admin
    decision_reason: Optional[str] = None
    has_return: bool = False
    created_at: datetime
    updated_at: datetime
