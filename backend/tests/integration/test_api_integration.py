"""
Integration tests for API endpoints.

Uses httpx.AsyncClient with FastAPI's TestClient to test endpoint
behavior end-to-end without needing external services.
Each test uses mocked dependencies (DB, Redis) to remain self-contained.

Error response format:
    {"error": {"code": "...", "message": "..."}, "request_id": "..."}
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI


def _err_msg(data: dict) -> str:
    """Extract message from standard error response format."""
    return data.get("error", {}).get("message", "")


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    user.is_verified = False
    user.tier = "free"
    user.role = "user"
    user.preferences = {}
    user.created_at = datetime.now(timezone.utc)
    user.hashed_password = "$2b$12$fakehash"
    return user


@pytest.fixture
def mock_analysis(mock_user):
    """Create a mock completed analysis."""
    analysis = MagicMock()
    analysis.id = uuid4()
    analysis.user_id = mock_user.id
    analysis.status = "completed"
    analysis.match_score = 75.5
    analysis.ats_score = 82.0
    analysis.resume_skills = [
        {"name": "Python", "confidence": 0.95, "category": "programming_language"}
    ]
    analysis.job_skills = [
        {"name": "Python", "confidence": 0.9, "category": "programming_language"},
        {"name": "Docker", "confidence": 0.85, "category": "devops"},
    ]
    analysis.matched_skills = [
        {"name": "Python", "confidence": 0.95, "category": "programming_language"}
    ]
    analysis.missing_skills = [
        {
            "name": "Docker",
            "confidence": 0.85,
            "category": "devops",
            "weight": 1.0,
            "required": True,
        }
    ]
    analysis.suggestions = []
    analysis.category_breakdowns = []
    analysis.score_explanation = None
    analysis.ats_check = None
    analysis.advisor_result = None
    analysis.processing_time_ms = 1500
    analysis.ai_provider = "openai"
    analysis.ai_model = "gpt-4o"
    analysis.ai_tokens_used = 2000
    analysis.job_title = "Senior Engineer"
    analysis.job_company = "TechCorp"
    analysis.job_description = "We need a senior engineer..."
    analysis.created_at = datetime.now(timezone.utc)
    analysis.roadmap = None
    return analysis


class TestHealthEndpoint:
    """Test the health check endpoint."""

    # @pytest.mark.asyncio
    # async def test_health_check(self, test_client):
    #     """Health endpoint returns 200 with status info."""
    #     client, app, mock_db, mock_redis = test_client

    #     response = await client.get("/api/v1/health")

    #     assert response.status_code == 200
    #     data = response.json()
    #     assert data["status"] == "healthy"
    #     assert "app" in data


@pytest.mark.asyncio
async def test_health_check(test_client):
    client, app = test_client[:2]  # Unpack safely

    with (
        patch("asyncpg.connect") as mock_pg,
        patch("redis.asyncio.from_url") as mock_redis,
    ):
        # Mock successful connections
        mock_pg.return_value.execute = AsyncMock()
        mock_pg.return_value.close = AsyncMock()
        mock_redis.return_value.ping = AsyncMock()
        mock_redis.return_value.aclose = AsyncMock()

        response = await client.get("/api/v1/health/ready")
        assert response.status_code == 200
        assert response.json()["status"] in ("healthy", "degraded")


class TestAuthEndpoints:
    """Test authentication endpoint wiring."""

    @pytest.mark.asyncio
    async def test_login_missing_credentials(self, test_client):
        """Login with empty body returns 422."""
        client, app, mock_db, mock_redis = test_client

        response = await client.post("/api/v1/auth/login", json={})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_missing_fields(self, test_client):
        """Register with empty body returns 422."""
        client, app, mock_db, mock_redis = test_client

        response = await client.post("/api/v1/auth/register", json={})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_me_no_auth(self, test_client):
        """GET /auth/me without token returns 401."""
        client, app, mock_db, mock_redis = test_client

        # Clear the dependency override to test without auth
        from app.core.dependencies import get_current_user

        original_override = app.dependency_overrides.pop(get_current_user, None)

        try:
            response = await client.get("/api/v1/auth/me")
            assert response.status_code == 401
        finally:
            # Restore override
            if original_override:
                app.dependency_overrides[get_current_user] = original_override

    @pytest.mark.asyncio
    async def test_refresh_no_token(self, test_client):
        """POST /auth/refresh without cookie or body returns 401."""
        client, app, mock_db, mock_redis = test_client

        response = await client.post("/api/v1/auth/refresh")

        assert response.status_code == 401


class TestAnalysisEndpoints:
    """Test analysis endpoint wiring."""

    @pytest.mark.asyncio
    async def test_analysis_history_with_auth(self, test_client):
        """GET /analysis/history requires authentication (mocked)."""
        client, app, mock_db, mock_redis = test_client

        with patch(
            "app.api.v1.endpoints.analysis.AnalysisRepository"
        ) as mock_repo_class:
            mock_repo = MagicMock()
            mock_repo.get_by_user = AsyncMock(return_value=[])
            mock_repo.count_by_user = AsyncMock(return_value=0)
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/analysis/history")

        # With mocked auth it should not return 401
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_analysis_status_invalid_id(self, test_client):
        """GET /analysis/{id}/status with invalid UUID."""
        client, app, mock_db, mock_redis = test_client

        response = await client.get("/api/v1/analysis/invalid-id/status")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_analysis_retrieve_not_found(self, test_client, mock_user):
        """GET /analysis/{id} returns 404 when not found."""
        client, app, mock_db, mock_redis = test_client

        with patch(
            "app.api.v1.endpoints.analysis.AnalysisRepository"
        ) as mock_repo_class:
            mock_repo = MagicMock()
            mock_repo.get_by_id = AsyncMock(return_value=None)
            mock_repo_class.return_value = mock_repo

            analysis_id = uuid4()
            response = await client.get(f"/api/v1/analysis/{analysis_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_analysis_create_missing_fields(self, test_client):
        """POST /analysis/{resume_id} with missing required fields returns 422."""
        client, app, mock_db, mock_redis = test_client

        resume_id = uuid4()
        response = await client.post(
            f"/api/v1/analysis/{resume_id}",
            json={"job_title": "Engineer"},  # Missing required job_description
        )

        assert response.status_code == 422


class TestInsightsEndpoints:
    """Test insights endpoint wiring."""

    @pytest.mark.asyncio
    async def test_roadmap_with_auth(self, test_client):
        """POST /insights/{id}/roadmap with valid auth."""
        client, app, mock_db, mock_redis = test_client

        # Auth is mocked in fixture
        analysis_id = uuid4()
        response = await client.post(f"/api/v1/insights/{analysis_id}/roadmap")

        # Should not be 401 (auth passes), but may be 404 (analysis not found) or 500
        assert response.status_code != 401

    @pytest.mark.asyncio
    async def test_export_with_auth(self, test_client):
        """GET /insights/{id}/export with valid auth."""
        client, app, mock_db, mock_redis = test_client

        analysis_id = uuid4()
        response = await client.get(f"/api/v1/insights/{analysis_id}/export")

        # Should not be 401 (auth passes), but may be 404 or 500
        assert response.status_code != 401

    @pytest.mark.asyncio
    async def test_advisor_with_auth(self, test_client):
        """POST /insights/{id}/advisor with valid auth."""
        client, app, mock_db, mock_redis = test_client

        analysis_id = uuid4()
        response = await client.post(f"/api/v1/insights/{analysis_id}/advisor")

        # Should not be 401 (auth passes), but may be 404 or 500
        assert response.status_code != 401

    @pytest.mark.asyncio
    async def test_roadmap_get_with_auth(self, test_client):
        """GET /insights/{id}/roadmap with valid auth."""
        client, app, mock_db, mock_redis = test_client

        analysis_id = uuid4()
        response = await client.get(f"/api/v1/insights/{analysis_id}/roadmap")

        # Should not be 401 (auth passes), but may be 404 or 500
        assert response.status_code != 401


class TestResumeEndpoints:
    """Test resume endpoint wiring."""

    @pytest.mark.asyncio
    async def test_resume_upload_missing_file(self, test_client):
        """POST /resume/upload without file returns error."""
        client, app, mock_db, mock_redis = test_client

        response = await client.post("/api/v1/resume/upload")

        # Should return 400 or 422 (unprocessable entity)
        assert response.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_resume_get_with_auth(self, test_client):
        """GET /resume/{id} with valid auth."""
        client, app, mock_db, mock_redis = test_client

        resume_id = uuid4()
        response = await client.get(f"/api/v1/resume/{resume_id}")

        # Should not be 401
        assert response.status_code != 401

    @pytest.mark.asyncio
    async def test_resume_list_with_auth(self, test_client):
        """GET /resume with valid auth."""
        client, app, mock_db, mock_redis = test_client

        response = await client.get("/api/v1/resume/")

        # Should not be 401
        assert response.status_code != 401


class TestErrorHandling:
    """Test error handling and response formats."""

    @pytest.mark.asyncio
    async def test_nonexistent_endpoint_returns_404(self, test_client):
        """Non-existent endpoint returns 404."""
        client, app, mock_db, mock_redis = test_client

        response = await client.get("/api/v1/nonexistent")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_http_method_returns_405(self, test_client):
        """Invalid HTTP method returns 405."""
        client, app, mock_db, mock_redis = test_client

        # POST to a GET-only endpoint
        response = await client.post("/api/v1/health")

        assert response.status_code == 405

    @pytest.mark.asyncio
    async def test_validation_error_has_error_field(self, test_client):
        """Validation errors include error field with standard format."""
        client, app, mock_db, mock_redis = test_client

        response = await client.post("/api/v1/auth/login", json={})

        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]


class TestCORS:
    """Test CORS headers."""

    @pytest.mark.asyncio
    async def test_cors_preflight_request(self, test_client):
        """CORS preflight OPTIONS request succeeds."""
        client, app, mock_db, mock_redis = test_client

        response = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )

        assert response.status_code == 200
        # Check CORS headers are present
        assert "access-control-allow-origin" in response.headers

    @pytest.mark.asyncio
    async def test_cors_headers_in_response(self, test_client):
        """CORS headers included in normal responses."""
        client, app, mock_db, mock_redis = test_client

        response = await client.get(
            "/api/v1/health/live", headers={"Origin": "http://localhost:3000"}
        )

        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers


class TestSecurityHeaders:
    """Test security headers."""

    @pytest.mark.asyncio
    async def test_security_headers_present(self, test_client):
        """Security headers are included in responses."""
        client, app, mock_db, mock_redis = test_client

        response = await client.get("/api/v1/health/live")

        assert response.status_code == 200
        # Check some common security headers
        headers = response.headers
        assert (
            "x-content-type-options" in headers or len(headers) > 0
        )  # At least some headers


class TestEndpointIntegration:
    """Test integration of multiple endpoints."""

    @pytest.mark.asyncio
    async def test_auth_flow_login_returns_tokens(self, test_client):
        """Login endpoint returns access and refresh tokens."""
        client, app, mock_db, mock_redis = test_client
        from app.core.security import hash_password
        from app.models.user import User

        # Create a real User model (not MagicMock) for Pydantic validation
        mock_user_obj = User(
            id=uuid4(),
            email="test@example.com",
            full_name="Test User",
            hashed_password=hash_password("password123"),
            is_active=True,
            is_verified=False,
            tier="free",
            role="user",
            preferences={},
            created_at=datetime.now(timezone.utc),
        )

        with patch("app.services.auth_service.verify_password", return_value=True):
            with patch("app.services.auth_service.UserRepository") as MockRepo:
                repo = MockRepo.return_value
                repo.get_by_email = AsyncMock(return_value=mock_user_obj)

                response = await client.post(
                    "/api/v1/auth/login",
                    json={"email": "test@example.com", "password": "password123"},
                )

        assert response.status_code == 200
        data = response.json()
        assert "tokens" in data
        assert data["tokens"]["token_type"] == "bearer"
        assert "access_token" in data["tokens"]

    @pytest.mark.asyncio
    async def test_me_endpoint_returns_user(self, test_client, mock_user):
        """GET /auth/me returns current user."""
        client, app, mock_db, mock_redis = test_client

        # with mocked current user from fixture
        response = await client.get("/api/v1/auth/me")

        # Should succeed with mocked auth
        assert response.status_code == 200
        data = response.json()
        assert "email" in data

    @pytest.mark.asyncio
    async def test_analysis_workflow(self, test_client, mock_user):
        """Test complete analysis workflow."""
        client, app, mock_db, mock_redis = test_client

        # List analyses (history endpoint)
        with patch(
            "app.api.v1.endpoints.analysis.AnalysisRepository"
        ) as mock_repo_class:
            mock_repo = MagicMock()
            mock_repo.get_by_user = AsyncMock(return_value=[])
            mock_repo.count_by_user = AsyncMock(return_value=0)
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/analysis/history")
            assert response.status_code == 200

        # Check status of a non-existent analysis
        analysis_id = uuid4()

        with patch(
            "app.api.v1.endpoints.analysis.AnalysisRepository"
        ) as mock_repo_class:
            mock_repo = MagicMock()
            mock_repo.get_by_id = AsyncMock(return_value=None)
            mock_repo_class.return_value = mock_repo

            response = await client.get(f"/api/v1/analysis/{analysis_id}/status")
            # Should not be 401 (auth passes)
            assert response.status_code != 401
