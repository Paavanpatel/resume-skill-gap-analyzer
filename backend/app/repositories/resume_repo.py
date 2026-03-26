"""
Resume repository with resume-specific queries.
"""

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume import Resume
from app.repositories.base import BaseRepository


class ResumeRepository(BaseRepository[Resume]):
    def __init__(self, session: AsyncSession):
        super().__init__(Resume, session)

    async def get_by_user(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Resume]:
        """Fetch resumes for a specific user, newest first."""
        result = await self._session.execute(
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(desc(Resume.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_latest_by_user(self, user_id: UUID) -> Resume | None:
        """Fetch the most recently uploaded resume for a user."""
        result = await self._session.execute(
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(desc(Resume.created_at))
            .limit(1)
        )
        return result.scalar_one_or_none()
