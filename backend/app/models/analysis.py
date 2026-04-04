"""
Analysis model.

Represents a single skill-gap analysis run. Stores the job description,
computed scores, matched/missing skills, and processing metadata.

The matched_skills, missing_skills, and suggestions fields use JSONB
to store variable-structure data without needing extra join tables.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.resume import Resume
    from app.models.roadmap import Roadmap
    from app.models.user import User


class Analysis(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "analyses"

    # ── Foreign keys ─────────────────────────────────────────
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    resume_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # ── Input ────────────────────────────────────────────────
    job_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    job_company: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Status ───────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20), default="queued", nullable=False, index=True
    )  # queued | processing | completed | failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── AI provider tracking ────────────────────────────────
    # Records which LLM provider was used for this analysis.
    # Critical for debugging score differences and cost tracking.
    ai_provider: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # e.g., "openai", "anthropic", "openai_fallback"
    ai_model: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., "gpt-4o", "claude-sonnet-4-20250514"
    ai_tokens_used: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # total tokens consumed (input + output) for cost tracking

    # ── Scores ───────────────────────────────────────────────
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ats_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Skill data (JSONB for flexibility) ───────────────────
    # Stores: [{"name": "Python", "confidence": 0.95, "category": "programming_language"}, ...]
    resume_skills: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    job_skills: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    matched_skills: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    missing_skills: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Resume suggestions (JSONB) ───────────────────────────
    # Stores: [{"section": "experience", "current": "...", "suggested": "...", "reason": "..."}, ...]
    suggestions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Phase 6: Gap analysis data (JSONB) ─────────────────
    # Category-level breakdown of skill gaps
    category_breakdowns: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Human-readable score explanation with strengths/weaknesses
    score_explanation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # ATS formatting check results (structural, not skill-based)
    ats_check: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Phase 9: Advisor output (JSONB) ───────────────────────
    # Resume section rewrites: [{"section": "summary", "original": "...", "rewritten": "...", ...}]
    advisor_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ── Relationships ────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="analyses")
    resume: Mapped["Resume"] = relationship("Resume", back_populates="analyses")
    roadmap: Mapped["Roadmap | None"] = relationship(
        "Roadmap", back_populates="analysis", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Analysis {self.id} status={self.status} score={self.match_score}>"
