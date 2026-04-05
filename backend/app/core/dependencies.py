"""
FastAPI dependency injection.

Centralizes all injectable dependencies so they can be reused across
endpoints with Depends().

Key dependencies:
- get_current_user: Extracts and validates the JWT from the Authorization header,
  returns the User model. Used by every protected endpoint.
- get_current_active_user: Same as above but also checks is_active.
- get_redis: Returns a Redis client for rate limiting and token blacklisting.
- RateLimiter: Tier-aware per-endpoint rate limit dependency (sliding window).

Why use FastAPI's Depends() instead of just calling functions?
- Automatic cleanup: DB sessions are closed, Redis connections returned to pool
- Request-scoped caching: same dependency called twice in one request gets reused
- Testability: easy to override with test doubles via app.dependency_overrides
"""

import logging
import time
import uuid
from typing import Annotated
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ErrorCode,
    RateLimitError,
)
from app.core.security import decode_token
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)

# ── HTTP Bearer scheme ────────────────────────────────────────
# FastAPI's built-in bearer token extraction from the Authorization header.
# auto_error=False so we get None instead of a 403 (we raise our own 401).
_bearer_scheme = HTTPBearer(auto_error=False)

# ── Redis connection pool (module-level singleton) ────────────
# Created lazily on first use. Connection pooling is critical for
# performance: creating a new TCP connection per request is expensive.
_redis_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis | None:
    """
    Get a Redis client from the connection pool.

    Returns None if Redis is unavailable (graceful degradation).
    Rate limiting and token blacklisting degrade to no-ops without Redis,
    which is acceptable for development but not production.
    """
    global _redis_pool

    if _redis_pool is None:
        settings = get_settings()
        try:
            _redis_pool = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
            )
            # Verify connection
            await _redis_pool.ping()
            logger.info("Redis connection established: %s", settings.redis_url)
        except Exception as e:
            logger.warning(
                "Redis connection failed: %s. Rate limiting and token "
                "blacklisting will be disabled.",
                str(e)[:200],
            )
            _redis_pool = None
            return None

    try:
        await _redis_pool.ping()
        return _redis_pool
    except Exception:
        # Connection lost, reset and return None
        _redis_pool = None
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_db_session),
    redis_client: aioredis.Redis | None = Depends(get_redis),
) -> User:
    """
    Extract and validate the JWT access token, return the User model.

    This is the main auth dependency. Add it to any endpoint that
    requires authentication:

        @router.get("/protected")
        async def protected(user: User = Depends(get_current_user)):
            ...

    Flow:
    1. Extract the Bearer token from the Authorization header
    2. Decode and verify the JWT signature + expiration
    3. Check the token hasn't been blacklisted (logout)
    4. Load the user from the database
    5. Return the User model

    Raises:
        AuthenticationError: If no token, invalid token, expired token,
                             blacklisted token, or user not found.
    """
    if credentials is None:
        raise AuthenticationError(
            message="Authentication required. Provide a Bearer token in the Authorization header.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    token = credentials.credentials

    # Decode and verify the JWT
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise AuthenticationError(
            message="Invalid token type. Expected an access token.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    # Check blacklist (if Redis is available)
    if redis_client is not None:
        try:
            is_blacklisted = await redis_client.get(f"token:blacklist:{token}")
            if is_blacklisted:
                raise AuthenticationError(
                    message="This token has been revoked. Please log in again.",
                    error_code=ErrorCode.UNAUTHORIZED,
                )
        except AuthenticationError:
            raise
        except Exception as e:
            # Redis error -- log but don't block the request
            logger.warning("Redis blacklist check failed: %s", str(e)[:200])

    # Load the user
    user_id = UUID(payload["sub"])
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)

    if user is None:
        raise AuthenticationError(
            message="User account not found.",
            error_code=ErrorCode.UNAUTHORIZED,
        )

    if not user.is_active:
        raise AuthorizationError(
            message="This account has been deactivated.",
        )

    return user


# ── Convenience type alias ────────────────────────────────────
# Use in endpoint signatures for cleaner code:
#   async def endpoint(user: CurrentUser):
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Role-based access control ────────────────────────────────

# Role hierarchy: super_admin > admin > user
ROLE_HIERARCHY = {"user": 0, "admin": 1, "super_admin": 2}


def require_role(*allowed_roles: str):
    """
    Dependency factory that restricts an endpoint to users with one of the
    specified roles (or higher in the hierarchy).

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: User = Depends(require_role("admin"))):
            ...

    A super_admin always passes any role check. The check is based on
    hierarchy: if the minimum required level is "admin" (level 1), then
    both "admin" (1) and "super_admin" (2) pass.
    """
    min_level = min(ROLE_HIERARCHY.get(r, 0) for r in allowed_roles)

    async def _guard(user: User = Depends(get_current_user)) -> User:
        user_level = ROLE_HIERARCHY.get(getattr(user, "role", "user"), 0)
        if user_level < min_level:
            raise AuthorizationError(
                message="You do not have the required role to access this resource.",
            )
        return user

    return _guard


# ── Tier-aware rate limiter dependency ────────────────────────


class RateLimiter:
    """
    Tier-aware per-endpoint rate limit dependency using a sliding window.

    Applies different request limits based on the user's subscription tier,
    using the same Redis sorted-set sliding window as the middleware.

    Usage in endpoints:
        @router.post("/expensive-operation")
        async def my_endpoint(
            user: CurrentUser,
            _: None = Depends(RateLimiter(free=5, pro=50, enterprise=200, window=60)),
        ):
            ...

    Args:
        free: Max requests per window for free-tier users.
        pro: Max requests per window for pro-tier users.
        enterprise: Max requests per window for enterprise-tier users.
        window: Window size in seconds (default: 60).
        scope: Logical name for the limit bucket. Use a unique name per
               endpoint to avoid sharing counters across unrelated endpoints.
               Defaults to "default" (all endpoints share one counter).
    """

    def __init__(
        self,
        free: int = 30,
        pro: int = 100,
        enterprise: int = 500,
        window: int = 60,
        scope: str = "default",
    ):
        self._limits = {"free": free, "pro": pro, "enterprise": enterprise}
        self._window = window
        self._scope = scope

    async def __call__(
        self,
        user: User = Depends(get_current_user),
        redis_client: aioredis.Redis | None = Depends(get_redis),
    ) -> None:
        """
        Check the sliding-window rate limit for this user + scope combination.

        Raises RateLimitError (429) if the limit is exceeded.
        Silently passes if Redis is unavailable (fail-open).
        """
        if redis_client is None:
            return  # Fail open — don't block requests when Redis is down

        tier = getattr(user, "tier", "free") or "free"
        limit = self._limits.get(tier, self._limits["free"])

        key = f"ratelimit:dep:{self._scope}:user:{user.id}"
        now_ms = int(time.time() * 1000)
        window_start_ms = now_ms - (self._window * 1000)
        member = f"{now_ms}-{uuid.uuid4().hex[:8]}"

        try:
            async with redis_client.pipeline(transaction=True) as pipe:
                pipe.zremrangebyscore(key, 0, window_start_ms)
                pipe.zadd(key, {member: now_ms})
                pipe.zcard(key)
                pipe.expire(key, self._window + 1)
                results = await pipe.execute()

            count = results[2]

            if count > limit:
                await redis_client.zrem(key, member)
                raise RateLimitError(
                    message=f"Rate limit exceeded for this operation. Try again in {self._window} seconds.",
                    retry_after_seconds=self._window,
                )

        except RateLimitError:
            raise
        except Exception as e:
            logger.warning(
                "RateLimiter dependency check failed [scope=%s user=%s]: %s",
                self._scope,
                user.id,
                str(e)[:200],
            )
