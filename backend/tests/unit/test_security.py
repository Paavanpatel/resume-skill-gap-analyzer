"""
Tests for security utilities: password hashing and JWT tokens.

These tests verify:
- Password hashing produces unique salted hashes
- Password verification works correctly
- Access and refresh tokens encode/decode properly
- Token expiration is enforced
- Invalid tokens are rejected
"""

import time
from uuid import UUID

import pytest

from app.core.exceptions import AuthenticationError, ErrorCode
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_expiry_seconds,
    hash_password,
    verify_password,
)

TEST_USER_ID = UUID("12345678-1234-1234-1234-123456789abc")
TEST_EMAIL = "test@example.com"


class TestPasswordHashing:
    """Test bcrypt password hashing and verification."""

    def test_hash_produces_string(self):
        """Hash returns a non-empty string."""
        hashed = hash_password("MySecurePass123")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_is_not_plaintext(self):
        """Hash is never the same as the input."""
        password = "MySecurePass123"
        hashed = hash_password(password)
        assert hashed != password

    def test_same_password_different_hashes(self):
        """Each hash is unique due to random salt."""
        password = "SamePassword"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2

    def test_verify_correct_password(self):
        """Correct password verifies True."""
        password = "CorrectHorse"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_wrong_password(self):
        """Wrong password verifies False."""
        hashed = hash_password("RightPassword")
        assert verify_password("WrongPassword", hashed) is False

    def test_verify_malformed_hash(self):
        """Malformed hash returns False (doesn't crash)."""
        assert verify_password("password", "not-a-valid-hash") is False

    def test_verify_empty_password(self):
        """Empty password still works with bcrypt."""
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False


class TestJWTTokenCreation:
    """Test JWT access and refresh token creation."""

    def test_access_token_is_string(self):
        """Access token returns a non-empty JWT string."""
        token = create_access_token(TEST_USER_ID, TEST_EMAIL)
        assert isinstance(token, str)
        assert len(token) > 0
        # JWT has 3 dot-separated parts
        assert token.count(".") == 2

    def test_refresh_token_is_string(self):
        """Refresh token returns a non-empty JWT string."""
        token = create_refresh_token(TEST_USER_ID)
        assert isinstance(token, str)
        assert token.count(".") == 2

    def test_access_token_contains_claims(self):
        """Access token decodes to expected claims."""
        token = create_access_token(TEST_USER_ID, TEST_EMAIL)
        payload = decode_token(token)
        assert payload["sub"] == str(TEST_USER_ID)
        assert payload["email"] == TEST_EMAIL
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload

    def test_refresh_token_contains_claims(self):
        """Refresh token decodes to expected claims."""
        token = create_refresh_token(TEST_USER_ID)
        payload = decode_token(token)
        assert payload["sub"] == str(TEST_USER_ID)
        assert payload["type"] == "refresh"
        assert "exp" in payload
        assert "email" not in payload  # Refresh tokens are minimal

    def test_different_users_different_tokens(self):
        """Different user IDs produce different tokens."""
        user1 = UUID("11111111-1111-1111-1111-111111111111")
        user2 = UUID("22222222-2222-2222-2222-222222222222")
        token1 = create_access_token(user1, "a@b.com")
        token2 = create_access_token(user2, "c@d.com")
        assert token1 != token2


class TestJWTTokenDecoding:
    """Test JWT token validation and error handling."""

    def test_decode_valid_access_token(self):
        """Valid access token decodes successfully."""
        token = create_access_token(TEST_USER_ID, TEST_EMAIL)
        payload = decode_token(token)
        assert payload["sub"] == str(TEST_USER_ID)

    def test_decode_invalid_token_raises_error(self):
        """Invalid token string raises AuthenticationError."""
        with pytest.raises(AuthenticationError) as exc_info:
            decode_token("not.a.valid.jwt.token")
        assert exc_info.value.error_code == ErrorCode.UNAUTHORIZED

    def test_decode_empty_token_raises_error(self):
        """Empty token raises AuthenticationError."""
        with pytest.raises(AuthenticationError):
            decode_token("")

    def test_decode_tampered_token_raises_error(self):
        """Tampered token (altered payload) fails verification."""
        token = create_access_token(TEST_USER_ID, TEST_EMAIL)
        # Flip a character in the payload
        parts = token.split(".")
        payload_chars = list(parts[1])
        payload_chars[5] = "X" if payload_chars[5] != "X" else "Y"
        parts[1] = "".join(payload_chars)
        tampered = ".".join(parts)

        with pytest.raises(AuthenticationError):
            decode_token(tampered)

    def test_token_expiry_seconds(self):
        """Token expiry helper returns positive int."""
        seconds = get_token_expiry_seconds()
        assert isinstance(seconds, int)
        assert seconds > 0


class TestJWTTokenExpiration:
    """Test that expired tokens are properly rejected."""

    def test_expired_token_raises_error(self):
        """Manually creating an expired token and decoding it raises TOKEN_EXPIRED."""
        from datetime import datetime, timedelta, timezone

        import jwt as pyjwt

        from app.core.config import get_settings

        settings = get_settings()
        past = datetime.now(timezone.utc) - timedelta(hours=1)

        token = pyjwt.encode(
            {"sub": str(TEST_USER_ID), "type": "access", "exp": past},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

        with pytest.raises(AuthenticationError) as exc_info:
            decode_token(token)
        assert exc_info.value.error_code == ErrorCode.TOKEN_EXPIRED
