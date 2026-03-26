"""
Tests for the authentication service.

Tests register, login, refresh, and logout logic.
Uses mocked DB sessions and repositories to isolate business logic.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.core.exceptions import AuthenticationError, AuthorizationError, ValidationError
from app.services.auth_service import (
    get_user_profile,
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
)


def _make_mock_user(
    user_id=None,
    email="test@example.com",
    password_hash="$2b$12$fakehash",
    is_active=True,
    is_verified=False,
    tier="free",
):
    """Create a mock User object."""
    user = MagicMock()
    user.id = user_id or uuid4()
    user.email = email
    user.hashed_password = password_hash
    user.is_active = is_active
    user.is_verified = is_verified
    user.tier = tier
    user.full_name = "Test User"
    user.created_at = datetime.now(timezone.utc)
    return user


class TestRegisterUser:
    """Test user registration."""

    @pytest.mark.asyncio
    async def test_register_success(self):
        """Successful registration returns user response."""
        session = AsyncMock()

        with (
            patch("app.services.auth_service.UserRepository") as MockRepo,
            patch("app.services.auth_service.hash_password", return_value="$2b$12$hashed"),
        ):
            repo = MockRepo.return_value
            repo.email_exists = AsyncMock(return_value=False)

            mock_user = _make_mock_user(email="new@example.com")
            repo.create = AsyncMock(return_value=mock_user)

            result = await register_user(
                email="new@example.com",
                password="SecurePass123",
                full_name="New User",
                session=session,
            )

            assert result.email == "new@example.com"
            repo.email_exists.assert_awaited_once()
            repo.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_register_duplicate_email_raises_error(self):
        """Duplicate email raises ValidationError."""
        session = AsyncMock()

        with patch("app.services.auth_service.UserRepository") as MockRepo:
            repo = MockRepo.return_value
            repo.email_exists = AsyncMock(return_value=True)

            with pytest.raises(ValidationError, match="already exists"):
                await register_user(
                    email="exists@example.com",
                    password="SecurePass123",
                    full_name=None,
                    session=session,
                )

    @pytest.mark.asyncio
    async def test_register_normalizes_email(self):
        """Email is lowercased and stripped."""
        session = AsyncMock()

        with (
            patch("app.services.auth_service.UserRepository") as MockRepo,
            patch("app.services.auth_service.hash_password", return_value="$2b$12$hashed"),
        ):
            repo = MockRepo.return_value
            repo.email_exists = AsyncMock(return_value=False)
            mock_user = _make_mock_user(email="test@example.com")
            repo.create = AsyncMock(return_value=mock_user)

            await register_user(
                email="  Test@Example.COM  ",
                password="SecurePass123",
                full_name=None,
                session=session,
            )

            # Check that create was called with normalized email
            call_kwargs = repo.create.call_args[1]
            assert call_kwargs["email"] == "test@example.com"


class TestLoginUser:
    """Test user login."""

    @pytest.mark.asyncio
    async def test_login_success(self):
        """Successful login returns tokens and user."""
        session = AsyncMock()
        mock_user = _make_mock_user()

        with (
            patch("app.services.auth_service.UserRepository") as MockRepo,
            patch("app.services.auth_service.verify_password", return_value=True),
            patch("app.services.auth_service.create_access_token", return_value="access.jwt.token"),
            patch("app.services.auth_service.create_refresh_token", return_value="refresh.jwt.token"),
        ):
            repo = MockRepo.return_value
            repo.get_by_email = AsyncMock(return_value=mock_user)

            tokens, user = await login_user("test@example.com", "password", session)

            assert tokens.access_token == "access.jwt.token"
            assert tokens.refresh_token == "refresh.jwt.token"
            assert tokens.token_type == "bearer"
            assert user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_login_wrong_email_raises_error(self):
        """Non-existent email raises AuthenticationError."""
        session = AsyncMock()

        with patch("app.services.auth_service.UserRepository") as MockRepo:
            repo = MockRepo.return_value
            repo.get_by_email = AsyncMock(return_value=None)

            with pytest.raises(AuthenticationError, match="Invalid email or password"):
                await login_user("nonexistent@example.com", "password", session)

    @pytest.mark.asyncio
    async def test_login_wrong_password_raises_error(self):
        """Wrong password raises AuthenticationError with same message (anti-enumeration)."""
        session = AsyncMock()
        mock_user = _make_mock_user()

        with (
            patch("app.services.auth_service.UserRepository") as MockRepo,
            patch("app.services.auth_service.verify_password", return_value=False),
        ):
            repo = MockRepo.return_value
            repo.get_by_email = AsyncMock(return_value=mock_user)

            with pytest.raises(AuthenticationError, match="Invalid email or password"):
                await login_user("test@example.com", "wrongpass", session)

    @pytest.mark.asyncio
    async def test_login_inactive_user_raises_error(self):
        """Inactive user raises AuthorizationError."""
        session = AsyncMock()
        mock_user = _make_mock_user(is_active=False)

        with (
            patch("app.services.auth_service.UserRepository") as MockRepo,
            patch("app.services.auth_service.verify_password", return_value=True),
        ):
            repo = MockRepo.return_value
            repo.get_by_email = AsyncMock(return_value=mock_user)

            with pytest.raises(AuthorizationError, match="deactivated"):
                await login_user("test@example.com", "password", session)


class TestRefreshTokens:
    """Test token refresh."""

    @pytest.mark.asyncio
    async def test_refresh_success(self):
        """Valid refresh token returns new token pair."""
        session = AsyncMock()
        mock_user = _make_mock_user()
        user_id = str(mock_user.id)

        with (
            patch("app.services.auth_service.decode_token") as mock_decode,
            patch("app.services.auth_service.UserRepository") as MockRepo,
            patch("app.services.auth_service.create_access_token", return_value="new.access"),
            patch("app.services.auth_service.create_refresh_token", return_value="new.refresh"),
        ):
            mock_decode.return_value = {
                "sub": user_id,
                "type": "refresh",
                "exp": 9999999999,
            }
            repo = MockRepo.return_value
            repo.get_by_id = AsyncMock(return_value=mock_user)

            result = await refresh_tokens("old.refresh.token", session)

            assert result.access_token == "new.access"
            assert result.refresh_token == "new.refresh"

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_type_raises_error(self):
        """Using an access token for refresh raises error."""
        session = AsyncMock()

        with patch("app.services.auth_service.decode_token") as mock_decode:
            mock_decode.return_value = {"sub": "123", "type": "access", "exp": 9999999999}

            with pytest.raises(AuthenticationError, match="refresh token"):
                await refresh_tokens("access.token", session)

    @pytest.mark.asyncio
    async def test_refresh_blacklisted_token_raises_error(self):
        """Blacklisted refresh token is rejected."""
        session = AsyncMock()
        redis_client = AsyncMock()
        redis_client.get = AsyncMock(return_value="revoked")

        with patch("app.services.auth_service.decode_token") as mock_decode:
            mock_decode.return_value = {"sub": "123", "type": "refresh", "exp": 9999999999}

            with pytest.raises(AuthenticationError, match="revoked"):
                await refresh_tokens("blacklisted.token", session, redis_client)

    @pytest.mark.asyncio
    async def test_refresh_deleted_user_raises_error(self):
        """Refresh token for deleted user is rejected."""
        session = AsyncMock()
        user_id = str(uuid4())

        with (
            patch("app.services.auth_service.decode_token") as mock_decode,
            patch("app.services.auth_service.UserRepository") as MockRepo,
        ):
            mock_decode.return_value = {"sub": user_id, "type": "refresh", "exp": 9999999999}
            repo = MockRepo.return_value
            repo.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(AuthenticationError, match="not found"):
                await refresh_tokens("valid.token", session)


class TestLogoutUser:
    """Test logout (token blacklisting)."""

    @pytest.mark.asyncio
    async def test_logout_with_redis(self):
        """Logout blacklists tokens in Redis."""
        redis_client = AsyncMock()
        redis_client.setex = AsyncMock()

        with patch("app.services.auth_service.decode_token") as mock_decode:
            mock_decode.return_value = {"sub": "123", "exp": 9999999999}

            await logout_user(
                access_token="access.token",
                refresh_token="refresh.token",
                redis_client=redis_client,
            )

            # Should blacklist both tokens
            assert redis_client.setex.call_count == 2

    @pytest.mark.asyncio
    async def test_logout_without_redis_graceful(self):
        """Logout without Redis doesn't raise (graceful degradation)."""
        await logout_user(
            access_token="access.token",
            refresh_token="refresh.token",
            redis_client=None,
        )
        # Should not raise

    @pytest.mark.asyncio
    async def test_logout_redis_error_graceful(self):
        """Redis error during logout doesn't raise."""
        redis_client = AsyncMock()
        redis_client.setex = AsyncMock(side_effect=Exception("Redis down"))

        with patch("app.services.auth_service.decode_token") as mock_decode:
            mock_decode.return_value = {"sub": "123", "exp": 9999999999}

            # Should not raise even if Redis fails
            await logout_user("access.token", "refresh.token", redis_client)


class TestGetUserProfile:
    """Test profile retrieval."""

    @pytest.mark.asyncio
    async def test_get_profile_success(self):
        """Returns user profile for valid user ID."""
        session = AsyncMock()
        mock_user = _make_mock_user()

        with patch("app.services.auth_service.UserRepository") as MockRepo:
            repo = MockRepo.return_value
            repo.get_by_id = AsyncMock(return_value=mock_user)

            result = await get_user_profile(mock_user.id, session)
            assert result.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_profile_nonexistent_raises_error(self):
        """Non-existent user raises AuthenticationError."""
        session = AsyncMock()

        with patch("app.services.auth_service.UserRepository") as MockRepo:
            repo = MockRepo.return_value
            repo.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(AuthenticationError, match="not found"):
                await get_user_profile(uuid4(), session)
