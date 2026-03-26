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

from fastapi import APIRouter, Cookie, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.core.dependencies import CurrentUser, get_redis
from app.core.exceptions import AuthenticationError, ErrorCode
from app.db.session import get_db_session
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import (
    get_user_profile,
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
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
):
    """
    Register a new user with email and password.

    The password must be 8-128 characters. The email must be unique.
    The account starts on the 'free' tier with is_verified=False.
    """
    return await register_user(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        session=session,
    )


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
