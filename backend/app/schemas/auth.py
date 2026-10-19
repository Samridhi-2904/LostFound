from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    """Schema for public user registration. Disallows role self-selection."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of user")
    email: EmailStr = Field(..., description="Unique email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (at least 8 characters)")
    phone: Optional[str] = Field(None, max_length=30, description="Optional contact phone number")

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower()


class UserLogin(BaseModel):
    """Schema for user credentials login."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Password")

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower()


class Token(BaseModel):
    """Schema for authentication token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    """Decoded JWT payload data."""

    sub: str
    email: str
    role: str
    jti: str
    exp: int
    iat: int
