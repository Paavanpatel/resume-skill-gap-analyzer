"""
Structured logging configuration using structlog.

Produces JSON logs in production for machine parsing (ELK, Datadog, etc.)
and human-readable colored output in development.
"""

import logging
import sys

import structlog

from app.core.config import get_settings


def configure_logging() -> None:
    """Set up structlog + stdlib logging integration."""
    settings = get_settings()
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    is_production = settings.app_env == "production"

    # Shared processors for both structlog and stdlib
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if is_production:
        # JSON output for production (machine-parseable)
        renderer = structlog.processors.JSONRenderer()
    else:
        # Pretty-print for development
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure stdlib root logger to use structlog formatting
    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Quiet noisy third-party loggers
    for name in ("uvicorn.access", "sqlalchemy.engine", "celery"):
        logging.getLogger(name).setLevel(logging.WARNING)
