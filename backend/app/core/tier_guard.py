"""
Tier-based access control dependencies.

Usage in endpoints:

    # Require pro tier or higher
    @router.post("/roadmap")
    async def generate(user: CurrentUser, _: None = Depends(require_tier("pro"))):
        ...

    # Block when free quota is exhausted (used before analysis submit)
    @router.post("/analysis/{resume_id}")
    async def submit(user: CurrentUser, session=Depends(get_db_session)):
        await enforce_analysis_quota(user, session)
        ...
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.core.exceptions import ErrorCode, AppError
from app.models.user import User

# ── Tier ordering ─────────────────────────────────────────────
_TIER_RANK: dict[str, int] = {"free": 0, "pro": 1, "enterprise": 2}


def _rank(tier: str) -> int:
    return _TIER_RANK.get(tier, 0)


class TierRequiredError(AppError):
    """User's tier is below the required minimum (403)."""

    def __init__(self, required: str, current: str):
        super().__init__(
            message=(
                f"This feature requires a {required.capitalize()} plan. "
                f"Your current plan is {current.capitalize()}."
            ),
            error_code=ErrorCode.FORBIDDEN,
            status_code=403,
            details={"required_tier": required, "current_tier": current},
        )


class QuotaExceededError(AppError):
    """Monthly quota exhausted (429)."""

    def __init__(self, used: int, limit: int, tier: str):
        super().__init__(
            message=(
                f"You have used {used}/{limit} analyses this month. "
                f"Upgrade to Pro for higher limits."
            ),
            error_code=ErrorCode.QUOTA_EXCEEDED,
            status_code=429,
            details={"used": used, "limit": limit, "tier": tier},
        )


def require_tier(minimum: str):
    """
    FastAPI dependency factory. Returns a dependency that raises 403
    if the authenticated user's tier is below `minimum`.

    Example:
        @router.post("/advisor")
        async def advisor(user: CurrentUser, _=Depends(require_tier("pro"))):
    """

    async def _check(user: CurrentUser) -> None:
        if _rank(user.tier) < _rank(minimum):
            raise TierRequiredError(required=minimum, current=user.tier)

    return _check


async def enforce_analysis_quota(
    user: User,
    session: AsyncSession,
) -> None:
    """
    Check whether the user is within their monthly analysis quota.
    Raises QuotaExceededError (429) if the quota is exhausted.

    Call this inside the submit_analysis endpoint before creating the record.
    """
    from app.services.usage_service import check_analysis_quota

    used, limit, within = await check_analysis_quota(
        user_id=str(user.id),
        tier=user.tier,
        session=session,
    )
    if not within:
        raise QuotaExceededError(used=used, limit=limit, tier=user.tier)
