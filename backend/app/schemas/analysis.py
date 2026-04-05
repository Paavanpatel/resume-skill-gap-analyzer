"""
Analysis schemas for skill gap analysis requests and responses.

The AnalysisResponse is the main payload returned to the frontend
after an analysis completes. It contains scores, skills, and suggestions.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.skill import ExtractedSkill, MissingSkill


class AnalysisRequest(BaseModel):
    """Input for creating a new analysis. Resume file is sent as multipart."""

    job_description: str = Field(min_length=50, max_length=10000)
    job_title: str | None = Field(None, max_length=500)
    job_company: str | None = Field(None, max_length=255)


class AnalysisSubmitResponse(BaseModel):
    """Returned immediately when an analysis job is submitted (async)."""

    job_id: UUID
    status: str = "queued"
    estimated_seconds: int = 15
    status_url: str
    ws_url: str


class AnalysisStatusResponse(BaseModel):
    """Real-time progress polling response."""

    job_id: UUID
    status: str  # queued | processing | completed | failed
    progress: int = Field(ge=0, le=100)
    current_step: str | None = None
    steps: list[dict] | None = None
    error_message: str | None = None


class ResumeSuggestion(BaseModel):
    """A single resume improvement suggestion."""

    section: str
    current: str
    suggested: str
    reason: str
    priority: str | None = None
    source: str | None = None


class CategoryBreakdownResponse(BaseModel):
    """Skill gap breakdown for a single category."""

    category: str
    display_name: str
    total_job_skills: int
    matched_count: int
    missing_count: int
    match_percentage: float
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    priority: str


class ScoreExplanationResponse(BaseModel):
    """Human-readable score explanation."""

    match_score: float
    ats_score: float
    match_summary: str
    ats_summary: str
    strengths: list[str] = []
    weaknesses: list[str] = []
    overall_verdict: str


class ATSIssueResponse(BaseModel):
    """A single ATS compatibility issue."""

    severity: str
    category: str
    title: str
    description: str
    fix: str


class ATSCheckResponse(BaseModel):
    """ATS formatting check results."""

    issues: list[ATSIssueResponse] = []
    format_score: float
    passed_checks: int
    total_checks: int


class AnalysisResponse(BaseModel):
    """Full analysis result returned after completion."""

    id: UUID
    status: str
    match_score: float | None = Field(None, ge=0, le=100)
    ats_score: float | None = Field(None, ge=0, le=100)
    matched_skills: list[ExtractedSkill] = []
    missing_skills: list[MissingSkill] = []
    resume_skills: list[ExtractedSkill] = []
    job_skills: list[ExtractedSkill] = []
    suggestions: list[ResumeSuggestion] = []
    category_breakdowns: list[CategoryBreakdownResponse] = []
    score_explanation: ScoreExplanationResponse | None = None
    ats_check: ATSCheckResponse | None = None
    processing_time_ms: int | None = None
    ai_provider: str | None = None
    ai_model: str | None = None
    ai_tokens_used: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisHistoryItem(BaseModel):
    """Summary item for the analysis history list."""

    id: UUID
    job_title: str | None
    job_company: str | None
    match_score: float | None
    ats_score: float | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisHistoryResponse(BaseModel):
    """Paginated list of past analyses."""

    analyses: list[AnalysisHistoryItem]
    total: int
    page: int
    per_page: int
