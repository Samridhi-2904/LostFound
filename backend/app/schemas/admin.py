from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole


class AdminUserRoleUpdate(BaseModel):
    """Payload for administrator to modify a user's role and staff profile."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    role: UserRole = Field(..., description="Target role: 'user', 'staff', or 'admin'")
    department: Optional[str] = Field(
        None,
        max_length=100,
        description="Assigned department (required when role is 'staff')",
    )
    employee_code: Optional[str] = Field(
        None,
        max_length=50,
        description="Staff employee identification code",
    )


class AdminUserStatusUpdate(BaseModel):
    """Payload for administrator to activate or suspend a user account."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    is_active: bool = Field(..., description="True to activate, False to suspend/deactivate")
    reason: str = Field(..., min_length=3, max_length=500, description="Justification for account status change")


class DashboardLifecycleCounts(BaseModel):
    """Exact report counts partitioned by canonical lifecycle states."""

    model_config = ConfigDict(from_attributes=True)

    open: int
    matched: int
    claimed: int
    returned: int
    archived: int
    disposed: int


class DashboardStatsResponse(BaseModel):
    """System-wide operational dashboard counters and metrics."""

    model_config = ConfigDict(from_attributes=True)

    total_reports: int
    total_lost_reports: int
    total_found_reports: int
    counts_by_lifecycle: DashboardLifecycleCounts
    pending_moderation_reports: int
    verified_reports: int
    rejected_reports: int
    total_claims: int
    pending_claims: int
    approved_claims: int
    rejected_claims: int
    total_returns: int
    total_users: int
    total_staff: int
