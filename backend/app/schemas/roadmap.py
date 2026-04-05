"""
Roadmap schemas for learning path responses.
"""

from uuid import UUID

from pydantic import BaseModel


class RoadmapPhase(BaseModel):
    """A single phase (week range) in the learning roadmap."""

    week_range: str
    focus: str
    objectives: list[str]
    resources: list[str]


class RoadmapResponse(BaseModel):
    """Full learning roadmap for a completed analysis."""

    id: UUID
    analysis_id: UUID
    total_weeks: int
    phases: list[RoadmapPhase]

    model_config = {"from_attributes": True}
