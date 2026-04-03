"""
Integration tests for API endpoints using httpx.AsyncClient.

Tests the following endpoints:
1. Health check: GET /api/v1/health
2. Auth register: POST /api/v1/auth/register
3. Auth login: POST /api/v1/auth/login
4. Auth me: GET /api/v1/auth/me
5. Auth refresh: POST /api/v1/auth/refresh
6. Resume upload: POST /api/v1/resume/upload
7. Analysis submit: POST /api/v1/analysis/{resume_id}
8. Protected endpoints: verify 401/403 responses

All tests use mock database and Redis dependencies.

Error response format:
    {"error": {"code": "...", "message": "..."}, "request_id": "..."}
"""

import json
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.schemas.user import UserCreate, UserLogin
from app.models.user import User
from app.core.exceptions import AuthenticationError


def _err_msg(data: dict) -> str:
    """Extract message from standard error response format."""
    return data.get("error", {}).get("message", "")


# ──────────────────────────────────────────────────────────────
# System / Health Check Tests
# ──────────────────────────────────────────────────────────────


# @pytest.mark.asyncio
# async def test_health_check(test_client):
#     """Test GET /api/v1/health returns 200 with expected fields."""
#     client, app, _, _ = test_client

#     response = await client.get("/api/v1/health")

#     assert response.status_code == 200
#     data = response.json()
#     assert data["status"] == "healthy"
#     assert "app" in data
#     assert "environment" in data

@pytest.mark.asyncio
async def test_health_check(test_client):
    """Test GET /api/v1/health redirects to /api/v1/health/ready."""
    client, app = test_client[:2]  # Unpack safely
    
    # Test the legacy /api/v1/health endpoint redirects to /api/v1/health/ready
    response = await client.get("/api/v1/health", follow_redirects=False)
    
    # Should get a 307 redirect
    assert response.status_code == 307
    assert response.headers.get("location") == "/api/v1/health/ready"
    
    # Now follow the redirect
    response = await client.get("/api/v1/health", follow_redirects=True)
    
    # After following redirect, should eventually get a response
    # (may be 200 or 503 depending on service availability, so just check it's not a redirect)
    assert response.status_code in [200, 503, 502]

        
# ──────────────────────────────────────────────────────────────
# Authentication Tests
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_success(test_client, mock_db_session):
    """Test POST /api/v1/auth/register creates a user successfully."""
    client, app, db_session, _ = test_client

    from datetime import datetime, timezone

    # Mock repository create
    new_user = User(
        id=uuid4(),
        email="newuser@example.com",
        full_name="New User",
        hashed_password="hashed",
        is_active=True,
        is_verified=False,
        tier="free",
        role="user",
        preferences={},
        created_at=datetime.now(timezone.utc),
    )
    mock_db_session.commit = AsyncMock()

    # Patch the register_user service
    with patch("app.api.v1.endpoints.auth.register_user") as mock_register:
        mock_register.return_value = new_user

        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "ValidPassword123!",
                "full_name": "New User",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(test_client):
    """Test POST /api/v1/auth/register rejects duplicate email."""
    client, app, _, _ = test_client

    with patch("app.api.v1.endpoints.auth.register_user") as mock_register:
        from app.core.exceptions import ValidationError

        mock_register.side_effect = ValidationError(
            message="Email already registered",
        )

        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "existing@example.com",
                "password": "ValidPassword123!",
                "full_name": "User",
            },
        )

    assert response.status_code == 400
    data = response.json()
    assert "Email already registered" in _err_msg(data)


@pytest.mark.asyncio
async def test_register_weak_password(test_client):
    """Test POST /api/v1/auth/register rejects weak password."""
    client, app, _, _ = test_client

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "user@example.com",
            "password": "weak",  # Too short
            "full_name": "User",
        },
    )

    # Pydantic validation should fail (422)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(test_client, mock_user, access_token):
    """Test POST /api/v1/auth/login returns tokens and user profile."""
    client, app, _, _ = test_client

    from app.schemas.user import TokenResponse

    mock_tokens = TokenResponse(
        access_token="mock_access_token",
        refresh_token="mock_refresh_token",
        token_type="bearer",
        expires_in=900,
    )

    with patch("app.api.v1.endpoints.auth.login_user") as mock_login:
        mock_login.return_value = (mock_tokens, mock_user)

        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "password123",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "tokens" in data
    assert "user" in data
    assert data["tokens"]["access_token"] == "mock_access_token"
    assert data["tokens"]["token_type"] == "bearer"
    assert data["user"]["email"] == "test@example.com"

    # Check that refresh token was set as cookie
    cookies = response.cookies
    assert "refresh_token" in cookies


