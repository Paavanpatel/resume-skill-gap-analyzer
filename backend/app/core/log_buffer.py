"""
In-memory circular log buffer for the admin log viewer.

Captures the last N structured log records so the admin UI can display
recent application logs without requiring an external log aggregation
service (ELK, CloudWatch, etc.).

Usage in logging_config.py:
    from app.core.log_buffer import LogBuffer, LOG_BUFFER
    handler = LogBuffer.make_handler()
    logging.getLogger().addHandler(handler)

Limitations:
- Memory-only; cleared on restart
- Single-process; Celery workers have their own buffer
- No persistence; not a replacement for production log shipping
"""

import logging
import threading
import time
from collections import deque
from typing import Any

# Maximum number of records to keep in memory
_MAX_RECORDS = 500


class _LogBufferHandler(logging.Handler):
    """
    A logging.Handler that appends formatted records to a shared deque.

    Uses a lock so concurrent request-handling threads don't corrupt the buffer.
    Level is set to DEBUG so all records are captured; callers can filter
    by level when reading.
    """

    def __init__(self, buffer: "deque[dict[str, Any]]", lock: threading.Lock) -> None:
        super().__init__(level=logging.DEBUG)
        self._buffer = buffer
        self._lock = lock

    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry: dict[str, Any] = {
                "ts": time.time(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
            # Capture request_id if structlog bound it (appears as an extra attr)
            if hasattr(record, "request_id"):
                entry["request_id"] = record.request_id  # type: ignore[attr-defined]
            if record.exc_info:
                entry["exc"] = self.formatException(record.exc_info)
            with self._lock:
                self._buffer.append(entry)
        except Exception:
            self.handleError(record)


class LogBuffer:
    """Singleton facade over the shared circular buffer."""

    _buffer: deque[dict[str, Any]] = deque(maxlen=_MAX_RECORDS)
    _lock: threading.Lock = threading.Lock()
    _handler: _LogBufferHandler | None = None

    @classmethod
    def make_handler(cls) -> logging.Handler:
        """Return the singleton handler; create it on first call."""
        if cls._handler is None:
            cls._handler = _LogBufferHandler(cls._buffer, cls._lock)
        return cls._handler

    @classmethod
    def get_records(
        cls,
        limit: int = 100,
        level: str | None = None,
        logger_prefix: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Return the most-recent *limit* records, newest last.

        Args:
            limit: Maximum number of records to return (capped at _MAX_RECORDS).
            level: If set, only return records at this level or above.
                   Accepts 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'.
            logger_prefix: If set, only return records from loggers whose name
                           starts with this prefix (e.g. 'app' for app.* loggers).
        """
        level_map = {
            "DEBUG": 10,
            "INFO": 20,
            "WARNING": 30,
            "ERROR": 40,
            "CRITICAL": 50,
        }
        min_level_num = level_map.get((level or "").upper(), 0)

        with cls._lock:
            records = list(cls._buffer)

        if min_level_num:
            records = [
                r for r in records if level_map.get(r["level"], 0) >= min_level_num
            ]
        if logger_prefix:
            records = [r for r in records if r["logger"].startswith(logger_prefix)]

        return records[-min(limit, _MAX_RECORDS) :]

    @classmethod
    def clear(cls) -> None:
        with cls._lock:
            cls._buffer.clear()
