"""Admin endpoints for maintenance operations.

These endpoints require admin privileges and trigger housekeeping tasks
like sweeping stale analyses that are stuck in processing.

Endpoints:
  POST /admin/sweep-stale  -- Sweep and mark analyses stuck >30 minutes as failed
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.user import User
from app.core.dependencies import get_current_user
from app.services.stale_sweeper import sweep_stale_analyses

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post(
    "/sweep-stale",
    response_model=dict,
    summary="Sweep stale analyses",
)
async def sweep_stale_analyses_endpoint(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Manually trigger the stale analysis sweeper.

    Finds analyses stuck in 'queued' or 'processing' status for more than
    30 minutes and marks them as 'failed' with an error message. This helps
    recover from worker crashes or hung tasks.

    This endpoint is admin-only. In the future, we can add role-based checks
    like `if user.role != 'admin': raise HTTPException(403)`.

    Returns:
        Dict with swept count and timestamp.
    """
    # TODO: Add proper admin role check when user roles are implemented
    # For now, any authenticated user can call this endpoint for testing
    # In production, add: if user.role != 'admin': raise HTTPException(status_code=403)

    try:
        swept_count = await sweep_stale_analyses(session)

        return {
            "swept_count": swept_count,
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"Marked {swept_count} stale analyses as failed.",
        }
    except Exception as e:
        logger.error("Stale sweep failed: %s", str(e)[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stale sweep failed: {str(e)[:100]}",
        )
