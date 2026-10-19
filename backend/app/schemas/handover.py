from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ReturnCreate(BaseModel):
    """Payload for recording an officially verified item return/handover."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    recipient_confirmation: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Verification method and identity confirmation (e.g., student ID inspected, signature collected)",
    )
    condition_of_item: Optional[str] = Field(
        None,
        max_length=500,
        description="Physical condition of item at handover",
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Any additional handover notes",
    )


class ReturnResponse(BaseModel):
    """Details of a recorded handover confirmation."""

    model_config = ConfigDict(from_attributes=True)

    return_id: int
    claim_id: int
    report_id: int
    case_reference: Optional[str] = None
    item_name: Optional[str] = None
    recorded_by: int
    officer_name: Optional[str] = None
    returned_at: datetime
    recipient_confirmation: str
    condition_of_item: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class CustodyTransferRequest(BaseModel):
    """Payload for transferring found item physical custody or updating storage reference."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    new_custody_location_id: int = Field(..., description="ID of destination custody location")
    storage_reference: Optional[str] = Field(None, max_length=100, description="Updated shelf/bin/locker code")
    reason: str = Field(..., min_length=3, max_length=500, description="Justification for custody transfer")


class ReportLifecycleActionRequest(BaseModel):
    """Payload for sensitive status transitions like archiving or disposal."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    reason: str = Field(..., min_length=5, max_length=500, description="Policy justification for lifecycle change")
    confirm: bool = Field(..., description="Explicit user confirmation for destructive or final state")


class AuditLogResponse(BaseModel):
    """Audit log entry for administrator and compliance inspection."""

    model_config = ConfigDict(from_attributes=True)

    audit_id: int
    actor_user_id: Optional[int] = None
    actor_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    timestamp: datetime
    summary: str
    correlation_id: Optional[str] = None
