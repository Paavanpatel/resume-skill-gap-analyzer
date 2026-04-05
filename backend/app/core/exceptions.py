"""
Centralized exception hierarchy and error response models.

Every exception the app can raise inherits from AppError. This gives us:
- Consistent error responses (same JSON shape for every error)
- Centralized HTTP status code mapping
- Machine-readable error codes the frontend can switch on
- Human-readable messages for display

The frontend always receives this shape:
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "File exceeds the 10 MB size limit.",
        "details": {...}  // optional, extra context
    },
    "request_id": "abc-123"  // for support/debugging
}
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel


# ── Error codes ───────────────────────────────────────────────
# Machine-readable codes the frontend can use in switch statements.
# Grouped by domain so they're easy to scan.


class ErrorCode(str, Enum):
    # General
    INTERNAL_ERROR = "INTERNAL_ERROR"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMITED = "RATE_LIMITED"

    # Auth (Phase 7)
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"

    # File upload
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    FILE_TYPE_NOT_ALLOWED = "FILE_TYPE_NOT_ALLOWED"
    FILE_CORRUPTED = "FILE_CORRUPTED"
    FILE_EMPTY = "FILE_EMPTY"
    STORAGE_ERROR = "STORAGE_ERROR"

    # Resume parsing
    PARSE_FAILED = "PARSE_FAILED"
    NO_TEXT_EXTRACTED = "NO_TEXT_EXTRACTED"

    # Analysis (Phase 5+)
    AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    CONFLICT = "CONFLICT"

    # Database
    DB_ERROR = "DB_ERROR"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"


# ── Error response model ─────────────────────────────────────
# This is the JSON shape every error response follows.


class ErrorDetail(BaseModel):
    """The error payload inside every error response."""

    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    """Top-level error response envelope."""

    error: ErrorDetail
    request_id: str | None = None


# ── Exception hierarchy ──────────────────────────────────────
# All app exceptions inherit from AppError. The global handler
# catches AppError and converts it to the ErrorResponse shape.
# Anything that ISN'T an AppError is an unexpected bug and gets
# a generic 500.


class AppError(Exception):
    """
    Base exception for all application errors.

    Subclasses set their own status_code and error_code defaults.
    Individual raises can override the message and details.
    """

    def __init__(
        self,
        message: str = "An unexpected error occurred.",
        error_code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class NotFoundError(AppError):
    """Resource not found (404)."""

    def __init__(
        self,
        message: str = "The requested resource was not found.",
        resource_type: str | None = None,
        resource_id: str | None = None,
    ):
        details = {}
        if resource_type:
            details["resource_type"] = resource_type
        if resource_id:
            details["resource_id"] = resource_id
        super().__init__(
            message=message,
            error_code=ErrorCode.NOT_FOUND,
            status_code=404,
            details=details or None,
        )


class ValidationError(AppError):
    """Request validation failed (400)."""

    def __init__(
        self,
        message: str = "Validation failed.",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            error_code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
            details=details,
        )


class FileUploadError(AppError):
    """File upload validation failed (400)."""

    def __init__(
        self,
        message: str,
        error_code: ErrorCode = ErrorCode.VALIDATION_ERROR,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=400,
            details=details,
        )


class StorageError(AppError):
    """File storage operation failed (500)."""

    def __init__(self, message: str = "File storage operation failed."):
        super().__init__(
            message=message,
            error_code=ErrorCode.STORAGE_ERROR,
            status_code=500,
        )


class ParsingError(AppError):
    """Resume parsing failed (422)."""

    def __init__(
        self,
        message: str = "Could not parse the resume.",
        error_code: ErrorCode = ErrorCode.PARSE_FAILED,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=422,
            details=details,
        )


class DatabaseError(AppError):
    """Database operation failed (500)."""

    def __init__(self, message: str = "A database error occurred."):
        super().__init__(
            message=message,
            error_code=ErrorCode.DB_ERROR,
            status_code=500,
        )


class RateLimitError(AppError):
    """Rate limit exceeded (429)."""

    def __init__(
        self,
        message: str = "Too many requests. Please try again later.",
        retry_after_seconds: int | None = None,
    ):
        details = None
        if retry_after_seconds:
            details = {"retry_after_seconds": retry_after_seconds}
        super().__init__(
            message=message,
            error_code=ErrorCode.RATE_LIMITED,
            status_code=429,
            details=details,
        )


class AuthenticationError(AppError):
    """Authentication failed (401)."""

    def __init__(
        self,
        message: str = "Authentication required.",
        error_code: ErrorCode = ErrorCode.UNAUTHORIZED,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=401,
        )


class AuthorizationError(AppError):
    """Authorization failed (403)."""

    def __init__(
        self, message: str = "You do not have permission to perform this action."
    ):
        super().__init__(
            message=message,
            error_code=ErrorCode.FORBIDDEN,
            status_code=403,
        )


class ConflictError(AppError):
    """Resource state conflict (409)."""

    def __init__(
        self, message: str = "The operation conflicts with the current resource state."
    ):
        super().__init__(
            message=message,
            error_code=ErrorCode.CONFLICT,
            status_code=409,
        )
