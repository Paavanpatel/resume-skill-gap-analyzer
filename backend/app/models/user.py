"""
User model.

Stores account credentials and profile information.
One user can have many resumes and analyses.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.resume import Resume
    from app.models.usage import UsageRecord


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Subscription tier ────────────────────────────────────
    # Controls rate limits, priority queues, and feature access.
    # "free" = default, "pro" = paid, "enterprise" = custom limits.
    # Even in MVP, having this column avoids a migration later.
    tier: Mapped[str] = mapped_column(
        String(20), default="free", nullable=False
    )  # free | pro | enterprise

    # ── Role-based access ────────────────────────────────────
    # Controls admin dashboard access and privileged operations.
    # "user" = default, "admin" = dashboard access, "super_admin" = full control.
    role: Mapped[str] = mapped_column(
        String(20), default="user", nullable=False, server_default="user"
    )  # user | admin | super_admin

    # ── User preferences (JSONB) ─────────────────────────────
    # Flexible blob for UI/app preferences. Keys added here without migrations.
    # Expected shape: { theme, email_notifications, ai_provider, ... }
    preferences: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    # ── Stripe customer ID ────────────────────────────────────
    # Set when the user first initiates a checkout session.
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True
    )

    # ── Relationships ────────────────────────────────────────
    resumes: Mapped[list["Resume"]] = relationship(
        "Resume", back_populates="user", cascade="all, delete-orphan"
    )
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis", back_populates="user", cascade="all, delete-orphan"
    )
    usage_records: Mapped[list["UsageRecord"]] = relationship(
        "UsageRecord", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"