@pytest.mark.asyncio
async def test_login_invalid_credentials(test_client):
    """Test POST /api/v1/auth/login rejects invalid credentials."""
    client, app, _, _ = test_client

    with patch("app.api.v1.endpoints.auth.login_user") as mock_login:
        from app.core.exceptions import AuthenticationError

        mock_login.side_effect = AuthenticationError(
            message="Invalid email or password",
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword",
            },
        )

    assert response.status_code == 401
    data = response.json()
    assert "Invalid email or password" in _err_msg(data)


@pytest.mark.asyncio
async def test_get_me_authenticated(test_client, mock_user, access_token):
    """Test GET /api/v1/auth/me returns current user when authenticated."""
    client, app, _, _ = test_client

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == mock_user.email
    assert data["full_name"] == mock_user.full_name
    assert str(data["id"]) == str(mock_user.id)


@pytest.mark.asyncio
async def test_get_me_unauthenticated(test_client):
    """Test GET /api/v1/auth/me returns 401 without token."""
    client, app, _, _ = test_client

    # Remove the auth override so real auth logic runs
    from app.core.dependencies import get_current_user
    original = app.dependency_overrides.pop(get_current_user, None)

    try:
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "Authentication required" in _err_msg(data)
    finally:
        if original:
            app.dependency_overrides[get_current_user] = original


@pytest.mark.asyncio
async def test_refresh_with_cookie(test_client, mock_user, mock_db_session):
    """Test POST /api/v1/auth/refresh exchanges refresh token for access token."""
    client, app, db_session, _ = test_client

    from app.schemas.user import TokenResponse

    new_tokens = TokenResponse(
        access_token="new_access_token",
        refresh_token="new_refresh_token",
        token_type="bearer",
        expires_in=900,
    )

    with patch("app.api.v1.endpoints.auth.refresh_tokens") as mock_refresh:
        mock_refresh.return_value = new_tokens

        # Send refresh token via cookie
        response = await client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": "refresh_token=old_refresh_token"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] == "new_access_token"
    assert data["token_type"] == "bearer"

    # Check that new refresh token was set as cookie
    cookies = response.cookies
    assert "refresh_token" in cookies


@pytest.mark.asyncio
async def test_refresh_no_token(test_client):
    """Test POST /api/v1/auth/refresh returns 401 without refresh token."""
    client, app, _, _ = test_client

    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 401
    data = response.json()
    assert "No refresh token provided" in _err_msg(data)


@pytest.mark.asyncio
async def test_refresh_invalid_token(test_client):
    """Test POST /api/v1/auth/refresh rejects invalid refresh token."""
    client, app, _, _ = test_client

    with patch("app.api.v1.endpoints.auth.refresh_tokens") as mock_refresh:
        from app.core.exceptions import AuthenticationError

        mock_refresh.side_effect = AuthenticationError(
            message="Invalid or expired refresh token",
        )

        response = await client.post(
            "/api/v1/auth/refresh",
            headers={"Cookie": "refresh_token=invalid_token"},
        )

    assert response.status_code == 401
    data = response.json()
    assert "Invalid or expired refresh token" in _err_msg(data)


