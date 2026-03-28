"""
Usage tracking service.

Provides helpers to:
- Get the current billing period (YYYY-MM)
- Fetch a user's usage record for the current period
- Increment a feature counter
- Check whether a user is within their quota

Tier quotas:
  free       — 5 analyses / month
  pro        — 50 analyses / month
  enterprise — unlimited
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage import UsageRecord

# ── Quota definitions ─────────────────────────────────────────

TIER_ANALYSIS_QUOTA: dict[str, int] = {
    "free": 5,
    "pro": 50,
    "enterprise": 9_999,  # effectively unlimited
}


def current_period() -> str:
    """Return the current billing period as 'YYYY-MM'."""
    now = datetime.now(timezone.utc)
    return f"{now.year}-{now.month:02d}"


async def get_or_create_usage(
    user_id: str,
    period: str,
    session: AsyncSession,
) -> UsageRecord:
    """
    Fetch the UsageRecord for (user_id, period), creating it if absent.

    Uses a SELECT then INSERT pattern instead of ON CONFLICT because
    asyncpg doesn't expose PostgreSQL's INSERT … ON CONFLICT … RETURNING
    through SQLAlchemy's async ORM in a straightforward way. The unique
    constraint on (user_id, period) prevents duplicates even under
    concurrent inserts.
    """
    result = await session.execute(
        select(UsageRecord).where(
            UsageRecord.user_id == str(user_id),
            UsageRecord.period == period,
        )
    )
    record = result.scalar_one_or_none()

    if record is None:
        record = UsageRecord(
            user_id=str(user_id),
            period=period,
            analyses_count=0,
            advisor_count=0,
            export_count=0,
        )
        session.add(record)
        await session.flush()

    return record


async def check_analysis_quota(
    user_id: str,
    tier: str,
    session: AsyncSession,
) -> tuple[int, int, bool]:
    """
    Check whether the user can run another analysis.

    Returns (used, limit, within_quota).
    """
    period = current_period()
    record = await get_or_create_usage(user_id, period, session)
    limit = TIER_ANALYSIS_QUOTA.get(tier, 5)
    used = record.analyses_count
    return used, limit, used < limit


async def increment_analysis_count(
    user_id: str,
    session: AsyncSession,
) -> UsageRecord:
    """Increment the analyses_count for the current period."""
    period = current_period()
    record = await get_or_create_usage(user_id, period, session)
    record.analyses_count += 1
    return record


async def get_usage_summary(
    user_id: str,
    tier: str,
    session: AsyncSession,
) -> dict:
    """
    Return a usage summary dict for the current period.

    Shape:
      {
        "period": "2026-03",
        "analyses": { "used": 3, "limit": 5, "pct": 60 },
        "tier": "free"
      }
    """
    period = current_period()
    record = await get_or_create_usage(user_id, period, session)
    limit = TIER_ANALYSIS_QUOTA.get(tier, 5)
    used = record.analyses_count
    pct = round(used / limit * 100) if limit < 9_000 else 0

    return {
        "period": period,
        "analyses": {
            "used": used,
            "limit": limit,
            "pct": pct,
        },
        "tier": tier,
    }
