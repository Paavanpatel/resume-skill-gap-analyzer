"""
Celery task for async skill gap analysis.

When a user submits an analysis request, the API creates an Analysis record
with status='queued' and dispatches this task. The task:
1. Runs the full analysis pipeline (LLM calls, scoring)
2. Updates the Analysis record with results
3. Returns a summary for the Celery result backend

The user polls the status endpoint (or listens via WebSocket) until the
analysis transitions from 'queued' -> 'processing' -> 'completed'|'failed'.

Retry policy:
- Max 2 retries (3 total attempts) for transient errors only
- Exponential backoff: 15s, 30s (base 15s, doubles each retry, cap 120s)
- Non-retriable errors (bad input, missing resources, parse failures) fail
  immediately without retrying — retrying would never succeed and wastes time
"""

import asyncio
import logging

from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    FileUploadError,
    NotFoundError,
    ParsingError,
    ValidationError,
)
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Errors that will never succeed on retry — fail fast instead of wasting
# the retry budget (max_retries=2 means 30s of guaranteed waiting otherwise).
NON_RETRIABLE = (
    NotFoundError,
    ValidationError,
    ParsingError,
    FileUploadError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    KeyError,
    ValueError,
    PermissionError,
)


@celery_app.task(
    name="run_skill_gap_analysis",
    bind=True,
    max_retries=2,
    retry_backoff_max=120,
)
def run_skill_gap_analysis(self, analysis_id: str) -> dict:
    """
    Execute skill gap analysis as a Celery task.

    Args:
        analysis_id: UUID string of the Analysis record to process.

    Returns:
        Summary dict with status, scores, and metadata.
    """
    try:
        result = asyncio.run(_run_analysis(analysis_id))
        return result
    except NON_RETRIABLE as exc:
        # These errors are permanent — log and let the task fail immediately.
        # The analysis_service has already marked the DB record as 'failed'.
        logger.error(
            "Analysis task %s failed permanently (%s): %s",
            analysis_id,
            type(exc).__name__,
            str(exc)[:200],
        )
        raise
    except Exception as exc:
        # Transient error (network blip, LLM 500, Redis timeout) — retry
        # with exponential backoff: 15s then 30s.
        countdown = 15 * (2**self.request.retries)
        logger.warning(
            "Analysis task %s failed transiently (attempt %d/%d), retrying in %ds: %s",
            analysis_id,
            self.request.retries + 1,
            self.max_retries + 1,
            countdown,
            str(exc)[:200],
        )
        raise self.retry(exc=exc, countdown=countdown)


async def _run_analysis(analysis_id: str) -> dict:
    """Async implementation that wraps the analysis service."""
    from uuid import UUID

    import redis.asyncio as aioredis
    from app.core.config import get_settings
    from app.db.session import WriteSession
    from app.services.analysis_service import run_analysis

    settings = get_settings()

    # Connect to Redis for publishing WebSocket progress updates
    redis_client = None
    try:
        redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2.0,
        )
        await redis_client.ping()
    except Exception as e:
        logger.warning("Redis unavailable for progress publishing: %s", str(e)[:200])
        redis_client = None

    async with WriteSession() as session:
        try:
            analysis = await run_analysis(
                analysis_id=UUID(analysis_id),
                session=session,
                redis_client=redis_client,
            )
            await session.commit()

            return {
                "status": "completed",
                "analysis_id": analysis_id,
                "match_score": analysis.match_score,
                "ats_score": analysis.ats_score,
                "ai_provider": analysis.ai_provider,
                "processing_time_ms": analysis.processing_time_ms,
            }
        except Exception:
            await session.rollback()
            raise
        finally:
            if redis_client:
                await redis_client.aclose()