@pytest.mark.asyncio
async def test_logout(test_client, mock_user, access_token):
    """Test POST /api/v1/auth/logout clears tokens."""
    client, app, _, _ = test_client

    with patch("app.api.v1.endpoints.auth.logout_user") as mock_logout:
        mock_logout.return_value = None

        response = await client.post(
            "/api/v1/auth/logout",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Cookie": "refresh_token=refresh_token_value",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "Successfully logged out" in data.get("message", "")


# ──────────────────────────────────────────────────────────────
# Resume Upload Tests
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resume_upload_success(test_client, mock_user, access_token, mock_db_session):
    """Test POST /api/v1/resume/upload successfully uploads and parses resume."""
    client, app, db_session, _ = test_client

    from datetime import datetime, timezone

    mock_resume = MagicMock()
    mock_resume.id = uuid4()
    mock_resume.user_id = mock_user.id
    mock_resume.original_filename = "resume.pdf"
    mock_resume.raw_text = "Senior Python Developer with 5 years experience"
    mock_resume.file_type = "pdf"
    mock_resume.file_size_bytes = 50000
    mock_resume.file_path = "/storage/path/resume.pdf"
    mock_resume.parsed_sections = json.dumps({
        "summary": "Senior Python Developer",
        "experience": [],
        "skills": ["Python", "FastAPI"],
    })
    mock_resume.created_at = datetime.now(timezone.utc)

    with patch("app.api.v1.endpoints.resume.validate_upload") as mock_validate, \
         patch("app.api.v1.endpoints.resume.save_upload") as mock_save, \
         patch("app.api.v1.endpoints.resume.parse_resume_content") as mock_parse, \
         patch("app.api.v1.endpoints.resume.ResumeRepository") as mock_repo_class:

        mock_validate.return_value = MagicMock(
            file_type="pdf",
            file_size=50000,
        )
        mock_save.return_value = "/storage/path/resume.pdf"
        mock_parse.return_value = MagicMock(
            raw_text="Senior Python Developer with 5 years experience",
            to_dict=lambda: {"summary": "Senior Python Developer", "skills": ["Python", "FastAPI"]},
        )

        mock_repo = MagicMock()
        mock_repo.create = AsyncMock(return_value=mock_resume)
        mock_repo_class.return_value = mock_repo

        # Create a mock file
        file_content = b"%PDF-1.4\nMock PDF content"
        files = {"file": ("resume.pdf", BytesIO(file_content), "application/pdf")}

        response = await client.post(
            "/api/v1/resume/upload",
            files=files,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "resume.pdf"
    assert "id" in data


@pytest.mark.asyncio
async def test_resume_upload_invalid_file(test_client, access_token):
    """Test POST /api/v1/resume/upload rejects invalid file type."""
    client, app, _, _ = test_client

    with patch("app.api.v1.endpoints.resume.validate_upload") as mock_validate:
        from app.core.exceptions import ValidationError

        mock_validate.side_effect = ValidationError(
            message="Invalid file type. Only PDF and DOCX allowed.",
        )

        files = {"file": ("document.txt", BytesIO(b"text content"), "text/plain")}

        response = await client.post(
            "/api/v1/resume/upload",
            files=files,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 400
    data = response.json()
    assert "Invalid file type" in _err_msg(data)


@pytest.mark.asyncio
async def test_resume_upload_requires_auth(test_client):
    """Test POST /api/v1/resume/upload returns 401 without authentication."""
    client, app, _, _ = test_client

    # Remove the auth override so real auth logic runs
    from app.core.dependencies import get_current_user
    original = app.dependency_overrides.pop(get_current_user, None)

    try:
        files = {"file": ("resume.pdf", BytesIO(b"content"), "application/pdf")}

        response = await client.post(
            "/api/v1/resume/upload",
            files=files,
        )

        assert response.status_code == 401
    finally:
        if original:
            app.dependency_overrides[get_current_user] = original


@pytest.mark.asyncio
async def test_resume_get_success(test_client, mock_user, access_token, mock_db_session):
    """Test GET /api/v1/resume/{resume_id} returns parsed resume."""
    client, app, db_session, _ = test_client

    resume_id = uuid4()
    mock_resume = MagicMock()
    mock_resume.id = resume_id
    mock_resume.user_id = mock_user.id
    mock_resume.original_filename = "resume.pdf"
    mock_resume.raw_text = "Senior Python Developer"
    mock_resume.parsed_sections = json.dumps({"skills": ["Python"]})

    with patch("app.api.v1.endpoints.resume.ResumeRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=mock_resume)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            f"/api/v1/resume/{resume_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["original_filename"] == "resume.pdf"
    assert str(data["id"]) == str(resume_id)


@pytest.mark.asyncio
async def test_resume_get_not_found(test_client, access_token, mock_db_session):
    """Test GET /api/v1/resume/{resume_id} returns 404 for non-existent resume."""
    client, app, db_session, _ = test_client

    with patch("app.api.v1.endpoints.resume.ResumeRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=None)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            f"/api/v1/resume/{uuid4()}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 404
    data = response.json()
    assert "Resume not found" in _err_msg(data)


@pytest.mark.asyncio
async def test_resume_list(test_client, mock_user, access_token, mock_db_session):
    """Test GET /api/v1/resume/ lists user's resumes."""
    client, app, db_session, _ = test_client

    from datetime import datetime, timezone

    mock_resumes = [
        MagicMock(
            id=uuid4(),
            original_filename="resume1.pdf",
            file_type="pdf",
            file_size_bytes=50000,
            created_at=datetime.now(timezone.utc),
        ),
        MagicMock(
            id=uuid4(),
            original_filename="resume2.pdf",
            file_type="pdf",
            file_size_bytes=45000,
            created_at=datetime.now(timezone.utc),
        ),
    ]

    with patch("app.api.v1.endpoints.resume.ResumeRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_user = AsyncMock(return_value=mock_resumes)
        mock_repo.count_unique_by_user = AsyncMock(return_value=2)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            "/api/v1/resume/",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["resumes"]) == 2


# ──────────────────────────────────────────────────────────────
# Analysis Tests
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_analysis_submit_success(test_client, mock_user, access_token, mock_db_session):
    """Test POST /api/v1/analysis/{resume_id} submits analysis task."""
    client, app, db_session, _ = test_client

    resume_id = uuid4()
    analysis_id = uuid4()

    mock_resume = MagicMock()
    mock_resume.user_id = mock_user.id
    mock_resume.raw_text = "Senior Python Developer with 5 years experience in backend systems"

    mock_analysis = MagicMock()
    mock_analysis.id = analysis_id
    mock_analysis.status = "queued"

    with patch("app.api.v1.endpoints.analysis.ResumeRepository") as mock_resume_repo_class, \
         patch("app.api.v1.endpoints.analysis.AnalysisRepository") as mock_analysis_repo_class, \
         patch.dict("sys.modules", {"app.workers.analysis_task": MagicMock()}):

        # Mock resume lookup
        mock_resume_repo = MagicMock()
        mock_resume_repo.get_by_id = AsyncMock(return_value=mock_resume)
        mock_resume_repo.update = AsyncMock()
        mock_resume_repo_class.return_value = mock_resume_repo

        # Mock analysis creation
        mock_analysis_repo = MagicMock()
        mock_analysis_repo.create = AsyncMock(return_value=mock_analysis)
        mock_analysis_repo_class.return_value = mock_analysis_repo

        response = await client.post(
            f"/api/v1/analysis/{resume_id}",
            json={
                "job_title": "Senior Backend Engineer",
                "job_description": "We are looking for a senior backend engineer with extensive Python experience and cloud skills",
                "job_company": "TechCorp",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert "status_url" in data


@pytest.mark.asyncio
async def test_analysis_submit_resume_not_found(test_client, access_token, mock_db_session):
    """Test POST /api/v1/analysis/{resume_id} returns 404 for non-existent resume."""
    client, app, db_session, _ = test_client

    with patch("app.api.v1.endpoints.analysis.ResumeRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=None)
        mock_repo_class.return_value = mock_repo

        response = await client.post(
            f"/api/v1/analysis/{uuid4()}",
            json={
                "job_title": "Senior Backend Engineer",
                "job_description": "We are looking for a senior backend engineer with extensive Python experience and cloud skills",
                "job_company": "TechCorp",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 404
    data = response.json()
    assert "Resume not found" in _err_msg(data)


@pytest.mark.asyncio
async def test_analysis_submit_insufficient_resume_text(test_client, mock_user, access_token, mock_db_session):
    """Test POST /api/v1/analysis with insufficient resume text returns validation error."""
    client, app, db_session, _ = test_client

    resume_id = uuid4()

    mock_resume = MagicMock()
    mock_resume.user_id = mock_user.id
    mock_resume.raw_text = "Short"  # Too short

    with patch("app.api.v1.endpoints.analysis.ResumeRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=mock_resume)
        mock_repo_class.return_value = mock_repo

        response = await client.post(
            f"/api/v1/analysis/{resume_id}",
            json={
                "job_title": "Senior Backend Engineer",
                "job_description": "We are looking for a senior backend engineer with extensive Python experience and cloud skills",
                "job_company": "TechCorp",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_analysis_get_status(test_client, mock_user, access_token, mock_db_session):
    """Test GET /api/v1/analysis/{analysis_id}/status returns status."""
    client, app, db_session, _ = test_client

    analysis_id = uuid4()
    mock_analysis = MagicMock()
    mock_analysis.id = analysis_id
    mock_analysis.user_id = mock_user.id
    mock_analysis.status = "processing"

    with patch("app.api.v1.endpoints.analysis.AnalysisRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=mock_analysis)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            f"/api/v1/analysis/{analysis_id}/status",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"
    assert str(data["job_id"]) == str(analysis_id)


@pytest.mark.asyncio
async def test_analysis_get_status_not_found(test_client, access_token, mock_db_session):
    """Test GET /api/v1/analysis/{analysis_id}/status returns 404."""
    client, app, db_session, _ = test_client

    with patch("app.api.v1.endpoints.analysis.AnalysisRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=None)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            f"/api/v1/analysis/{uuid4()}/status",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_analysis_list(test_client, mock_user, access_token, mock_db_session):
    """Test GET /api/v1/analysis/history lists user's analyses."""
    client, app, db_session, _ = test_client

    from datetime import datetime, timezone

    mock_analyses = [
        MagicMock(
            id=uuid4(),
            job_title="Backend Engineer",
            job_company="TechCorp",
            match_score=75.0,
            ats_score=80.0,
            status="completed",
            created_at=datetime.now(timezone.utc),
        ),
    ]

    with patch("app.api.v1.endpoints.analysis.AnalysisRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_user = AsyncMock(return_value=mock_analyses)
        mock_repo.count_by_user = AsyncMock(return_value=1)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            "/api/v1/analysis/history",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["analyses"]) == 1


@pytest.mark.asyncio
async def test_analysis_get(test_client, mock_user, access_token, mock_db_session):
    """Test GET /api/v1/analysis/{analysis_id} returns full analysis."""
    client, app, db_session, _ = test_client

    from datetime import datetime, timezone

    analysis_id = uuid4()
    mock_analysis = MagicMock()
    mock_analysis.id = analysis_id
    mock_analysis.user_id = mock_user.id
    mock_analysis.status = "completed"
    mock_analysis.match_score = 75.5
    mock_analysis.ats_score = 82.0
    mock_analysis.matched_skills = [
        {"name": "Python", "confidence": 0.95, "category": "programming_language", "source": "resume"},
    ]
    mock_analysis.missing_skills = [
        {"name": "Kubernetes", "priority": "high", "category": "devops", "weight": 1.0},
    ]
    mock_analysis.resume_skills = [
        {"name": "Python", "confidence": 0.95, "category": "programming_language", "source": "resume"},
    ]
    mock_analysis.job_skills = [
        {"name": "Python", "confidence": 0.9, "category": "programming_language", "source": "job_description"},
        {"name": "Kubernetes", "confidence": 0.85, "category": "devops", "source": "job_description"},
    ]
    mock_analysis.suggestions = []
    mock_analysis.category_breakdowns = []
    mock_analysis.score_explanation = None
    mock_analysis.ats_check = None
    mock_analysis.processing_time_ms = 5000
    mock_analysis.ai_provider = "openai"
    mock_analysis.ai_model = "gpt-4o"
    mock_analysis.ai_tokens_used = 2500
    mock_analysis.created_at = datetime.now(timezone.utc)

    with patch("app.api.v1.endpoints.analysis.AnalysisRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=mock_analysis)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            f"/api/v1/analysis/{analysis_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["match_score"] == 75.5
    assert len(data["matched_skills"]) == 1
    assert data["matched_skills"][0]["name"] == "Python"


# ──────────────────────────────────────────────────────────────
# Insights Tests (simplified)
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_roadmap_generate(test_client, mock_user, access_token, mock_db_session):
    """Test POST /insights/{analysis_id}/roadmap generates learning roadmap."""
    client, app, db_session, _ = test_client
    
    # Upgrade user to Pro tier for this test
    mock_user.tier = "pro"

    analysis_id = uuid4()
    mock_analysis = MagicMock()
    mock_analysis.id = analysis_id
    mock_analysis.user_id = mock_user.id
    mock_analysis.status = "completed"
    mock_analysis.match_score = 75.0
    mock_analysis.ats_score = 80.0
    mock_analysis.job_description = "Senior Backend Engineer"
    mock_analysis.matched_skills = ["Python"]
    mock_analysis.missing_skills = ["Kubernetes"]
    mock_analysis.resume_skills = ["Python"]
    mock_analysis.job_skills = ["Python", "Kubernetes"]

    mock_roadmap = MagicMock()
    mock_roadmap.id = uuid4()
    mock_roadmap.analysis_id = analysis_id
    mock_roadmap.total_weeks = 12
    mock_roadmap.phases = [
        {"week_range": "1-2", "focus": "Fundamentals", "objectives": ["Learn basics"], "resources": ["docs"]}
    ]

    with patch("app.api.v1.endpoints.insights.AnalysisRepository") as mock_repo_class, \
         patch("app.services.roadmap_generator.generate_roadmap") as mock_generate, \
         patch("app.services.skill_extractor.ExtractionResult") as mock_extraction_class, \
         patch("app.services.gap_analyzer.analyze_gap") as mock_gap:

        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=mock_analysis)
        mock_repo_class.return_value = mock_repo

        # Mock the select query for existing roadmap (returns None)
        db_session.execute = AsyncMock()
        db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

        mock_extraction_class.from_analysis = MagicMock()
        mock_generate.return_value = mock_roadmap
        mock_gap.return_value = MagicMock()

        db_session.commit = AsyncMock()

        response = await client.post(
            f"/api/v1/insights/{analysis_id}/roadmap",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["total_weeks"] == 12


@pytest.mark.asyncio
async def test_roadmap_get(test_client, mock_user, access_token, mock_db_session):
    """Test GET /insights/{analysis_id}/roadmap retrieves existing roadmap."""
    client, app, db_session, _ = test_client
    
    # Upgrade user to Pro tier for this test
    mock_user.tier = "pro"

    analysis_id = uuid4()
    mock_analysis = MagicMock()
    mock_analysis.id = analysis_id
    mock_analysis.user_id = mock_user.id
    mock_analysis.status = "completed"

    mock_roadmap = MagicMock()
    mock_roadmap.id = uuid4()
    mock_roadmap.analysis_id = analysis_id
    mock_roadmap.total_weeks = 12
    mock_roadmap.phases = []

    with patch("app.api.v1.endpoints.insights.AnalysisRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=mock_analysis)
        mock_repo_class.return_value = mock_repo

        db_session.execute = AsyncMock()
        db_session.execute.return_value.scalar_one_or_none = MagicMock(
            return_value=mock_roadmap
        )

        response = await client.get(
            f"/api/v1/insights/{analysis_id}/roadmap",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total_weeks"] == 12


# ──────────────────────────────────────────────────────────────
# Protected Endpoint / Authorization Tests
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_protected_endpoint_no_token(test_client):
    """Verify protected endpoints return 401 without authorization."""
    client, app, _, _ = test_client

    # Remove the auth override so real auth logic runs
    from app.core.dependencies import get_current_user
    original = app.dependency_overrides.pop(get_current_user, None)

    try:
        response = await client.get("/api/v1/resume/")
        assert response.status_code == 401
        data = response.json()
        assert "Authentication required" in _err_msg(data)
    finally:
        if original:
            app.dependency_overrides[get_current_user] = original


@pytest.mark.asyncio
async def test_protected_endpoint_invalid_token(test_client):
    """Verify protected endpoints return 401 with invalid token."""
    client, app, _, _ = test_client

    # Remove the auth override so real auth logic runs
    from app.core.dependencies import get_current_user
    original = app.dependency_overrides.pop(get_current_user, None)

    try:
        response = await client.get(
            "/api/v1/resume/",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401
    finally:
        if original:
            app.dependency_overrides[get_current_user] = original


@pytest.mark.asyncio
async def test_analysis_authorization_boundary(test_client, mock_user, access_token, mock_db_session):
    """Verify users can only access their own analyses."""
    client, app, db_session, _ = test_client

    other_user_id = uuid4()
    analysis_id = uuid4()

    # Analysis belongs to a different user
    mock_analysis = MagicMock()
    mock_analysis.id = analysis_id
    mock_analysis.user_id = other_user_id

    with patch("app.api.v1.endpoints.analysis.AnalysisRepository") as mock_repo_class:
        mock_repo = MagicMock()
        mock_repo.get_by_id = AsyncMock(return_value=mock_analysis)
        mock_repo_class.return_value = mock_repo

        response = await client.get(
            f"/api/v1/analysis/{analysis_id}/status",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 404
    data = response.json()
    assert "Analysis not found" in _err_msg(data)


# ──────────────────────────────────────────────────────────────
# Error Handling Tests
# ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_malformed_json(test_client, access_token):
    """Test endpoints return 422 with malformed JSON."""
    client, app, _, _ = test_client

    response = await client.post(
        "/api/v1/auth/login",
        content=b"not valid json",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_missing_required_fields(test_client, access_token):
    """Test endpoints return 422 with missing required fields."""
    client, app, _, _ = test_client

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com"},  # Missing password
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_invalid_uuid_format(test_client, access_token):
    """Test endpoints return 422 with invalid UUID format."""
    client, app, _, _ = test_client

    response = await client.get(
        "/api/v1/resume/not-a-uuid",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 422
