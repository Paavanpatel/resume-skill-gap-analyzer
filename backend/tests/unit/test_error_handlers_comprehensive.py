"""
Comprehensive tests for error handlers (core/error_handlers.py).

Tests all error response formatting and HTTP status codes.
"""

import pytest
from unittest.mock import MagicMock
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import (
    AppError, NotFoundError, ValidationError, AuthenticationError,
    FileUploadError, ParsingError, DatabaseError, RateLimitError
)
from app.core.error_handlers import register_error_handlers


@pytest.fixture
def app_with_error_handlers():
    """Create a FastAPI app with registered error handlers."""
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/test-error")
    def raise_app_error():
        raise NotFoundError(message="Test not found")

    @app.get("/test-auth-error")
    def raise_auth_error():
        raise AuthenticationError(message="Test auth error")

    @app.get("/test-validation-error")
    def raise_validation_error():
        raise ValidationError(message="Test validation error")

    @app.get("/test-file-error")
    def raise_file_error():
        raise FileUploadError(message="Test file error")

    @app.get("/test-parsing-error")
    def raise_parsing_error():
        raise ParsingError(message="Test parsing error")

    @app.get("/test-rate-limit-error")
    def raise_rate_limit_error():
        raise RateLimitError(message="Test rate limit", retry_after_seconds=60)

    @app.get("/test-database-error")
    def raise_database_error():
        raise DatabaseError(message="Test database error")

    return app


class TestAppErrorHandler:
    """Tests for AppError exception handler."""

    def test_not_found_error_returns_404(self, app_with_error_handlers):
        """NotFoundError returns 404 with correct format."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-error")

        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "NOT_FOUND"
        assert "Test not found" in data["error"]["message"]
        assert "request_id" in data

    def test_authentication_error_returns_401(self, app_with_error_handlers):
        """AuthenticationError returns 401."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-auth-error")

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"
        assert "Test auth error" in data["error"]["message"]

    def test_validation_error_returns_400(self, app_with_error_handlers):
        """ValidationError returns 400."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-validation-error")

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"

    def test_file_upload_error_returns_400(self, app_with_error_handlers):
        """FileUploadError returns 400."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-file-error")

        assert response.status_code == 400
        data = response.json()
        assert "Test file error" in data["error"]["message"]

    def test_parsing_error_returns_422(self, app_with_error_handlers):
        """ParsingError returns 422."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-parsing-error")

        assert response.status_code == 422
        data = response.json()
        assert "Test parsing error" in data["error"]["message"]

    def test_rate_limit_error_returns_429(self, app_with_error_handlers):
        """RateLimitError returns 429 with retry_after."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-rate-limit-error")

        assert response.status_code == 429
        data = response.json()
        assert data["error"]["code"] == "RATE_LIMITED"
        assert data["error"]["details"]["retry_after_seconds"] == 60

    def test_database_error_returns_500(self, app_with_error_handlers):
        """DatabaseError returns 500."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-database-error")

        assert response.status_code == 500
        data = response.json()
        assert data["error"]["code"] == "DB_ERROR"


class TestErrorResponseFormat:
    """Tests for error response JSON format."""

    def test_error_response_has_required_fields(self, app_with_error_handlers):
        """Error response includes required fields."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-error")

        data = response.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
        assert "request_id" in data

    def test_request_id_is_present(self, app_with_error_handlers):
        """Request ID is included in error response."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-error")

        data = response.json()
        assert data["request_id"] is not None
        assert len(data["request_id"]) > 0


class TestErrorDetails:
    """Tests for error details field."""

    def test_rate_limit_error_includes_details(self, app_with_error_handlers):
        """RateLimitError includes retry_after_seconds in details."""
        client = TestClient(app_with_error_handlers)
        response = client.get("/test-rate-limit-error")

        data = response.json()
        assert "details" in data["error"]
        assert data["error"]["details"]["retry_after_seconds"] == 60

    def test_not_found_error_with_resource_details(self):
        """NotFoundError can include resource type and ID in details."""
        app = FastAPI()
        register_error_handlers(app)

        @app.get("/test-resource-error")
        def raise_error():
            raise NotFoundError(
                message="User not found",
                resource_type="user",
                resource_id="123"
            )

        client = TestClient(app)
        response = client.get("/test-resource-error")

        data = response.json()
        assert data["status_code"] == 404 if "status_code" in data else response.status_code == 404
        assert data["error"]["details"]["resource_type"] == "user"
        assert data["error"]["details"]["resource_id"] == "123"
