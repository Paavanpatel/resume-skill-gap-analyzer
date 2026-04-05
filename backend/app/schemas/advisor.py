"""
Resume advisor schemas for section rewrite responses.
"""

from pydantic import BaseModel


class SectionRewriteResponse(BaseModel):
    """A rewritten resume section."""

    section: str
    original: str
    rewritten: str
    changes_made: list[str] = []
    confidence: float = 0.0


class AdvisorResponse(BaseModel):
    """Full resume advisor output."""

    rewrites: list[SectionRewriteResponse] = []
    overall_summary: str = ""
