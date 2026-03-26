"""
Tests for centralized error handling.

Verifies that:
- Exception hierarchy works correctly
- Error responses have the right shape and status codes
- Error codes are set correctly for each exception type
- Details are included when provided
"""

import pytest

from app.core.exceptions import (
    AppError,
    AuthenticationError,
    AuthorizationError,
    DatabaseError,
    ErrorCode,
    FileUploadError,
    NotFoundError,
    ParsingError,
    RateLimitError,
    StorageError,
    ValidationError,
)


class TestExceptionHierarchy:
    """All custom exceptions should inherit from AppError."""

    def test_app_error_defaults(self):
        err = AppError()
        assert err.status_code == 500
        assert err.error_code == ErrorCode.INTERNAL_ERROR
        assert err.message == "An unexpected error occurred."
        assert err.details is None

    def test_app_error_custom(self):
        err = AppError(
            message="Custom error",
            error_code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
            details={"field": "email"},
        )
        assert err.message == "Custom error"
        assert err.error_code == ErrorCode.VALIDATION_ERROR
        assert err.status_code == 400
        assert err.details == {"field": "email"}

    def test_all_subclasses_inherit_from_app_error(self):
        """Every custom exception should be catchable as AppError."""
        subclasses = [
            NotFoundError(),
            ValidationError(),
            FileUploadError(message="test"),
            StorageError(),
            ParsingError(),
            DatabaseError(),
            RateLimitError(),
            AuthenticationError(),
            AuthorizationError(),
        ]
        for exc in subclasses:
            assert isinstance(exc, AppError), f"{type(exc).__name__} is not an AppError"


class TestNotFoundError:
    def test_defaults(self):
        err = NotFoundError()
        assert err.status_code == 404
        assert err.error_code == ErrorCode.NOT_FOUND

    def test_with_resource_info(self):
        err = NotFoundError(
            message="Resume not found.",
            resource_type="resume",
            resource_id="abc-123",
        )
        assert err.details["resource_type"] == "resume"
        assert err.details["resource_id"] == "abc-123"

    def test_without_resource_info(self):
        err = NotFoundError()
        assert err.details is None


class TestFileUploadError:
    def test_with_error_code(self):
        err = FileUploadError(
            message="Too large",
            error_code=ErrorCode.FILE_TOO_LARGE,
            details={"max_size_mb": 10},
        )
        assert err.status_code == 400
        assert err.error_code == ErrorCode.FILE_TOO_LARGE
        assert err.details["max_size_mb"] == 10


class TestParsingError:
    def test_defaults(self):
        err = ParsingError()
        assert err.status_code == 422
        assert err.error_code == ErrorCode.PARSE_FAILED

    def test_no_text(self):
        err = ParsingError(
            message="No text found",
            error_code=ErrorCode.NO_TEXT_EXTRACTED,
        )
        assert err.error_code == ErrorCode.NO_TEXT_EXTRACTED


class TestRateLimitError:
    def test_defaults(self):
        err = RateLimitError()
        assert err.status_code == 429

    def test_with_retry_after(self):
        err = RateLimitError(retry_after_seconds=60)
        assert err.details["retry_after_seconds"] == 60


class TestStorageError:
    def test_defaults(self):
        err = StorageError()
        assert err.status_code == 500
        assert err.error_code == ErrorCode.STORAGE_ERROR


class TestAuthErrors:
    def test_authentication(self):
        err = AuthenticationError()
        assert err.status_code == 401

    def test_authorization(self):
        err = AuthorizationError()
        assert err.status_code == 403
