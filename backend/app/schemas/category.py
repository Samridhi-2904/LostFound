from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    category_name: str = Field(..., min_length=2, max_length=100, description="Unique category name")
    description: Optional[str] = Field(None, max_length=500, description="Description of the category")


class CategoryCreate(CategoryBase):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class CategoryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    category_name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
