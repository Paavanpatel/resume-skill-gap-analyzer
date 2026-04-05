"""
Security utilities: password hashing, JWT token creation/verification.

Password hashing uses bcrypt via passlib. Bcrypt automatically handles
salting (each hash includes a unique random salt) and is deliberately
slow to resist brute-force attacks. The default "12 rounds" means
2^12 = 4096 iterations -- enough to take ~250ms per hash on modern
hardware, which is imperceptible for login but makes cracking infeasible.

JWT tokens use HS256 (HMAC-SHA256) with a shared secret. We issue two
token types:
- Access token: short-lived (15 min), used for API requests
- Refresh token: longer-lived (7 days), used only to get new access tokens

Why two tokens? The access token is sent with every request and has a
higher exposure risk. Keeping it short-lived limits the damage window
if it leaks. The refresh token is only sent to one endpoint and can be
stored more securely (httpOnly cookie or secure storage).
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, ErrorCode

logger = logging.getLogger(__name__)

# ── Password hashing ─────────────────────────────────────────
# CryptContext handles algorithm selection, salting, and verification.
# "deprecated='auto'" means if we ever switch from bcrypt, old hashes
# still verify but get re-hashed on next login.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """
    Hash a plaintext password with bcrypt.

    Bcrypt has a hard 72-byte limit on input. We truncate to stay safe.
    This is standard practice -- passwords beyond 72 bytes offer no
    additional security with bcrypt anyway.

    Args:
        plain: The user's plaintext password.

    Returns:
        Bcrypt hash string (includes salt and algorithm identifier).
    """
    return _pwd_context.hash(plain[:72])


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hash.

    Args:
        plain: The password the user entered.
        hashed: The stored bcrypt hash from the database.

    Returns:
        True if the password matches, False otherwise.
    """
    try:
        return _pwd_context.verify(plain[:72], hashed)
    except Exception:
        # Malformed hash, unknown algorithm, etc.
        return False


# ── JWT token creation ────────────────────────────────────────


def create_access_token(user_id: UUID, email: str) -> str:
    """
    Create a short-lived access token.

    The token payload includes:
    - sub: user ID (standard JWT claim for "subject")
    - email: for convenience (avoids a DB lookup on every request)
    - type: "access" to distinguish from refresh tokens
    - exp: expiration timestamp
    - iat: issued-at timestamp
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "access",
        "exp": expire,
        "iat": now,
    }

    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def create_refresh_token(user_id: UUID) -> str:
    """
    Create a longer-lived refresh token.

    The refresh token has a minimal payload -- just the user ID and type.
    It's only used at the /auth/refresh endpoint to get a new access token.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "iat": now,
    }

    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.

    Verifies the signature and expiration. Returns the payload dict
    if valid, raises AuthenticationError if not.

    Args:
        token: The raw JWT string from the Authorization header.

    Returns:
        The decoded payload dict with keys: sub, type, exp, iat, etc.

    Raises:
        AuthenticationError: If the token is invalid, expired, or malformed.
    """
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError(
            message="Token has expired. Please log in again.",
            error_code=ErrorCode.TOKEN_EXPIRED,
        )
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid JWT token: %s", str(e)[:200])
        raise AuthenticationError(
            message="Invalid authentication token.",
            error_code=ErrorCode.UNAUTHORIZED,
        )


def get_token_expiry_seconds() -> int:
    """Return access token lifetime in seconds (for the TokenResponse)."""
    settings = get_settings()
    return settings.jwt_access_token_expire_minutes * 60
