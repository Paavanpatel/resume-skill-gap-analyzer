"""
Global exception handlers registered on the FastAPI app.

These catch exceptions at the top level and convert them to the
standard ErrorResponse JSON shape. This means:
- Route handlers never need to construct HTTPException manually
- Services just raise AppError subclasses
- The frontend always gets the same JSON structure
- Internal details (stack traces, DB errors) never leak to the client

The handlers are ordered from most specific to least specific:
1. AppError (our known errors) -> appropriate status code + error body
2. RequestValidationError (Pydantic/FastAPI validation) -> 422
3. Exception (unexpected bugs) -> generic 500
"""

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.exceptions import (
    AppError,
    DatabaseError,
    ErrorCode,
    ErrorDetail,
    ErrorResponse,
)

logger = logging.getLogger(__name__)


def _get_request_id(request: Request) -> str:
    """
    Get or generate a request ID for tracing.

    If the client sends an X-Request-ID header (common in microservice
    architectures), we use that. Otherwise we generate one. This ID
    appears in every error response and every log line, making it easy
    to trace a failed request through the entire system.
    """
    return request.headers.get("X-Request-ID", uuid.uuid4().hex[:16])


def _build_error_response(
    error_code: ErrorCode | str,
    message: str,
    status_code: int,
    request_id: str,
    details: dict | None = None,
) -> JSONResponse:
    """Build a consistent JSON error response."""
    code = error_code.value if isinstance(error_code, ErrorCode) else error_code
    body = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
            details=details,
        ),
        request_id=request_id,
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(exclude_none=True),
    )


def register_error_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI app."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        """
        Handle all known application errors.

        These are errors we anticipated and wrapped in AppError subclasses.
        We log them at WARNING level (they're expected, not bugs) and return
        the error details to the client.
        """
        request_id = _get_request_id(request)
        logger.warning(
            "AppError [%s] %s: %s (request_id=%s)",
            exc.status_code,
            exc.error_code.value,
            exc.message,
            request_id,
        )
        return _build_error_response(
            error_code=exc.error_code,
            message=exc.message,
            status_code=exc.status_code,
            request_id=request_id,
            details=exc.details,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """
        Handle Pydantic/FastAPI request validation errors.

        These fire when query params, path params, or request bodies
        don't match the expected schema. We reformat them into our
        standard error shape so the frontend doesn't need to parse
        FastAPI's default validation error format.
        """
        request_id = _get_request_id(request)

        # Simplify Pydantic's verbose error list into something readable
        field_errors = {}
        for error in exc.errors():
            field = " -> ".join(str(loc) for loc in error["loc"])
            field_errors[field] = error["msg"]

        logger.info(
            "Validation error on %s %s: %s (request_id=%s)",
            request.method,
            request.url.path,
            field_errors,
            request_id,
        )

        return _build_error_response(
            error_code=ErrorCode.VALIDATION_ERROR,
            message="Request validation failed. Check the 'details' field for specifics.",
            status_code=422,
            request_id=request_id,
            details={"fields": field_errors},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(
        request: Request, exc: IntegrityError
    ) -> JSONResponse:
        """
        Handle database integrity constraint violations.

        Common causes: duplicate unique key, foreign key violation.
        We catch these separately from generic SQLAlchemy errors because
        they're often caused by user input (e.g., duplicate email) rather
        than actual bugs.
        """
        request_id = _get_request_id(request)
        logger.warning(
            "Database integrity error on %s %s: %s (request_id=%s)",
            request.method,
            request.url.path,
            str(exc.orig)[:200],  # Truncate to avoid leaking full SQL
            request_id,
        )
        return _build_error_response(
            error_code=ErrorCode.DUPLICATE_ENTRY,
            message="A record with this data already exists.",
            status_code=409,
            request_id=request_id,
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_error_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        """
        Handle unexpected database errors.

        These are bugs or infrastructure problems (connection lost,
        query timeout, etc.). We log the full error but only return
        a generic message to the client.
        """
        request_id = _get_request_id(request)
        logger.error(
            "Database error on %s %s: %s (request_id=%s)",
            request.method,
            request.url.path,
            str(exc)[:500],
            request_id,
            exc_info=True,
        )
        return _build_error_response(
            error_code=ErrorCode.DB_ERROR,
            message="A database error occurred. Please try again later.",
            status_code=500,
            request_id=request_id,
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """
        Catch-all for unexpected exceptions.

        This is the last line of defense. If we get here, it means we
        have a bug -- an exception we didn't anticipate. We log the full
        stack trace (critical for debugging) but return only a generic
        message (critical for security -- stack traces can leak DB schema,
        file paths, and other internal details).
        """
        request_id = _get_request_id(request)
        logger.error(
            "Unhandled exception on %s %s: %s (request_id=%s)",
            request.method,
            request.url.path,
            str(exc)[:500],
            request_id,
            exc_info=True,  # Includes full stack trace in the log
        )
        return _build_error_response(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="An unexpected error occurred. Please try again later.",
            status_code=500,
            request_id=request_id,
        )
