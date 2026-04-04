"""
Resume model.

Stores metadata about uploaded resume files.
The actual file lives in object storage (S3/local);
this table holds the path reference and parsed text cache.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.user import User


class Resume(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "resumes"

    # ── Foreign keys ─────────────────────────────────────────
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # ── File metadata ────────────────────────────────────────
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "pdf" or "docx"
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Parsed content ───────────────────────────────────────
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_sections: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON string of identified sections (experience, education, etc.)

    # ── Usage tracking ───────────────────────────────────────
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="resumes")
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis", back_populates="resume", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Resume {self.original_filename}>"
