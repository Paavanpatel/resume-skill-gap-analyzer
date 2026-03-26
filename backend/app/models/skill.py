"""
Skill taxonomy model.

The skill taxonomy is the system's knowledge base of recognized skills.
Each skill has a canonical name, category, and optional aliases
(e.g., "K8s" -> "Kubernetes", "JS" -> "JavaScript").

This table is seeded once and updated infrequently.
It is heavily read (cached in Redis in production).
"""

from sqlalchemy import Float, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Skill(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "skills"

    # ── Core fields ──────────────────────────────────────────
    name: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    category: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False
    )  # e.g., "programming_language", "framework", "devops", "soft_skill"

    # ── Aliases for fuzzy matching ───────────────────────────
    aliases: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )  # e.g., ["K8s", "kube"] for "Kubernetes"

    # ── Weight for priority ranking ─────────────────────────
    # 1.0 = standard importance, higher = more critical when missing.
    # "Python" in a Python job might be 3.0, "Jira" might be 0.5.
    # Used by the gap analyzer (Phase 6) to rank missing skills.
    weight: Mapped[float] = mapped_column(
        Float, default=1.0, nullable=False
    )

    # ── Metadata ─────────────────────────────────────────────
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Skill {self.name} ({self.category})>"
