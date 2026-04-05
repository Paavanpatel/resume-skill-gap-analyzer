"""
Unit tests for FastAPI dependency injection (core/dependencies.py).

Tests core authentication and dependency resolution logic.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_redis
from app.core.exceptions import AuthenticationError, AuthorizationError, ErrorCode
from app.core.security import create_access_token
from app.models.user import User


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self):
        """Valid JWT token returns the user from database."""
        user_id = uuid4()
        email = "test@example.com"

        # Create a real JWT token
        token = create_access_token(user_id=user_id, email=email)

        # Mock the database and repository
        mock_session = AsyncMock(spec=AsyncSession)
        mock_user = User(
            id=user_id,
            email=email,
            full_name="Test User",
            hashed_password="hashed",
            is_active=True,
            is_verified=False,
            tier="free",
        )

        with patch("app.core.dependencies.UserRepository") as MockRepo:
            mock_repo = MagicMock()
            mock_repo.get_by_id = AsyncMock(return_value=mock_user)
            MockRepo.return_value = mock_repo

            # Create credentials
            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=token
            )

            result = await get_current_user(credentials, mock_session, None)

            assert result.id == user_id
            assert result.email == email
            assert result.is_active is True

    @pytest.mark.asyncio
    async def test_no_credentials_raises_authentication_error(self):
        """Missing credentials raises AuthenticationError."""
        mock_session = AsyncMock(spec=AsyncSession)

        with pytest.raises(AuthenticationError) as exc_info:
            await get_current_user(None, mock_session, None)

        assert exc_info.value.status_code == 401
        assert "Authentication required" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_invalid_token_raises_authentication_error(self):
        """Invalid token format raises AuthenticationError."""
        mock_session = AsyncMock(spec=AsyncSession)

        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials="invalid_token_not_jwt"
        )

        with pytest.raises(AuthenticationError) as exc_info:
            await get_current_user(credentials, mock_session, None)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_inactive_user_raises_authorization_error(self):
        """Inactive user raises AuthorizationError."""
        user_id = uuid4()
        email = "inactive@example.com"

        token = create_access_token(user_id=user_id, email=email)

        mock_session = AsyncMock(spec=AsyncSession)
        inactive_user = User(
            id=user_id,
            email=email,
            full_name="Inactive User",
            hashed_password="hashed",
            is_active=False,  # Inactive
            is_verified=False,
            tier="free",
        )

        with patch("app.core.dependencies.UserRepository") as MockRepo:
            mock_repo = MagicMock()
            mock_repo.get_by_id = AsyncMock(return_value=inactive_user)
            MockRepo.return_value = mock_repo

            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=token
            )

            with pytest.raises(AuthorizationError) as exc_info:
                await get_current_user(credentials, mock_session, None)

            assert exc_info.value.status_code == 403
            assert "deactivated" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_user_not_found_raises_authentication_error(self):
        """User not in database raises AuthenticationError."""
        user_id = uuid4()
        email = "notfound@example.com"

        token = create_access_token(user_id=user_id, email=email)

        mock_session = AsyncMock(spec=AsyncSession)

        with patch("app.core.dependencies.UserRepository") as MockRepo:
            mock_repo = MagicMock()
            mock_repo.get_by_id = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=token
            )

            with pytest.raises(AuthenticationError) as exc_info:
                await get_current_user(credentials, mock_session, None)

            assert exc_info.value.status_code == 401
            assert "not found" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_blacklisted_token_raises_error(self):
        """Blacklisted token in Redis raises AuthenticationError."""
        user_id = uuid4()
        email = "test@example.com"

        token = create_access_token(user_id=user_id, email=email)

        mock_session = AsyncMock(spec=AsyncSession)
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value="1")  # Token is blacklisted

        mock_user = User(
            id=user_id,
            email=email,
            full_name="Test User",
            hashed_password="hashed",
            is_active=True,
            is_verified=False,
            tier="free",
        )

        with patch("app.core.dependencies.UserRepository") as MockRepo:
            mock_repo = MagicMock()
            mock_repo.get_by_id = AsyncMock(return_value=mock_user)
            MockRepo.return_value = mock_repo

            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=token
            )

            with pytest.raises(AuthenticationError) as exc_info:
                await get_current_user(credentials, mock_session, mock_redis)

            assert exc_info.value.status_code == 401
            assert "revoked" in exc_info.value.message


class TestGetRedis:
    """Tests for get_redis dependency."""

    @pytest.mark.asyncio
    async def test_redis_unavailable_returns_none(self):
        """When Redis unavailable, returns None gracefully."""
        with patch("app.core.dependencies._redis_pool", None):
            with patch("app.core.dependencies.aioredis.from_url") as mock_from_url:
                mock_from_url.side_effect = Exception("Connection refused")

                # Reset global pool
                import app.core.dependencies

                app.core.dependencies._redis_pool = None

                result = await get_redis()

                # Should return None when connection fails
                assert result is None

    @pytest.mark.asyncio
    async def test_redis_returns_client_when_available(self):
        """Returns Redis client when connection successful."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock()

        with patch("app.core.dependencies.aioredis.from_url") as mock_from_url:
            mock_from_url.return_value = mock_redis

            # Reset global pool
            import app.core.dependencies

            app.core.dependencies._redis_pool = None

            result = await get_redis()

            assert result is not None


class TestTokenValidation:
    """Tests for token type and expiration validation."""

    @pytest.mark.asyncio
    async def test_refresh_token_raises_error_on_protected_endpoint(self):
        """Using refresh token on protected endpoint raises error."""
        user_id = uuid4()

        # Create a refresh token (type='refresh')
        from app.core.security import create_refresh_token

        token = create_refresh_token(user_id=user_id)

        mock_session = AsyncMock(spec=AsyncSession)

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        with pytest.raises(AuthenticationError) as exc_info:
            await get_current_user(credentials, mock_session, None)

        assert "Invalid token type" in exc_info.value.message
