"""Admin endpoints for user management, analytics, and maintenance.

All endpoints require admin or super_admin role.

Endpoints:
  GET    /admin/users            -- Paginated user list with search/filters
  GET    /admin/users/{id}       -- Single user detail
  PATCH  /admin/users/{id}       -- Update user tier, role, or active status
  DELETE /admin/users/{id}       -- Deactivate user (soft delete)
  GET    /admin/analytics        -- KPI overview for dashboard
  GET    /admin/analyses         -- Paginated analysis listing with filters
  POST   /admin/analyses/{id}/retry   -- Retry a failed analysis
  DELETE /admin/analyses/{id}         -- Delete an analysis
  POST   /admin/sweep-stale     -- Sweep stale analyses
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.core.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.db.session import get_db_session, get_read_db_session
from app.models.analysis import Analysis
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.admin import (
    AdminAnalysisListResponse,
    AdminAnalysisResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserUpdate,
    AnalyticsOverview,
    StorageStats,
)
from app.services.stale_sweeper import sweep_stale_analyses

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# All routes require at least admin role
_admin = require_role("admin")


# ── User management ──────────────────────────────────────────


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_read_db_session),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=255),
    tier: str | None = Query(None, pattern=r"^(free|pro|enterprise)$"),
    role: str | None = Query(None, pattern=r"^(user|admin|super_admin)$"),
    is_active: bool | None = Query(None),
):
    """List users with search, tier/role/active filters, and pagination."""
    base = select(User)

    if search:
        pattern = f"%{search}%"
        base = base.where((User.email.ilike(pattern)) | (User.full_name.ilike(pattern)))
    if tier:
        base = base.where(User.tier == tier)
    if role:
        base = base.where(User.role == role)
    if is_active is not None:
        base = base.where(User.is_active == is_active)

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_q)).scalar_one()

    # Fetch page
    offset = (page - 1) * page_size
    rows = (
        (
            await session.execute(
                base.order_by(User.created_at.desc()).offset(offset).limit(page_size)
            )
        )
        .scalars()
        .all()
    )

    # Batch-fetch analysis counts
    user_ids = [u.id for u in rows]
    counts: dict[str, int] = {}
    if user_ids:
        count_rows = (
            await session.execute(
                select(Analysis.user_id, func.count())
                .where(Analysis.user_id.in_(user_ids))
                .group_by(Analysis.user_id)
            )
        ).all()
        counts = {str(uid): c for uid, c in count_rows}

    users = [
        AdminUserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_verified=u.is_verified,
            tier=u.tier,
            role=u.role,
            created_at=u.created_at,
            analyses_count=counts.get(str(u.id), 0),
        )
        for u in rows
    ]

    return AdminUserListResponse(
        users=users, total=total, page=page, page_size=page_size
    )


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: UUID,
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_read_db_session),
):
    """Get a single user's details."""
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFoundError(message="User not found.", resource_type="User")

    count = (
        await session.execute(
            select(func.count())
            .select_from(Analysis)
            .where(Analysis.user_id == user_id)
        )
    ).scalar_one()

    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        tier=user.tier,
        role=user.role,
        created_at=user.created_at,
        analyses_count=count,
    )


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: UUID,
    body: AdminUserUpdate,
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_db_session),
):
    """Update a user's tier, role, or active status."""
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFoundError(message="User not found.", resource_type="User")

    # Only super_admin can change roles
    if body.role is not None and admin.role != "super_admin":
        raise AuthorizationError(
            message="Only super admins can change user roles.",
        )

    # Prevent demoting yourself
    if body.role is not None and str(user.id) == str(admin.id):
        raise ValidationError(message="You cannot change your own role.")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise ValidationError(message="No fields to update.")

    for key, value in updates.items():
        setattr(user, key, value)
    await session.flush()
    await session.refresh(user)

    count = (
        await session.execute(
            select(func.count())
            .select_from(Analysis)
            .where(Analysis.user_id == user_id)
        )
    ).scalar_one()

    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        tier=user.tier,
        role=user.role,
        created_at=user.created_at,
        analyses_count=count,
    )


@router.delete("/users/{user_id}")
async def deactivate_user(
    user_id: UUID,
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_db_session),
):
    """Soft-delete a user by setting is_active=False."""
    if str(user_id) == str(admin.id):
        raise ValidationError(message="You cannot deactivate your own account.")

    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise NotFoundError(message="User not found.", resource_type="User")

    user.is_active = False
    await session.flush()

    return {"message": f"User {user.email} has been deactivated."}


# ── Analytics ────────────────────────────────────────────────


