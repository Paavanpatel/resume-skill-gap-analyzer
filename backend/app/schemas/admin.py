"""
Admin schemas for request/response validation.

Covers user management, analytics, and analysis listing endpoints.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── User management schemas ──────────────────────────────────

class AdminUserUpdate(BaseModel):
    """PATCH /admin/users/{id} — admin updates tier, role, or active status."""
    tier: str | None = Field(None, pattern=r"^(free|pro|enterprise)$")
    role: str | None = Field(None, pattern=r"^(user|admin|super_admin)$")
    is_active: bool | None = None


class AdminUserResponse(BaseModel):
    """Extended user response for admin views."""
    id: UUID
    email: str
    full_name: str | None
    is_active: bool
    is_verified: bool
    tier: str
    role: str
    created_at: datetime
    analyses_count: int = 0

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    """Paginated user list response."""
    users: list[AdminUserResponse]
    total: int
    page: int
    page_size: int


# ── Analysis listing schemas ─────────────────────────────────

class AdminAnalysisResponse(BaseModel):
    """Analysis item for admin views."""
    id: UUID
    user_id: UUID
    user_email: str
    job_title: str | None
    job_company: str | None
    status: str
    match_score: float | None
    ats_score: float | None
    ai_provider: str | None
    ai_model: str | None
    ai_tokens_used: int | None
    processing_time_ms: int | None
    retry_count: int
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminAnalysisListResponse(BaseModel):
    """Paginated analysis list response."""
    analyses: list[AdminAnalysisResponse]
    total: int
    page: int
    page_size: int


# ── Analytics schemas ────────────────────────────────────────

class AnalyticsOverview(BaseModel):
    """KPI summary for the admin dashboard."""
    total_users: int
    active_users: int
    verified_users: int
    total_analyses: int
    completed_analyses: int
    failed_analyses: int
    avg_match_score: float | None
    avg_ats_score: float | None
    users_by_tier: dict[str, int]
    users_by_role: dict[str, int]
    analyses_by_status: dict[str, int]
    analyses_per_day: list[dict]  # [{date, count}]
    registrations_per_day: list[dict]  # [{date, count}]
