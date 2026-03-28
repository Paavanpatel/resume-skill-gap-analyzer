"""
Structured logging configuration using structlog.

Produces JSON logs in production for machine parsing (ELK, Datadog, etc.)
and human-readable colored output in development.

Request-scoped context (request_id, path, method) is injected by
RequestIdMiddleware via structlog.contextvars.bind_contextvars() so every
log line emitted during a request automatically carries that context without
passing it through the call stack manually.
"""

import logging
import sys

import structlog

from app.core.config import get_settings


def configure_logging() -> None:
    """Set up structlog + stdlib logging integration, including the log buffer."""
    settings = get_settings()
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    is_production = settings.app_env == "production"

    # Shared processors for both structlog-native and stdlib-routed records
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if is_production:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
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

    # ProcessorFormatter bridges structlog's context/processors to stdlib handlers
    formatter = structlog.stdlib.ProcessorFormatter(
        # foreign_pre_chain handles records from stdlib loggers (uvicorn, SQLAlchemy…)
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(stream_handler)
    root_logger.setLevel(log_level)

    # Attach the in-memory log buffer handler (plain, no formatter needed —
    # _LogBufferHandler.emit() builds its own dict rather than using format())
    from app.core.log_buffer import LogBuffer
    root_logger.addHandler(LogBuffer.make_handler())

    # Quiet noisy third-party loggers
    for name in ("uvicorn.access", "sqlalchemy.engine", "celery"):
        logging.getLogger(name).setLevel(logging.WARNING)
