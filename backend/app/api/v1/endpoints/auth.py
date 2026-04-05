"""
Authentication endpoints: register, login, refresh, logout, profile.

POST /api/v1/auth/register  -- Create a new account
POST /api/v1/auth/login     -- Authenticate and get tokens
POST /api/v1/auth/refresh   -- Exchange refresh token for new pair (via httpOnly cookie)
POST /api/v1/auth/logout    -- Invalidate tokens
GET  /api/v1/auth/me        -- Get current user profile

Design decisions:
- Login returns both tokens AND user profile (saves an extra GET /me call)
- Refresh token is stored in an httpOnly cookie (XSS protection)
- Access token is returned in the JSON body (for Authorization header)
- Refresh uses token rotation (old refresh token is blacklisted)
- Logout blacklists tokens in Redis with TTL matching remaining lifetime
- Registration doesn't auto-login (user must explicitly log in)
"""

import logging

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.core.dependencies import CurrentUser, get_redis
from app.core.exceptions import AuthenticationError, ErrorCode, ValidationError
from app.db.session import get_db_session
from app.schemas.user import (
    AccountDeleteRequest,
    ForgotPasswordRequest,
    PasswordUpdateRequest,
    PreferencesUpdateRequest,
    ProfileUpdateRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UserCreate,
    UserLogin,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import (
    delete_account,
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
    resend_verification_otp,
    reset_password_with_token,
    send_password_reset,
    send_verification_otp,
    update_password,
    update_preferences,
    update_profile,
    verify_email_otp,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Cookie configuration ────────────────────────────────────
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set the refresh token as an httpOnly secure cookie."""
    settings = get_settings()
    is_production = settings.app_env == "production"
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=is_production,  # HTTPS only in production
        samesite="lax",
        path="/api/v1/auth",  # Only sent to auth endpoints
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh token cookie."""
    settings = get_settings()
    is_production = settings.app_env == "production"
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        httponly=True,
        secure=is_production,
        samesite="lax",
        path="/api/v1/auth",
    )


# ── Request schemas ─────────────────────────────────────────
class RefreshRequest(BaseModel):
    """Request body for token refresh (legacy support)."""

    refresh_token: str | None = None


class LogoutRequest(BaseModel):
    """Request body for logout. Optional refresh token for full invalidation."""

    refresh_token: str | None = None


# ── Response schemas ────────────────────────────────────────
class AccessTokenResponse(BaseModel):
    """Response with access token only (refresh token is in httpOnly cookie)."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginResponse(BaseModel):
    """Login response includes access token and user profile."""

    tokens: AccessTokenResponse
    user: UserResponse


class MessageResponse(BaseModel):
    """Simple message response for operations without data payload."""

    message: str


# ── Endpoints ───────────────────────────────────────────────


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201,
    summary="Create a new user account",
    responses={
        400: {"description": "Validation error (duplicate email, weak password)"},
    },
)
async def register(
    body: UserCreate,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Register a new user with email and password.

    The password must be 8-128 characters. The email must be unique.
    The account starts on the 'free' tier with is_verified=False.
    A 6-digit OTP is sent to the provided email for verification.
    """
    user = await register_user(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        session=session,
    )
    # Fire-and-forget: send OTP (failure is logged, not raised)
    await send_verification_otp(email=body.email, redis_client=redis_client)
    return user


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate and get tokens",
    responses={
        401: {"description": "Invalid credentials or inactive account"},
    },
)
async def login(
    body: UserLogin,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Authenticate with email and password. Returns the access token in
    the response body and the refresh token as an httpOnly cookie.

    The access token should be sent in the Authorization header as:
    `Authorization: Bearer <access_token>`
    """
    tokens, user = await login_user(
        email=body.email,
        password=body.password,
        session=session,
    )

    # Set refresh token as httpOnly cookie (not exposed to JS)
    _set_refresh_cookie(response, tokens.refresh_token)

    return LoginResponse(
        tokens=AccessTokenResponse(
            access_token=tokens.access_token,
            expires_in=tokens.expires_in,
        ),
        user=user,
    )


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Refresh access token",
    responses={
        401: {"description": "Invalid or expired refresh token"},
    },
)
async def refresh(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Exchange a valid refresh token for a new token pair.

    The refresh token is read from the httpOnly cookie (preferred)
    or from the request body (legacy fallback).

    The old refresh token is blacklisted (token rotation) to prevent
    reuse. If a blacklisted refresh token is presented, it's a sign
    of token theft -- the request is rejected.
    """
    # Prefer cookie, fall back to body for backward compatibility
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if not refresh_token:
        # Try parsing body for legacy clients
        try:
            body = await request.json()
            refresh_token = body.get("refresh_token")
        except Exception:
            pass

    if not refresh_token:
        raise AuthenticationError(
            message="No refresh token provided.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    tokens = await refresh_tokens(
        refresh_token=refresh_token,
        session=session,
        redis_client=redis_client,
    )

    # Set new refresh token cookie
    _set_refresh_cookie(response, tokens.refresh_token)

    return AccessTokenResponse(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Invalidate current session",
)
async def logout(
    request: Request,
    response: Response,
    user: CurrentUser,
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Log out by blacklisting the current tokens in Redis and clearing
    the refresh token cookie.

    The refresh token is read from the httpOnly cookie.
    Without Redis, tokens expire naturally (15 min for access).
    """
    # Get refresh token from cookie
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    # Fall back to body for legacy clients
    if not refresh_token:
        try:
            body = await request.json()
            refresh_token = body.get("refresh_token")
        except Exception:
            pass

    await logout_user(
        access_token="",
        refresh_token=refresh_token,
        redis_client=redis_client,
    )

    # Clear the refresh token cookie
    _clear_refresh_cookie(response)

    return MessageResponse(message="Successfully logged out.")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(user: CurrentUser):
    """
    Return the authenticated user's profile.

    This endpoint is useful for:
    - Frontend initialization (check if the stored token is still valid)
    - Fetching updated profile data after changes
    """
    return UserResponse.model_validate(user)


@router.patch(
    "/profile",
    response_model=UserResponse,
    summary="Update display name and/or email",
    responses={
        400: {"description": "Email already in use"},
    },
)
async def update_profile_endpoint(
    body: ProfileUpdateRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Update the authenticated user's full_name and/or email.

    Only provided fields are changed; omit a field to leave it as-is.
    Email changes check for uniqueness across all accounts.
    """
    return await update_profile(
        user=user,
        full_name=body.full_name,
        email=body.email,
        session=session,
    )


@router.put(
    "/password",
    response_model=MessageResponse,
    summary="Change password",
    responses={
        401: {"description": "Current password is incorrect"},
    },
)
async def update_password_endpoint(
    body: PasswordUpdateRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Change the user's password after verifying the current one.

    After a successful password change, the client should log out
    and prompt the user to log in again (existing tokens remain valid
    until they expire, but it's good security practice to rotate them).
    """
    await update_password(
        user=user,
        current_password=body.current_password,
        new_password=body.new_password,
        session=session,
        redis_client=redis_client,
    )
    return MessageResponse(message="Password updated successfully.")


@router.delete(
    "/account",
    response_model=MessageResponse,
    summary="Delete (deactivate) account",
    responses={
        400: {"description": "Confirmation text must be DELETE"},
        401: {"description": "Password is incorrect"},
    },
)
async def delete_account_endpoint(
    body: AccountDeleteRequest,
    response: Response,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Soft-delete the account by setting is_active=False.

    Requires both the correct password and the confirmation string "DELETE".
    The account is deactivated but not erased from the database.
    All tokens are cleared from the client after this call.
    """
    if body.confirmation != "DELETE":
        raise ValidationError(
            message='Confirmation must be exactly "DELETE".',
            details={"field": "confirmation"},
        )

    await delete_account(
        user=user,
        password=body.password,
        session=session,
        redis_client=redis_client,
    )

    _clear_refresh_cookie(response)
    return MessageResponse(message="Account deactivated successfully.")


@router.patch(
    "/preferences",
    response_model=UserResponse,
    summary="Update user preferences",
)
async def update_preferences_endpoint(
    body: PreferencesUpdateRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Merge new preference keys into the user's stored preferences.

    Existing keys not present in the request body are preserved.
    Send only the keys you want to change.
    """
    return await update_preferences(
        user=user,
        preferences=body.preferences,
        session=session,
    )


# ── Email verification endpoints ─────────────────────────────


@router.post(
    "/verify-email",
    response_model=UserResponse,
    summary="Verify email address with OTP",
    responses={
        400: {"description": "Invalid or expired OTP"},
    },
)
async def verify_email_endpoint(
    body: VerifyEmailRequest,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Submit a 6-digit OTP to verify the user's email address.

    Returns the updated user with is_verified=True on success.
    The OTP expires after 15 minutes and is consumed on first use.
    """
    return await verify_email_otp(
        email=body.email,
        otp=body.otp,
        session=session,
        redis_client=redis_client,
    )


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    summary="Resend email verification OTP",
)
async def resend_verification_endpoint(
    body: ResendVerificationRequest,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Request a new OTP for email verification.

    Rate-limited by the global middleware. Always returns 200 to prevent
    email enumeration (even if the address isn't registered).
    """
    await resend_verification_otp(
        email=body.email,
        session=session,
        redis_client=redis_client,
    )
    return MessageResponse(
        message="If this email is registered and unverified, a new code has been sent."
    )


# ── Password reset endpoints ──────────────────────────────────


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Initiate password reset",
)
async def forgot_password_endpoint(
    body: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Send a password reset link to the provided email address.

    Always returns 200 regardless of whether the email is registered,
    to prevent account enumeration.
    """
    await send_password_reset(
        email=body.email,
        session=session,
        redis_client=redis_client,
    )
    return MessageResponse(
        message="If an account with this email exists, a reset link has been sent."
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Complete password reset",
    responses={
        400: {"description": "Token expired or invalid"},
    },
)
async def reset_password_endpoint(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
):
    """
    Reset the user's password using the token from the reset email.

    The token is valid for 1 hour and is consumed on first use.
    The user must log in again after resetting their password.
    """
    await reset_password_with_token(
        token=body.token,
        new_password=body.new_password,
        session=session,
        redis_client=redis_client,
    )
    return MessageResponse(
        message="Password reset successfully. You can now log in with your new password."
    )
