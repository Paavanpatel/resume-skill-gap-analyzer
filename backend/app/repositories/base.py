"""
Base repository with generic CRUD operations.

All domain repositories inherit from this. It provides standard
create, get, list, update, and delete operations so each domain
repo only needs to add its specific queries.

Why a base class instead of per-repository duplication?
  - DRY: CRUD logic is identical across entities
  - Consistency: All repos behave the same way
  - Testability: Mock the base, test domain-specific queries separately
"""

from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic async repository with standard CRUD operations."""

    def __init__(self, model: type[ModelType], session: AsyncSession):
        self._model = model
        self._session = session

    async def create(self, **kwargs: Any) -> ModelType:
        """Create a new record and flush to get the generated ID."""
        instance = self._model(**kwargs)
        self._session.add(instance)
        await self._session.flush()
        await self._session.refresh(instance)
        return instance

    async def get_by_id(self, record_id: UUID) -> ModelType | None:
        """Fetch a single record by its primary key."""
        result = await self._session.execute(
            select(self._model).where(self._model.id == record_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        order_by: Any = None,
    ) -> list[ModelType]:
        """Fetch multiple records with pagination."""
        query = select(self._model)
        if order_by is not None:
            query = query.order_by(order_by)
        else:
            query = query.order_by(self._model.created_at.desc())
        query = query.offset(skip).limit(limit)
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def count(self) -> int:
        """Count total records in the table."""
        result = await self._session.execute(
            select(func.count()).select_from(self._model)
        )
        return result.scalar_one()

    async def update(self, record_id: UUID, **kwargs: Any) -> ModelType | None:
        """Update an existing record by ID. Returns None if not found."""
        instance = await self.get_by_id(record_id)
        if instance is None:
            return None
        for key, value in kwargs.items():
            if hasattr(instance, key):
                setattr(instance, key, value)
        await self._session.flush()
        await self._session.refresh(instance)
        return instance

    async def delete(self, record_id: UUID) -> bool:
        """Delete a record by ID. Returns True if deleted, False if not found."""
        instance = await self.get_by_id(record_id)
        if instance is None:
            return False
        await self._session.delete(instance)
        await self._session.flush()
        return True