@router.get("/analytics", response_model=AnalyticsOverview)
async def get_analytics(
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_read_db_session),
    days: int = Query(30, ge=1, le=365),
):
    """Aggregated KPIs for the admin dashboard."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # User counts
    total_users = (
        await session.execute(select(func.count()).select_from(User))
    ).scalar_one()
    active_users = (
        await session.execute(
            select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
        )
    ).scalar_one()
    verified_users = (
        await session.execute(
            select(func.count()).select_from(User).where(User.is_verified == True)  # noqa: E712
        )
    ).scalar_one()

    # Users by tier
    tier_rows = (
        await session.execute(select(User.tier, func.count()).group_by(User.tier))
    ).all()
    users_by_tier = {tier: count for tier, count in tier_rows}

    # Users by role
    role_rows = (
        await session.execute(select(User.role, func.count()).group_by(User.role))
    ).all()
    users_by_role = {role: count for role, count in role_rows}

    # Analysis counts
    total_analyses = (
        await session.execute(select(func.count()).select_from(Analysis))
    ).scalar_one()
    completed_analyses = (
        await session.execute(
            select(func.count())
            .select_from(Analysis)
            .where(Analysis.status == "completed")
        )
    ).scalar_one()
    failed_analyses = (
        await session.execute(
            select(func.count())
            .select_from(Analysis)
            .where(Analysis.status == "failed")
        )
    ).scalar_one()

    # Analyses by status
    status_rows = (
        await session.execute(
            select(Analysis.status, func.count()).group_by(Analysis.status)
        )
    ).all()
    analyses_by_status = {status: count for status, count in status_rows}

    # Avg scores (completed only)
    score_row = (
        await session.execute(
            select(
                func.avg(Analysis.match_score),
                func.avg(Analysis.ats_score),
            ).where(Analysis.status == "completed")
        )
    ).one()
    avg_match = round(score_row[0], 1) if score_row[0] is not None else None
    avg_ats = round(score_row[1], 1) if score_row[1] is not None else None

    # Analyses per day (last N days)
    analyses_daily = (
        await session.execute(
            select(
                cast(Analysis.created_at, Date).label("date"),
                func.count().label("count"),
            )
            .where(Analysis.created_at >= since)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    analyses_per_day = [
        {"date": str(row.date), "count": row.count} for row in analyses_daily
    ]

    # Registrations per day (last N days)
    reg_daily = (
        await session.execute(
            select(
                cast(User.created_at, Date).label("date"),
                func.count().label("count"),
            )
            .where(User.created_at >= since)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    registrations_per_day = [
        {"date": str(row.date), "count": row.count} for row in reg_daily
    ]

    return AnalyticsOverview(
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        total_analyses=total_analyses,
        completed_analyses=completed_analyses,
        failed_analyses=failed_analyses,
        avg_match_score=avg_match,
        avg_ats_score=avg_ats,
        users_by_tier=users_by_tier,
        users_by_role=users_by_role,
        analyses_by_status=analyses_by_status,
        analyses_per_day=analyses_per_day,
        registrations_per_day=registrations_per_day,
    )


# ── Analysis management ──────────────────────────────────────


@router.get("/analyses", response_model=AdminAnalysisListResponse)
async def list_analyses(
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_read_db_session),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, pattern=r"^(queued|processing|completed|failed)$"),
    user_id: UUID | None = Query(None),
):
    """List all analyses with status/user filters and pagination."""
    base = select(Analysis, User.email).join(User, Analysis.user_id == User.id)

    if status:
        base = base.where(Analysis.status == status)
    if user_id:
        base = base.where(Analysis.user_id == user_id)

    # Count
    count_base = select(func.count()).select_from(Analysis)
    if status:
        count_base = count_base.where(Analysis.status == status)
    if user_id:
        count_base = count_base.where(Analysis.user_id == user_id)
    total = (await session.execute(count_base)).scalar_one()

    # Fetch page
    offset = (page - 1) * page_size
    rows = (
        await session.execute(
            base.order_by(Analysis.created_at.desc()).offset(offset).limit(page_size)
        )
    ).all()

    analyses = [
        AdminAnalysisResponse(
            id=a.id,
            user_id=a.user_id,
            user_email=email,
            job_title=a.job_title,
            job_company=a.job_company,
            status=a.status,
            match_score=a.match_score,
            ats_score=a.ats_score,
            ai_provider=a.ai_provider,
            ai_model=a.ai_model,
            ai_tokens_used=a.ai_tokens_used,
            processing_time_ms=a.processing_time_ms,
            retry_count=a.retry_count,
            error_message=a.error_message,
            created_at=a.created_at,
        )
        for a, email in rows
    ]

    return AdminAnalysisListResponse(
        analyses=analyses, total=total, page=page, page_size=page_size
    )


@router.post("/analyses/{analysis_id}/retry")
async def retry_analysis(
    analysis_id: UUID,
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_db_session),
):
    """Reset a failed analysis back to queued for re-processing."""
    result = await session.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise NotFoundError(message="Analysis not found.", resource_type="Analysis")

    if analysis.status != "failed":
        raise ValidationError(message="Only failed analyses can be retried.")

    analysis.status = "queued"
    analysis.error_message = None
    analysis.retry_count += 1
    await session.flush()

    return {"message": "Analysis re-queued.", "analysis_id": str(analysis_id)}


@router.delete("/analyses/{analysis_id}")
async def delete_analysis(
    analysis_id: UUID,
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_db_session),
):
    """Permanently delete an analysis."""
    result = await session.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise NotFoundError(message="Analysis not found.", resource_type="Analysis")

    await session.delete(analysis)
    await session.flush()

    return {"message": "Analysis deleted."}


# ── Storage stats ────────────────────────────────────────────


@router.get("/storage/stats", response_model=StorageStats)
async def get_storage_stats(
    admin: User = Depends(_admin),
):
    """Return storage backend usage statistics (file count + total bytes)."""
    from app.services.file_storage import get_storage

    storage = get_storage()
    stats = await storage.get_stats()
    return StorageStats(**stats)


# ── Maintenance ──────────────────────────────────────────────


@router.post("/sweep-stale")
async def sweep_stale_analyses_endpoint(
    admin: User = Depends(_admin),
    session: AsyncSession = Depends(get_db_session),
):
    """Sweep analyses stuck in queued/processing for >30 minutes."""
    try:
        swept_count = await sweep_stale_analyses(session)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "swept_count": swept_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Marked {swept_count} stale analyses as failed.",
    }
