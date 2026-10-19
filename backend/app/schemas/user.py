from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class StaffProfileResponse(BaseModel):
    """Staff member profile details."""

    model_config = ConfigDict(from_attributes=True)

    staff_id: int
    department: str
    employee_code: Optional[str] = None
    created_at: datetime


class UserResponse(BaseModel):
    """Public and authenticated user profile response (omits sensitive credentials)."""

    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    staff_profile: Optional[StaffProfileResponse] = None


class UserUpdate(BaseModel):
    """Schema for users to update their own profile information."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    current_password: Optional[str] = Field(None, min_length=8, max_length=128)
    new_password: Optional[str] = Field(None, min_length=8, max_length=128)
