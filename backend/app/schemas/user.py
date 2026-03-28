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
    role: str  # user | admin | super_admin
    preferences: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token pair returned on login/refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires


# ── Profile & settings update schemas ───────────────────────

class ProfileUpdateRequest(BaseModel):
    """PATCH /auth/profile — update display name and/or email."""
    full_name: str | None = Field(None, max_length=255)
    email: EmailStr | None = None


class PasswordUpdateRequest(BaseModel):
    """PUT /auth/password — change password after verifying the current one."""
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class AccountDeleteRequest(BaseModel):
    """DELETE /auth/account — soft-delete after confirming password."""
    password: str
    confirmation: str  # must equal "DELETE"


class PreferencesUpdateRequest(BaseModel):
    """PATCH /auth/preferences — merge provided keys into existing preferences."""
    preferences: dict


# ── Email verification & password reset schemas ──────────────

class VerifyEmailRequest(BaseModel):
    """POST /auth/verify-email — submit OTP to verify email address."""
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class ResendVerificationRequest(BaseModel):
    """POST /auth/resend-verification — request a new OTP."""
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """POST /auth/forgot-password — initiate password reset flow."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """POST /auth/reset-password — complete reset with token from email link."""
    token: str
    new_password: str = Field(min_length=8, max_length=128)
