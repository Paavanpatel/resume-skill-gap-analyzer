"""
Shared fixtures for integration tests.

Provides:
- Mock database session with SQLAlchemy behavior
- Mock Redis client
- Test FastAPI app with overridden dependencies
- Mock user for authenticated requests
- Async HTTP client for making test requests
"""

import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
import redis.asyncio as aioredis
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import create_app
from app.core.dependencies import get_current_user, get_db_session, get_redis
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token


@pytest.fixture
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def mock_db_session() -> AsyncMock:
    """
    Create a mock AsyncSession that simulates SQLAlchemy behavior.

    The mock includes:
    - Commit/rollback/close methods
    - Query execution (execute returns an AsyncMock)
    - Flush for ID generation
    """
    mock_session = AsyncMock(spec=AsyncSession)

    # Set up basic methods
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.merge = AsyncMock()

    # Execute method returns an AsyncMock that can be chained
    mock_execute = AsyncMock()
    mock_execute.scalar_one_or_none = MagicMock(return_value=None)
    mock_execute.scalar = MagicMock(return_value=None)
    mock_execute.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

    mock_session.execute = AsyncMock(return_value=mock_execute)

    return mock_session


@pytest.fixture
async def mock_redis() -> Optional[AsyncMock]:
    """
    Create a mock Redis client for testing.

    Returns None to simulate Redis unavailability, or an AsyncMock
    that can be configured per test.
    """
    mock_redis = AsyncMock(spec=aioredis.Redis)
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock()
    mock_redis.setex = AsyncMock()
    mock_redis.delete = AsyncMock()
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.expire = AsyncMock()
    mock_redis.incr = AsyncMock(return_value=1)
    mock_redis.decr = AsyncMock(return_value=0)
    mock_redis.exists = AsyncMock(return_value=False)

    return mock_redis


@pytest.fixture
async def mock_user() -> User:
    """
    Create a mock user for authenticated requests.

    This is a User model instance with typical attributes.
    """
    user = User(
        id=uuid4(),
        email="test@example.com",
        full_name="Test User",
        hashed_password="hashed_password",
        is_active=True,
        is_verified=False,
        tier="free",
        role="user",
        preferences={},
        created_at=datetime.now(timezone.utc),
    )
    return user


@pytest.fixture
async def mock_current_user(mock_user: User):
    """
    Create a dependency override for get_current_user.

    Returns the mock user to authenticated endpoints.
    """
    async def _get_current_user():
        return mock_user

    return _get_current_user


@pytest.fixture
async def test_client(
    mock_db_session: AsyncMock,
    mock_redis: AsyncMock,
    mock_current_user,
):
    """
    Create a test FastAPI app with overridden dependencies.

    Replaces:
    - get_db_session with mock_db_session
    - get_redis with mock_redis
    - get_current_user with mock_current_user

    Returns an httpx.AsyncClient for making test requests.
    """
    import httpx
    from app.core.dependencies import get_current_user
    from app.db.session import get_db_session, get_read_db_session
    from app.core.dependencies import get_redis

    app = create_app()

    # Override dependencies
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_read_db_session] = lambda: mock_db_session
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_current_user] = mock_current_user

    # Create async HTTP client
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client, app, mock_db_session, mock_redis

    # Cleanup
    app.dependency_overrides.clear()


@pytest.fixture
async def access_token(mock_user: User) -> str:
    """
    Generate a valid JWT access token for the mock user.

    Used for Authorization header in requests.
    """
    return create_access_token(user_id=mock_user.id, email=mock_user.email)


@pytest.fixture
async def refresh_token(mock_user: User) -> str:
    """
    Generate a valid JWT refresh token for the mock user.

    Used for cookie-based token refresh.
    """
    return create_refresh_token(user_id=mock_user.id)


@pytest.fixture
def mock_user_response() -> dict:
    """Create a typical user response payload for assertions."""
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "email": "test@example.com",
        "full_name": "Test User",
        "is_active": True,
        "is_verified": False,
        "tier": "free",
    }


@pytest.fixture
def mock_analysis_response() -> dict:
    """Create a typical analysis response payload."""
    return {
        "id": "00000000-0000-0000-0000-000000000002",
        "status": "completed",
        "match_score": 75.5,
        "ats_score": 82.0,
        "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
        "missing_skills": ["Kubernetes", "Docker"],
        "resume_skills": ["Python", "FastAPI", "PostgreSQL", "Git"],
        "job_skills": ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "Docker"],
        "suggestions": ["Learn Kubernetes basics"],
        "category_breakdowns": [
            {"category": "Backend", "coverage": 90.0}
        ],
        "score_explanation": "Good match overall",
        "ats_check": {"passes": 4, "fails": 1},
        "processing_time_ms": 5000,
        "ai_provider": "openai",
        "ai_model": "gpt-4o",
        "ai_tokens_used": 2500,
        "created_at": "2024-03-18T12:00:00Z",
    }


@pytest.fixture
def mock_resume_response() -> dict:
    """Create a typical resume response payload."""
    return {
        "id": "00000000-0000-0000-0000-000000000003",
        "original_filename": "resume.pdf",
        "raw_text": "Senior Python Developer with 5 years experience...",
        "parsed_sections": {
            "summary": "Senior Python Developer",
            "experience": [
                {
                    "title": "Senior Developer",
                    "company": "TechCorp",
                    "duration": "2020-2024",
                }
            ],
            "skills": ["Python", "FastAPI", "PostgreSQL", "Git"],
        },
        "word_count": 150,
    }
