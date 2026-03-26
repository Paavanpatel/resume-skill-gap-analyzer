"""
Analysis repository with analysis-specific queries.

Includes methods for fetching user history, filtering by status,
and aggregating dashboard statistics.
"""

from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.analysis import Analysis
from app.models.roadmap import Roadmap
from app.repositories.base import BaseRepository


class AnalysisRepository(BaseRepository[Analysis]):
    def __init__(self, session: AsyncSession):
        super().__init__(Analysis, session)

    async def get_by_user(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Analysis]:
        """Fetch analyses for a specific user, newest first."""
        result = await self._session.execute(
            select(Analysis)
            .where(Analysis.user_id == user_id)
            .order_by(desc(Analysis.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_user(self, user_id: UUID) -> int:
        """Count total analyses for a specific user."""
        result = await self._session.execute(
            select(func.count())
            .select_from(Analysis)
            .where(Analysis.user_id == user_id)
        )
        return result.scalar_one()

    async def get_with_roadmap(self, analysis_id: UUID) -> Analysis | None:
        """Fetch an analysis with its roadmap eagerly loaded."""
        result = await self._session.execute(
            select(Analysis)
            .options(joinedload(Analysis.roadmap))
            .where(Analysis.id == analysis_id)
        )
        return result.scalar_one_or_none()

    async def get_average_scores(self, user_id: UUID) -> dict:
        """Calculate average match and ATS scores for a user."""
        result = await self._session.execute(
            select(
                func.avg(Analysis.match_score).label("avg_match"),
                func.avg(Analysis.ats_score).label("avg_ats"),
            )
            .where(Analysis.user_id == user_id)
            .where(Analysis.status == "completed")
        )
        row = result.one()
        return {
            "average_match_score": round(float(row.avg_match), 1) if row.avg_match else None,
            "average_ats_score": round(float(row.avg_ats), 1) if row.avg_ats else None,
        }

    async def get_score_trend(self, user_id: UUID, limit: int = 10) -> list[dict]:
        """Get recent match/ATS scores for trend charting."""
        result = await self._session.execute(
            select(
                Analysis.created_at,
                Analysis.match_score,
                Analysis.ats_score,
                Analysis.job_title,
            )
            .where(Analysis.user_id == user_id)
            .where(Analysis.status == "completed")
            .order_by(desc(Analysis.created_at))
            .limit(limit)
        )
        return [
            {
                "date": str(row.created_at.date()),
                "match_score": row.match_score,
                "ats_score": row.ats_score,
                "job_title": row.job_title,
            }
            for row in result.all()
        ]
