"""
Roadmap model.

Stores the AI-generated learning roadmap for a specific analysis.
Each analysis has at most one roadmap (one-to-one relationship).

The phases field uses JSONB to store the week-by-week learning plan
with variable structure (different numbers of weeks, objectives, resources).
"""

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Roadmap(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "roadmaps"

    # ── Foreign keys ─────────────────────────────────────────
    analysis_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # ── Roadmap data ─────────────────────────────────────────
    total_weeks: Mapped[int] = mapped_column(Integer, nullable=False)

    # Stores: [{"week_range": "1-2", "focus": "...", "objectives": [...], "resources": [...]}, ...]
    phases: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # ── Relationships ────────────────────────────────────────
    analysis: Mapped["Analysis"] = relationship("Analysis", back_populates="roadmap")

    def __repr__(self) -> str:
        return f"<Roadmap analysis={self.analysis_id} weeks={self.total_weeks}>"
