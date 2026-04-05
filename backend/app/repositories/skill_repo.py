"""
Skill taxonomy repository.

Handles queries against the skills table, including
alias-aware searching and category filtering.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skill import Skill
from app.repositories.base import BaseRepository


class SkillRepository(BaseRepository[Skill]):
    def __init__(self, session: AsyncSession):
        super().__init__(Skill, session)

    async def get_by_name(self, name: str) -> Skill | None:
        """Find a skill by its exact canonical name (case-insensitive)."""
        result = await self._session.execute(
            select(Skill).where(func.lower(Skill.name) == name.lower())
        )
        return result.scalar_one_or_none()

    async def search(self, query: str, limit: int = 20) -> list[Skill]:
        """Search skills by name or alias (partial match, case-insensitive)."""
        pattern = f"%{query.lower()}%"
        result = await self._session.execute(
            select(Skill)
            .where(
                or_(
                    func.lower(Skill.name).like(pattern),
                    Skill.aliases.any(query.lower()),  # exact alias match
                )
            )
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_category(self, category: str) -> list[Skill]:
        """Fetch all skills in a specific category."""
        result = await self._session.execute(
            select(Skill).where(Skill.category == category).order_by(Skill.name)
        )
        return list(result.scalars().all())

    async def get_all_names(self) -> list[str]:
        """Fetch all skill names for fast keyword matching.
        This result should be cached in Redis (TTL: 1 hour).
        """
        result = await self._session.execute(select(Skill.name))
        return list(result.scalars().all())

    async def bulk_create(self, skills: list[dict]) -> int:
        """Insert multiple skills at once. Returns count of inserted rows."""
        instances = [Skill(**s) for s in skills]
        self._session.add_all(instances)
        await self._session.flush()
        return len(instances)
