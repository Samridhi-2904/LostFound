from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CustodyLocationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Location name (e.g. Main Security Desk)")
    description: Optional[str] = Field(None, max_length=500, description="Public description")


class CustodyLocationCreate(CustodyLocationBase):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    restricted_details: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="Private room, locker code, or exact storage address",
    )


class CustodyLocationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    restricted_details: Optional[str] = Field(None, min_length=3, max_length=500)
    is_active: Optional[bool] = None


class CustodyLocationPublicResponse(CustodyLocationBase):
    """Public custody location details: strictly excludes restricted_details."""

    model_config = ConfigDict(from_attributes=True)

    custody_location_id: int
    is_active: bool


class CustodyLocationAdminResponse(CustodyLocationBase):
    """Privileged custody location details for staff and administrators."""

    model_config = ConfigDict(from_attributes=True)

    custody_location_id: int
    restricted_details: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
