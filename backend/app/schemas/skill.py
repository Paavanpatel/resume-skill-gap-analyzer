"""
Skill schemas for taxonomy and extracted skills.
"""

from uuid import UUID

from pydantic import BaseModel, Field


class SkillBase(BaseModel):
    """Core skill representation used across the API."""
    name: str
    category: str


class SkillTaxonomyResponse(BaseModel):
    """A skill from the taxonomy database."""
    id: UUID
    name: str
    category: str
    weight: float = 1.0
    aliases: list[str] | None = None
    description: str | None = None

    model_config = {"from_attributes": True}


class ExtractedSkill(BaseModel):
    """A skill extracted from a resume or job description."""
    name: str
    confidence: float = Field(ge=0.0, le=1.0)
    category: str
    source: str = "resume"  # "resume" or "job_description"


class MissingSkill(BaseModel):
    """A skill present in the job description but missing from the resume."""
    name: str
    priority: str  # "high", "medium", "low"
    category: str
    weight: float = 1.0  # inherited from taxonomy, used for priority ranking


class SkillTaxonomyListResponse(BaseModel):
    """Paginated list of skills from the taxonomy."""
    skills: list[SkillTaxonomyResponse]
    total: int
    page: int
    per_page: int
