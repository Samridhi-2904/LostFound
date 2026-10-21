from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import LifecycleStatus, ModerationStatus, ReportType


class LostItemDetails(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    last_seen_location: Optional[str] = None
    reward_offered: Optional[str] = None


class FoundItemPublicDetails(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    found_location: str
    custody_location_id: Optional[int] = None
    custody_location_name: Optional[str] = None


class FoundItemStaffDetails(FoundItemPublicDetails):
    storage_reference: Optional[str] = None
    restricted_custody_details: Optional[str] = None


class ReportStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    history_id: int
    report_id: int
    previous_lifecycle_status: Optional[str] = None
    new_lifecycle_status: Optional[str] = None
    previous_moderation_status: Optional[str] = None
    new_moderation_status: Optional[str] = None
    changed_by: Optional[int] = None
    reason: Optional[str] = None
    changed_at: datetime


class ReportCreate(BaseModel):
    """Schema for submitting a lost or found item report."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    report_type: ReportType = Field(..., description="'lost' or 'found'")
    category_id: int = Field(..., description="ID of item category")
    item_name: str = Field(..., min_length=2, max_length=150, description="Name or title of item")
    description: str = Field(..., min_length=5, description="Detailed item description")
    date_lost_found: datetime = Field(..., description="Date and time when item was lost or found")
    location: str = Field(..., min_length=2, max_length=200, description="Approximate public location")
    colour: Optional[str] = Field(None, max_length=50)
    brand: Optional[str] = Field(None, max_length=50)
    distinguishing_marks: Optional[str] = Field(None, max_length=500)
    contact_preference: str = Field("in_app", max_length=50)
    contact_info_restricted: Optional[str] = Field(None, max_length=200, description="Private contact info")

    # Lost-specific fields
    last_seen_location: Optional[str] = Field(None, max_length=200)
    reward_offered: Optional[str] = Field(None, max_length=100)

    # Found-specific fields
    found_location: Optional[str] = Field(None, max_length=200)
    custody_location_id: Optional[int] = Field(None, description="Optional initial custody location")
    storage_reference: Optional[str] = Field(None, max_length=100)

    @model_validator(mode="before")
    @classmethod
    def map_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = data.copy()
            if "item_name" not in data and "title" in data:
                data["item_name"] = data.pop("title")
            if "date_lost_found" not in data and "date_incident" in data:
                data["date_lost_found"] = data.pop("date_incident")
            if "location" not in data and "location_approximate" in data:
                data["location"] = data.pop("location_approximate")
            if "colour" not in data and "primary_colour" in data:
                data["colour"] = data.pop("primary_colour")
            if "last_seen_location" not in data and "possible_locations" in data:
                data["last_seen_location"] = data.pop("possible_locations")
            if "reward_offered" in data and data["reward_offered"] is not None:
                data["reward_offered"] = str(data["reward_offered"])
            if "model" in data and data.get("model"):
                model_str = str(data.pop("model")).strip()
                if model_str:
                    existing = data.get("distinguishing_marks") or ""
                    data["distinguishing_marks"] = f"{existing} [Model: {model_str}]".strip() if existing else f"Model: {model_str}"
        return data

    @model_validator(mode="after")
    def validate_type_specific_fields(self) -> "ReportCreate":
        if self.report_type == ReportType.FOUND and not self.found_location:
            # Default to general location if found_location is omitted
            self.found_location = self.location
        return self


class ReportUpdate(BaseModel):
    """Schema for report creator to update their own open report."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    item_name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, min_length=5)
    date_lost_found: Optional[datetime] = None
    location: Optional[str] = Field(None, min_length=2, max_length=200)
    colour: Optional[str] = Field(None, max_length=50)
    brand: Optional[str] = Field(None, max_length=50)
    distinguishing_marks: Optional[str] = Field(None, max_length=500)
    contact_preference: Optional[str] = Field(None, max_length=50)
    contact_info_restricted: Optional[str] = Field(None, max_length=200)

    # Subtype fields
    last_seen_location: Optional[str] = Field(None, max_length=200)
    reward_offered: Optional[str] = Field(None, max_length=100)
    found_location: Optional[str] = Field(None, max_length=200)
    custody_location_id: Optional[int] = None
    storage_reference: Optional[str] = Field(None, max_length=100)

    @model_validator(mode="before")
    @classmethod
    def map_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = data.copy()
            if "item_name" not in data and "title" in data:
                data["item_name"] = data.pop("title")
            if "date_lost_found" not in data and "date_incident" in data:
                data["date_lost_found"] = data.pop("date_incident")
            if "location" not in data and "location_approximate" in data:
                data["location"] = data.pop("location_approximate")
            if "colour" not in data and "primary_colour" in data:
                data["colour"] = data.pop("primary_colour")
            if "last_seen_location" not in data and "possible_locations" in data:
                data["last_seen_location"] = data.pop("possible_locations")
            if "reward_offered" in data and data["reward_offered"] is not None:
                data["reward_offered"] = str(data["reward_offered"])
            if "model" in data and data.get("model"):
                model_str = str(data.pop("model")).strip()
                if model_str:
                    existing = data.get("distinguishing_marks") or ""
                    data["distinguishing_marks"] = f"{existing} [Model: {model_str}]".strip() if existing else f"Model: {model_str}"
        return data


class ReportStatusTransition(BaseModel):
    """Schema for staff/admin to transition report moderation or lifecycle status."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    moderation_status: Optional[ModerationStatus] = None
    lifecycle_status: Optional[LifecycleStatus] = None
    custody_location_id: Optional[int] = None
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory audit explanation")


class ReportPublicResponse(BaseModel):
    """Public summary DTO: safely excludes private evidence, restricted contact, and exact storage addresses."""

    model_config = ConfigDict(from_attributes=True)

    report_id: int
    case_reference: str
    report_type: ReportType
    category_id: int
    category_name: Optional[str] = None
    item_name: str
    description: str
    date_reported: datetime
    date_lost_found: datetime
    location: str
    colour: Optional[str] = None
    brand: Optional[str] = None
    distinguishing_marks: Optional[str] = None
    moderation_status: ModerationStatus
    lifecycle_status: LifecycleStatus
    created_at: datetime
    lost_item: Optional[LostItemDetails] = None
    found_item: Optional[FoundItemPublicDetails] = None


class ReportDetailResponse(ReportPublicResponse):
    """Detailed DTO containing restricted fields appropriate to report owner or staff/admin."""

    created_by: int
    creator_name: Optional[str] = None
    contact_preference: str
    contact_info_restricted: Optional[str] = None
    found_item_staff: Optional[FoundItemStaffDetails] = None
    status_history: Optional[List[ReportStatusHistoryResponse]] = None
