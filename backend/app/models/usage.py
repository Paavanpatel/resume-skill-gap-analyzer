"""
UsageRecord model.

Tracks how many analyses a user has run in the current billing period.
One record per user per (year, month) — upserted on each analysis submit.

Why a separate table?
- Clean separation from the User model (easy to query / reset)
- Supports future per-feature usage tracking (advisor calls, export calls)
- Period is year+month so monthly resets are trivial
"""

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class UsageRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "usage_records"

    # The user this record belongs to
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Billing period: "2026-03" format (YYYY-MM)
    period: Mapped[str] = mapped_column(String(7), nullable=False)

    # Counters per feature
    analyses_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    advisor_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    export_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "period", name="uq_usage_user_period"),
    )

    # Relationship back to User (optional, for joins)
    user: Mapped["User"] = relationship("User", back_populates="usage_records")

    def __repr__(self) -> str:
        return f"<UsageRecord user={self.user_id} period={self.period} analyses={self.analyses_count}>"
