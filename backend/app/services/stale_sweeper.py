"""Stale job sweeper -- marks ghost analyses as failed.

Analyses can get stuck in 'queued' or 'processing' status if:
- Celery worker crashes mid-task
- Redis broker loses the message
- Worker OOM-killed during LLM call

This sweeper runs periodically (via Celery beat or cron) to clean up.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis import Analysis

logger = logging.getLogger(__name__)

STALE_THRESHOLD_MINUTES = 30


async def sweep_stale_analyses(session: AsyncSession) -> int:
    """
    Mark analyses stuck in queued/processing for >30 minutes as failed.

    Args:
        session: Active database session.

    Returns:
        The number of analyses marked as failed.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=STALE_THRESHOLD_MINUTES)

    result = await session.execute(
        update(Analysis)
        .where(
            Analysis.status.in_(["queued", "processing"]),
            Analysis.created_at < cutoff,
        )
        .values(
            status="failed",
            error_message=f"Analysis timed out after {STALE_THRESHOLD_MINUTES} minutes. "
                          "The worker may have crashed. Please try again.",
        )
        .returning(Analysis.id)
    )

    stale_ids = list(result.scalars().all())
    await session.commit()

    if stale_ids:
        logger.warning(
            "Swept %d stale analyses: %s",
            len(stale_ids),
            [str(sid) for sid in stale_ids],
        )

    return len(stale_ids)
