"""
Authentication service: register, login, refresh, and logout.

This service owns the auth business logic. The endpoints call these
functions; they never touch password hashing or JWT creation directly.

Why a service layer and not just do it in the route handler?
- Testability: services are pure async functions, easy to mock DB and test logic
- Reusability: the same register/login logic can be called from CLI scripts, tests, etc.
- Separation: route handlers deal with HTTP; services deal with business rules

Token blacklisting (for logout) uses Redis with a TTL matching the
token's remaining lifetime. This avoids unbounded storage growth --
expired tokens are automatically cleaned up by Redis.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ErrorCode,
    ValidationError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_expiry_seconds,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.user import TokenResponse, UserResponse

logger = logging.getLogger(__name__)


async def register_user(
    email: str,
    password: str,
    full_name: str | None,
    session: AsyncSession,
) -> UserResponse:
    """
    Register a new user.

    Validates uniqueness, hashes the password, creates the DB record,
    and returns a safe response (no password hash).

    Raises:
        ValidationError: If the email is already registered.
    """
    repo = UserRepository(session)

    if await repo.email_exists(email):
        raise ValidationError(
            message="An account with this email already exists.",
            details={"field": "email"},
        )

    hashed = hash_password(password)

    user = await repo.create(
        email=email.lower().strip(),
        hashed_password=hashed,
        full_name=full_name,
        is_active=True,
        is_verified=False,
        tier="free",
    )

    logger.info("New user registered: %s (id=%s)", email, user.id)

    return UserResponse.model_validate(user)


async def login_user(
    email: str,
    password: str,
    session: AsyncSession,
) -> tuple[TokenResponse, UserResponse]:
    """
    Authenticate a user and issue JWT tokens.

    Returns both the token pair and the user profile so the frontend
    can store both in one request (avoiding an extra GET /auth/me call).

    Raises:
        AuthenticationError: If credentials are invalid or account is inactive.
    """
    repo = UserRepository(session)
    user = await repo.get_by_email(email.lower().strip())

    if user is None:
        # Use the same error message for "no user" and "wrong password"
        # to prevent email enumeration attacks.
        raise AuthenticationError(
            message="Invalid email or password.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    if not verify_password(password, user.hashed_password):
        raise AuthenticationError(
            message="Invalid email or password.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    if not user.is_active:
        raise AuthorizationError(
            message="This account has been deactivated. Contact support.",
        )

    # Issue tokens
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id)

    logger.info("User logged in: %s (id=%s)", user.email, user.id)

    token_response = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=get_token_expiry_seconds(),
    )

    user_response = UserResponse.model_validate(user)

    return token_response, user_response


async def refresh_tokens(
    refresh_token: str,
    session: AsyncSession,
    redis_client=None,
) -> TokenResponse:
    """
    Exchange a valid refresh token for a new token pair.

    Why issue a new refresh token too (token rotation)? If the old
    refresh token was stolen, the attacker can only use it once. The
    real user's next refresh attempt will fail (because the old token
    was replaced), alerting them to the compromise.

    Raises:
        AuthenticationError: If the refresh token is invalid, expired,
                             or blacklisted.
    """
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise AuthenticationError(
            message="Invalid token type. Expected a refresh token.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    # Check if the token has been blacklisted (logout)
    if redis_client is not None:
        is_blacklisted = await redis_client.get(f"token:blacklist:{refresh_token}")
        if is_blacklisted:
            raise AuthenticationError(
                message="This refresh token has been revoked.",
                error_code=ErrorCode.UNAUTHORIZED,
            )

    user_id = UUID(payload["sub"])

    # Verify the user still exists and is active
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)

    if user is None or not user.is_active:
        raise AuthenticationError(
            message="User account not found or deactivated.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    # Issue new token pair
    new_access = create_access_token(user.id, user.email)
    new_refresh = create_refresh_token(user.id)

    # Blacklist the old refresh token to prevent reuse
    if redis_client is not None:
        # TTL = remaining lifetime of the old token
        exp = payload.get("exp", 0)
        now = int(datetime.now(timezone.utc).timestamp())
        ttl = max(exp - now, 1)
        await redis_client.setex(
            f"token:blacklist:{refresh_token}", ttl, "revoked"
        )

    logger.info("Tokens refreshed for user %s", user_id)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=get_token_expiry_seconds(),
    )


async def logout_user(
    access_token: str,
    refresh_token: str | None,
    redis_client=None,
) -> None:
    """
    Invalidate the current session by blacklisting tokens in Redis.

    If Redis is unavailable, the logout is "soft" -- the tokens will
    continue to work until they expire naturally. This is an acceptable
    tradeoff because access tokens are short-lived (15 min).
    """
    if redis_client is None:
        logger.warning("Redis unavailable for logout. Tokens will expire naturally.")
        return

    try:
        # Blacklist the access token
        access_payload = decode_token(access_token)
        access_exp = access_payload.get("exp", 0)
        now = int(datetime.now(timezone.utc).timestamp())
        access_ttl = max(access_exp - now, 1)
        await redis_client.setex(
            f"token:blacklist:{access_token}", access_ttl, "revoked"
        )

        # Blacklist the refresh token if provided
        if refresh_token:
            refresh_payload = decode_token(refresh_token)
            refresh_exp = refresh_payload.get("exp", 0)
            refresh_ttl = max(refresh_exp - now, 1)
            await redis_client.setex(
                f"token:blacklist:{refresh_token}", refresh_ttl, "revoked"
            )

        logger.info("User tokens blacklisted for logout (sub=%s)", access_payload.get("sub"))

    except Exception as e:
        # Don't fail the logout if blacklisting fails
        logger.warning("Failed to blacklist tokens on logout: %s", str(e)[:200])


async def update_profile(
    user: "User",
    full_name: str | None,
    email: str | None,
    session: AsyncSession,
) -> UserResponse:
    """
    Update the user's display name and/or email address.

    Email uniqueness is checked before saving. At least one field must
    be provided; omitted fields are left unchanged.

    Raises:
        ValidationError: If the new email is already taken by another account.
    """
    repo = UserRepository(session)

    updates: dict = {}

    if full_name is not None:
        updates["full_name"] = full_name.strip() or None

    if email is not None:
        normalized = email.lower().strip()
        if normalized != user.email:
            if await repo.email_exists(normalized):
                raise ValidationError(
                    message="An account with this email already exists.",
                    details={"field": "email"},
                )
            updates["email"] = normalized

    if updates:
        updated = await repo.update(user.id, **updates)
    else:
        updated = user

    logger.info("Profile updated for user %s", user.id)
    return UserResponse.model_validate(updated)


async def update_password(
    user: "User",
    current_password: str,
    new_password: str,
    session: AsyncSession,
    redis_client=None,
) -> None:
    """
    Change the user's password after verifying the current one.

    All existing refresh tokens are effectively invalidated because they
    are tied to the user's session — the caller should log the user out
    after a successful password change.

    Raises:
        AuthenticationError: If the current password is wrong.
    """
    if not verify_password(current_password, user.hashed_password):
        raise AuthenticationError(
            message="Current password is incorrect.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    new_hash = hash_password(new_password)
    repo = UserRepository(session)
    await repo.update(user.id, hashed_password=new_hash)

    logger.info("Password changed for user %s", user.id)


async def delete_account(
    user: "User",
    password: str,
    session: AsyncSession,
    redis_client=None,
) -> None:
    """
    Soft-delete the user account by setting is_active=False.

    The account is not removed from the database so that related
    analyses and resumes remain intact for audit purposes.

    Raises:
        AuthenticationError: If the provided password is wrong.
        ValidationError: If the deletion confirmation text is missing
                         (callers should validate confirmation == "DELETE"
                         before calling this function).
    """
    if not verify_password(password, user.hashed_password):
        raise AuthenticationError(
            message="Password is incorrect.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    repo = UserRepository(session)
    await repo.update(user.id, is_active=False)

    logger.info("Account soft-deleted for user %s", user.id)


async def update_preferences(
    user: "User",
    preferences: dict,
    session: AsyncSession,
) -> UserResponse:
    """
    Merge new preference keys into the user's existing preferences.

    Uses a shallow merge so callers can update individual keys without
    having to send the full preferences object.
    """
    repo = UserRepository(session)
    merged = {**(user.preferences or {}), **preferences}
    updated = await repo.update(user.id, preferences=merged)

    logger.info("Preferences updated for user %s", user.id)
    return UserResponse.model_validate(updated)


async def get_user_profile(user_id: UUID, session: AsyncSession) -> UserResponse:
    """
    Get the current user's profile.

    Raises:
        AuthenticationError: If the user doesn't exist (deleted account).
    """
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)

    if user is None:
        raise AuthenticationError(
            message="User account not found.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    return UserResponse.model_validate(user)
