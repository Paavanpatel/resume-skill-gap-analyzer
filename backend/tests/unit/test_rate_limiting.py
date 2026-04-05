"""
Tests for the rate limiting middleware.

Tests the rate limiter's:
- Client identification (IP vs user ID from JWT)
- Analysis endpoint detection
- Exempt path handling
- Rate limit response format
"""

from unittest.mock import MagicMock

import pytest

from app.core.middleware import RateLimitMiddleware


def _make_request(
    path="/api/v1/resume/upload",
    method="GET",
    headers=None,
    client_host="192.168.1.1",
):
    """Create a mock Request object."""
    request = MagicMock()
    request.url.path = path
    request.method = method
    request.headers = headers or {}
    request.client.host = client_host
    request.state = MagicMock()
    request.state.request_id = "test-req-123"
    return request


class TestClientIdentification:
    """Test how the rate limiter identifies clients."""

    def _make_middleware(self):
        return RateLimitMiddleware(
            app=MagicMock(),
            redis_url="redis://localhost:6379/0",
        )

    def test_ip_based_identification(self):
        """Unauthenticated request uses client IP."""
        mw = self._make_middleware()
        request = _make_request(client_host="10.0.0.5")
        client_id = mw._get_client_id(request)
        assert client_id == "ip:10.0.0.5"

    def test_forwarded_for_header(self):
        """X-Forwarded-For header takes precedence over client IP."""
        mw = self._make_middleware()
        request = _make_request(
            headers={"X-Forwarded-For": "1.2.3.4, 5.6.7.8"},
            client_host="127.0.0.1",
        )
        client_id = mw._get_client_id(request)
        assert client_id == "ip:1.2.3.4"

    def test_jwt_user_id_extraction(self):
        """Authenticated request uses user ID from JWT."""
        import jwt as pyjwt

        from app.core.config import get_settings

        settings = get_settings()
        token = pyjwt.encode(
            {"sub": "user-abc-123", "type": "access"},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

        mw = self._make_middleware()
        request = _make_request(
            headers={"authorization": f"Bearer {token}"},
        )
        client_id = mw._get_client_id(request)
        assert client_id == "user:user-abc-123"

    def test_invalid_jwt_falls_back_to_ip(self):
        """Invalid JWT falls back to IP-based identification."""
        mw = self._make_middleware()
        request = _make_request(
            headers={"authorization": "Bearer not.a.valid.jwt"},
            client_host="10.0.0.99",
        )
        client_id = mw._get_client_id(request)
        assert client_id == "ip:10.0.0.99"

    def test_no_auth_header_uses_ip(self):
        """Missing Authorization header uses client IP."""
        mw = self._make_middleware()
        request = _make_request(headers={})
        client_id = mw._get_client_id(request)
        assert client_id == "ip:192.168.1.1"


class TestAnalysisEndpointDetection:
    """Test the analysis endpoint detection logic."""

    def _make_middleware(self):
        return RateLimitMiddleware(
            app=MagicMock(),
            redis_url="redis://localhost:6379/0",
        )

    def test_post_analysis_is_detected(self):
        """POST to analysis endpoint is detected."""
        mw = self._make_middleware()
        request = _make_request(
            path="/api/v1/analysis/123e4567-e89b-12d3-a456-426614174000",
            method="POST",
        )
        assert mw._is_analysis_endpoint(request) is True

    def test_get_analysis_is_not_detected(self):
        """GET to analysis endpoint is not rate-limited as analysis."""
        mw = self._make_middleware()
        request = _make_request(
            path="/api/v1/analysis/123e4567-e89b-12d3-a456-426614174000",
            method="GET",
        )
        assert mw._is_analysis_endpoint(request) is False

    def test_status_endpoint_is_not_detected(self):
        """POST to /status endpoint is not counted as analysis."""
        mw = self._make_middleware()
        request = _make_request(
            path="/api/v1/analysis/123e4567-e89b-12d3-a456-426614174000/status",
            method="POST",
        )
        assert mw._is_analysis_endpoint(request) is False

    def test_other_post_not_detected(self):
        """POST to resume upload is not detected as analysis."""
        mw = self._make_middleware()
        request = _make_request(path="/api/v1/resume/upload", method="POST")
        assert mw._is_analysis_endpoint(request) is False


class TestExemptPaths:
    """Test path exemption logic."""

    def test_health_check_exempt(self):
        """Health check endpoint is exempt from rate limiting."""
        assert "/api/v1/health" in RateLimitMiddleware._EXEMPT_PATHS

    def test_docs_exempt(self):
        """Swagger docs are exempt from rate limiting."""
        assert "/docs" in RateLimitMiddleware._EXEMPT_PATHS

    def test_api_endpoint_not_exempt(self):
        """Regular API endpoints are not exempt."""
        assert "/api/v1/resume/upload" not in RateLimitMiddleware._EXEMPT_PATHS


class TestRateLimitResponse:
    """Test the 429 error response format."""

    def test_response_format(self):
        """Rate limit response has correct shape."""
        import json

        mw = RateLimitMiddleware(
            app=MagicMock(),
            redis_url="redis://localhost:6379/0",
        )
        request = _make_request()
        response = mw._rate_limit_response(30, 45, request)

        assert response.status_code == 429
        body = json.loads(response.body)
        assert body["error"]["code"] == "RATE_LIMITED"
        assert body["error"]["details"]["retry_after_seconds"] == 45
        assert body["request_id"] == "test-req-123"

    def test_response_headers(self):
        """Rate limit response includes standard headers."""
        mw = RateLimitMiddleware(
            app=MagicMock(),
            redis_url="redis://localhost:6379/0",
        )
        request = _make_request()
        response = mw._rate_limit_response(30, 45, request)

        assert response.headers["Retry-After"] == "45"
        assert response.headers["X-RateLimit-Limit"] == "30"
        assert response.headers["X-RateLimit-Remaining"] == "0"
