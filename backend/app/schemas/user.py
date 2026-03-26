"""
User schemas for API request/response validation.

Separates input (Create) from output (Response) to prevent
leaking sensitive fields like hashed_password.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(None, max_length=255)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema returned to the client. Never includes password."""
    id: UUID
    email: str
    full_name: str | None
    is_active: bool
    is_verified: bool
    tier: str  # free | pro | enterprise
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token pair returned on login/refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires
