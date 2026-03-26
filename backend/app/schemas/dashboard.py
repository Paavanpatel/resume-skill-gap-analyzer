"""
Dashboard schemas for analytics and aggregated stats.
"""

from pydantic import BaseModel


class SkillCategoryBreakdown(BaseModel):
    """Skill count per category across all user analyses."""
    category: str
    matched_count: int
    missing_count: int


class DashboardStatsResponse(BaseModel):
    """Aggregated analytics for the user dashboard."""
    total_analyses: int
    average_match_score: float | None
    average_ats_score: float | None
    top_missing_skills: list[dict]  # [{"name": "Docker", "count": 5}, ...]
    top_matched_skills: list[dict]  # [{"name": "Python", "count": 12}, ...]
    skill_categories: list[SkillCategoryBreakdown]
    score_trend: list[dict]  # [{"date": "2026-03-01", "match_score": 68, "ats_score": 72}, ...]
