"""
Database session management.

Provides SQLAlchemy async engine and session factory.
The get_db_session dependency yields a session per request
and ensures it is closed when the request completes.

Read/write splitting:
  - In development: both point to the same instance.
  - In production: pass a separate DATABASE_READ_URL env var.

Celery compatibility:
  Celery uses fork-based workers (prefork pool). Async engines created in the
  parent process hold connections tied to the parent's event loop, which is dead
  after fork. The `reinitialize_engines()` function disposes stale pools and
  creates fresh engines — call it from Celery's `worker_process_init` signal.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()


def _create_write_engine():
    return create_async_engine(
        settings.async_database_url,
        echo=settings.debug,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )


def _create_read_engine():
    return create_async_engine(
        settings.async_database_url,
        echo=settings.debug,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )


# ── Write engine (Primary) ───────────────────────────────────
write_engine = _create_write_engine()

# ── Read engine (Replica - same as write in dev) ─────────────
read_engine = _create_read_engine()

# ── Session factories ────────────────────────────────────────
WriteSession = async_sessionmaker(
    bind=write_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

ReadSession = async_sessionmaker(
    bind=read_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def reinitialize_engines() -> None:
    """
    Dispose stale connection pools and create fresh engines.

    Must be called after a process fork (e.g. in Celery worker_process_init)
    because asyncpg connections from the parent process are bound to the
    parent's (now-closed) event loop and cannot be reused in the child.
    """
    global write_engine, read_engine, WriteSession, ReadSession

    # Dispose the inherited pools — this is sync-safe and won't
    # touch the (dead) event loop; it just marks connections for cleanup.
    write_engine.dispose()
    read_engine.dispose()

    # Create brand-new engines with their own connection pools
    write_engine = _create_write_engine()
    read_engine = _create_read_engine()

    # Rebind session factories to the new engines
    WriteSession = async_sessionmaker(
        bind=write_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    ReadSession = async_sessionmaker(
        bind=read_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


# ── FastAPI dependencies ─────────────────────────────────────
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields a write session. Use for create/update/delete operations."""
    async with WriteSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_read_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields a read-only session. Use for queries and dashboard stats."""
    async with ReadSession() as session:
        try:
            yield session
        finally:
            await session.close()
