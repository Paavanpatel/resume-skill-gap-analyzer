"""
Resume repository with resume-specific queries.
"""

from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume import Resume
from app.repositories.base import BaseRepository


class ResumeRepository(BaseRepository[Resume]):
    def __init__(self, session: AsyncSession):
        super().__init__(Resume, session)

    def _unique_resume_subquery(self, user_id: UUID):
        """Subquery that keeps only the most recent upload per filename."""
        return (
            select(
                Resume.id,
                func.row_number()
                .over(
                    partition_by=Resume.original_filename,
                    order_by=desc(Resume.created_at),
                )
                .label("rn"),
            )
            .where(Resume.user_id == user_id)
            .subquery()
        )

    async def get_by_user(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Resume]:
        """Fetch unique resumes for a user (one per filename), newest first."""
        subq = self._unique_resume_subquery(user_id)
        result = await self._session.execute(
            select(Resume)
            .join(subq, Resume.id == subq.c.id)
            .where(subq.c.rn == 1)
            .order_by(desc(Resume.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_unique_by_user(self, user_id: UUID) -> int:
        """Count unique resumes (one per filename) for a user."""
        subq = self._unique_resume_subquery(user_id)
        result = await self._session.execute(
            select(func.count()).select_from(subq).where(subq.c.rn == 1)
        )
        return result.scalar_one()

    async def get_latest_by_user(self, user_id: UUID) -> Resume | None:
        """Fetch the most recently uploaded resume for a user."""
        result = await self._session.execute(
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(desc(Resume.created_at))
            .limit(1)
        )
        return result.scalar_one_or_none()
