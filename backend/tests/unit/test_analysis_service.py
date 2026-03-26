"""
Comprehensive tests for the analysis service.

Covers:
- _compute_match_score and _compute_ats_score (pure scoring)
- _load_taxonomy (Redis caching + DB fallback)
- run_analysis (full pipeline orchestration)
"""

import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock, PropertyMock
from uuid import uuid4

from app.services.analysis_service import (
    _compute_ats_score,
    _compute_match_score,
    _load_taxonomy,
    run_analysis,
    TAXONOMY_CACHE_KEY,
    TAXONOMY_CACHE_TTL,
)
from app.services.skill_extractor import ExtractionResult
from app.services.skill_normalizer import NormalizedSkill
from app.core.exceptions import NotFoundError, ParsingError


def _make_skill(name, weight=1.0, required=None):
    """Helper to create a NormalizedSkill for testing."""
    return NormalizedSkill(
        name=name,
        category="programming_language",
        confidence=0.9,
        weight=weight,
        in_taxonomy=True,
        required=required,
    )


def _make_result(job_skills, matched_skills):
    """Helper to create an ExtractionResult with just the fields scoring needs."""
    return ExtractionResult(
        resume_skills=[],
        job_skills=job_skills,
        matched_skills=matched_skills,
        missing_skills=[],
        provider="openai",
        model="gpt-4o",
        total_tokens=0,
        extraction_time_ms=0,
    )


class TestComputeMatchScore:
    """Test the weighted match score computation."""

    def test_perfect_match(self):
        job = [_make_skill("Python", weight=2.0), _make_skill("Docker", weight=1.0)]
        matched = [_make_skill("Python", weight=2.0), _make_skill("Docker", weight=1.0)]
        result = _make_result(job, matched)
        assert _compute_match_score(result) == 100.0

    def test_no_match(self):
        job = [_make_skill("Python", weight=2.0)]
        result = _make_result(job, [])
        assert _compute_match_score(result) == 0.0

    def test_partial_match_weighted(self):
        job = [_make_skill("Python", weight=3.0), _make_skill("Git", weight=1.0)]
        matched = [_make_skill("Python", weight=3.0)]
        result = _make_result(job, matched)
        assert _compute_match_score(result) == 75.0

    def test_partial_match_light_skill(self):
        job = [_make_skill("Python", weight=3.0), _make_skill("Git", weight=1.0)]
        matched = [_make_skill("Git", weight=1.0)]
        result = _make_result(job, matched)
        assert _compute_match_score(result) == 25.0

    def test_empty_job_skills(self):
        result = _make_result([], [])
        assert _compute_match_score(result) == 0.0

    def test_score_rounds_to_one_decimal(self):
        job = [_make_skill("A", weight=3.0), _make_skill("B", weight=7.0)]
        matched = [_make_skill("A", weight=3.0)]
        result = _make_result(job, matched)
        assert _compute_match_score(result) == 30.0

    def test_zero_weight_skills(self):
        """All zero-weight skills -> 0%."""
        job = [_make_skill("A", weight=0.0), _make_skill("B", weight=0.0)]
        result = _make_result(job, [])
        assert _compute_match_score(result) == 0.0

    def test_score_caps_at_100(self):
        """Score never exceeds 100."""
        job = [_make_skill("A", weight=1.0)]
        matched = [_make_skill("A", weight=5.0)]  # Matched weight > job weight
        result = _make_result(job, matched)
        assert _compute_match_score(result) <= 100.0


class TestComputeATSScore:
    """Test the simplified ATS score computation."""

    def test_perfect_ats(self):
        job = [_make_skill("Python"), _make_skill("Docker")]
        matched = [_make_skill("Python"), _make_skill("Docker")]
        result = _make_result(job, matched)
        assert _compute_ats_score(result) == 100.0

    def test_no_ats_match(self):
        job = [_make_skill("Python")]
        result = _make_result(job, [])
        assert _compute_ats_score(result) == 0.0

    def test_partial_ats(self):
        job = [_make_skill("A"), _make_skill("B"), _make_skill("C"), _make_skill("D")]
        matched = [_make_skill("A"), _make_skill("B")]
        result = _make_result(job, matched)
        assert _compute_ats_score(result) == 50.0

    def test_ats_ignores_weight(self):
        job = [_make_skill("Python", weight=10.0), _make_skill("Git", weight=0.1)]
        matched = [_make_skill("Git", weight=0.1)]
        result = _make_result(job, matched)
        assert _compute_ats_score(result) == 50.0

    def test_empty_job_skills_ats(self):
        result = _make_result([], [])
        assert _compute_ats_score(result) == 0.0


class TestLoadTaxonomy:
    """Tests for _load_taxonomy with Redis caching."""

    @pytest.mark.asyncio
    async def test_loads_from_redis_cache(self):
        """Returns cached taxonomy when available in Redis."""
        mock_session = AsyncMock()
        mock_redis = AsyncMock()
        cached_data = [{"name": "Python", "category": "language"}]
        mock_redis.get = AsyncMock(return_value=json.dumps(cached_data))

        result = await _load_taxonomy(mock_session, mock_redis)
        assert result == cached_data
        mock_redis.get.assert_called_once_with(TAXONOMY_CACHE_KEY)

    @pytest.mark.asyncio
    async def test_loads_from_db_on_cache_miss(self):
        """Loads from DB when Redis cache is empty."""
        mock_session = AsyncMock()
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.setex = AsyncMock()

        mock_skill = MagicMock()
        mock_skill.name = "Python"
        mock_skill.category = "programming_language"
        mock_skill.weight = 2.0
        mock_skill.aliases = ["python3"]

        with patch("app.services.analysis_service.SkillRepository") as MockRepo:
            repo_instance = MockRepo.return_value
            repo_instance.get_all = AsyncMock(return_value=[mock_skill])
            with patch("app.services.analysis_service.build_taxonomy_index") as mock_build:
                mock_build.return_value = [{"name": "Python"}]
                result = await _load_taxonomy(mock_session, mock_redis)

        assert result == [{"name": "Python"}]
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_loads_from_db_when_redis_unavailable(self):
        """Falls back to DB when Redis is None."""
        mock_session = AsyncMock()

        mock_skill = MagicMock()
        mock_skill.name = "Docker"
        mock_skill.category = "devops"
        mock_skill.weight = 1.5
        mock_skill.aliases = []

        with patch("app.services.analysis_service.SkillRepository") as MockRepo:
            repo_instance = MockRepo.return_value
            repo_instance.get_all = AsyncMock(return_value=[mock_skill])
            with patch("app.services.analysis_service.build_taxonomy_index") as mock_build:
                mock_build.return_value = [{"name": "Docker"}]
                result = await _load_taxonomy(mock_session, redis_client=None)

        assert result == [{"name": "Docker"}]

    @pytest.mark.asyncio
    async def test_redis_get_error_falls_back_to_db(self):
        """Redis read error falls back to DB gracefully."""
        mock_session = AsyncMock()
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis connection lost"))
        mock_redis.setex = AsyncMock()

        with patch("app.services.analysis_service.SkillRepository") as MockRepo:
            repo_instance = MockRepo.return_value
            repo_instance.get_all = AsyncMock(return_value=[])
            with patch("app.services.analysis_service.build_taxonomy_index") as mock_build:
                mock_build.return_value = []
                result = await _load_taxonomy(mock_session, mock_redis)

        assert result == []

    @pytest.mark.asyncio
    async def test_redis_set_error_non_fatal(self):
        """Redis write error doesn't fail the operation."""
        mock_session = AsyncMock()
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis write error"))

        with patch("app.services.analysis_service.SkillRepository") as MockRepo:
            repo_instance = MockRepo.return_value
            repo_instance.get_all = AsyncMock(return_value=[])
            with patch("app.services.analysis_service.build_taxonomy_index") as mock_build:
                mock_build.return_value = [{"name": "test"}]
                result = await _load_taxonomy(mock_session, mock_redis)

        assert result == [{"name": "test"}]

    @pytest.mark.asyncio
    async def test_skill_without_weight_defaults(self):
        """Skills without weight attribute default to 1.0."""
        mock_session = AsyncMock()

        mock_skill = MagicMock(spec=["name", "category"])
        mock_skill.name = "Git"
        mock_skill.category = "tool"
        # No weight or aliases attributes

        with patch("app.services.analysis_service.SkillRepository") as MockRepo:
            repo_instance = MockRepo.return_value
            repo_instance.get_all = AsyncMock(return_value=[mock_skill])
            with patch("app.services.analysis_service.build_taxonomy_index") as mock_build:
                mock_build.return_value = []
                await _load_taxonomy(mock_session, redis_client=None)

        # Verify the skill data passed to build_taxonomy_index
        call_args = mock_build.call_args[0][0]
        assert call_args[0]["weight"] == 1.0
        assert call_args[0]["aliases"] == []


class TestRunAnalysis:
    """Tests for the full run_analysis pipeline."""

    def _make_mock_extraction(self):
        """Create a mock ExtractionResult."""
        extraction = MagicMock(spec=ExtractionResult)
        extraction.job_skills = [_make_skill("Python")]
        extraction.matched_skills = [_make_skill("Python")]
        extraction.resume_skills = [_make_skill("Python")]
        extraction.missing_skills = []
        extraction.provider = "openai"
        extraction.model = "gpt-4o"
        extraction.total_tokens = 500
        extraction.to_dict.return_value = {
            "resume_skills": [{"name": "Python"}],
            "job_skills": [{"name": "Python"}],
            "matched_skills": [{"name": "Python"}],
            "missing_skills": [],
        }
        return extraction

    @pytest.mark.asyncio
    async def test_analysis_not_found_raises(self):
        """NotFoundError when analysis record doesn't exist."""
        mock_session = AsyncMock()
        analysis_id = uuid4()

        with patch("app.services.analysis_service.AnalysisRepository") as MockAnalysisRepo:
            repo_instance = MockAnalysisRepo.return_value
            repo_instance.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError, match="not found"):
                await run_analysis(analysis_id, mock_session)

    @pytest.mark.asyncio
    async def test_resume_not_found_marks_failed(self):
        """Analysis marked as failed when resume is missing."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        analysis_id = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.resume_id = uuid4()

        with patch("app.services.analysis_service.AnalysisRepository") as MockAnalysisRepo, \
             patch("app.services.analysis_service.ResumeRepository") as MockResumeRepo:
            analysis_repo = MockAnalysisRepo.return_value
            analysis_repo.get_by_id = AsyncMock(return_value=mock_analysis)
            analysis_repo.update = AsyncMock(return_value=mock_analysis)

            resume_repo = MockResumeRepo.return_value
            resume_repo.get_by_id = AsyncMock(return_value=None)

            with pytest.raises(NotFoundError, match="resume not found"):
                await run_analysis(analysis_id, mock_session)

            # Verify status was set to failed (update uses **kwargs, not positional args)
            update_calls = analysis_repo.update.call_args_list
            assert any(
                call.kwargs.get("status") == "failed"
                for call in update_calls
                if "status" in call.kwargs
            )

    @pytest.mark.asyncio
    async def test_short_resume_raises_parsing_error(self):
        """ParsingError when resume text is too short."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        analysis_id = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.resume_id = uuid4()

        mock_resume = MagicMock()
        mock_resume.raw_text = "Short"

        with patch("app.services.analysis_service.AnalysisRepository") as MockAnalysisRepo, \
             patch("app.services.analysis_service.ResumeRepository") as MockResumeRepo:
            analysis_repo = MockAnalysisRepo.return_value
            analysis_repo.get_by_id = AsyncMock(return_value=mock_analysis)
            analysis_repo.update = AsyncMock(return_value=mock_analysis)

            resume_repo = MockResumeRepo.return_value
            resume_repo.get_by_id = AsyncMock(return_value=mock_resume)

            with pytest.raises(ParsingError, match="too short"):
                await run_analysis(analysis_id, mock_session)

    @pytest.mark.asyncio
    async def test_successful_analysis_pipeline(self):
        """Full pipeline completes and stores results."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        analysis_id = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.resume_id = uuid4()
        mock_analysis.job_description = "Need Python developer with 5 years experience"

        mock_resume = MagicMock()
        mock_resume.raw_text = "Experienced Python developer with 5 years of experience building web applications and REST APIs. " * 3

        extraction = self._make_mock_extraction()

        mock_gap_result = MagicMock()
        mock_gap_result.category_breakdowns = []
        mock_gap_result.score_explanation = MagicMock()
        mock_gap_result.score_explanation.to_dict.return_value = {"verdict": "strong"}

        mock_ats_result = MagicMock()
        mock_ats_result.format_score = 85.0
        mock_ats_result.to_dict.return_value = {"format_score": 85.0}

        mock_parsed_resume = MagicMock()

        updated_analysis = MagicMock()

        with patch("app.services.analysis_service.AnalysisRepository") as MockAnalysisRepo, \
             patch("app.services.analysis_service.ResumeRepository") as MockResumeRepo, \
             patch("app.services.analysis_service._load_taxonomy", new_callable=AsyncMock, return_value=[]), \
             patch("app.services.analysis_service.extract_skills", new_callable=AsyncMock, return_value=extraction), \
             patch("app.services.analysis_service.analyze_gap", return_value=mock_gap_result), \
             patch("app.services.analysis_service.parse_sections", return_value=mock_parsed_resume), \
             patch("app.services.analysis_service.check_ats_compatibility", return_value=mock_ats_result), \
             patch("app.services.analysis_service.generate_suggestions", new_callable=AsyncMock, return_value=[]):

            analysis_repo = MockAnalysisRepo.return_value
            analysis_repo.get_by_id = AsyncMock(return_value=mock_analysis)
            analysis_repo.update = AsyncMock(return_value=updated_analysis)

            resume_repo = MockResumeRepo.return_value
            resume_repo.get_by_id = AsyncMock(return_value=mock_resume)

            result = await run_analysis(analysis_id, mock_session)

        assert result == updated_analysis
        # Verify final update had status=completed (update uses **kwargs, not positional args)
        final_update = analysis_repo.update.call_args_list[-1]
        assert final_update.kwargs["status"] == "completed"
        assert "match_score" in final_update.kwargs
        assert "ats_score" in final_update.kwargs
        assert final_update.kwargs.get("error_message") is None

    @pytest.mark.asyncio
    async def test_extraction_failure_marks_analysis_failed(self):
        """Pipeline failure marks analysis as failed with error message."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        analysis_id = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.resume_id = uuid4()
        mock_analysis.job_description = "Need Python developer"

        mock_resume = MagicMock()
        mock_resume.raw_text = "Experienced Python developer with many years building web applications and REST APIs. " * 3

        with patch("app.services.analysis_service.AnalysisRepository") as MockAnalysisRepo, \
             patch("app.services.analysis_service.ResumeRepository") as MockResumeRepo, \
             patch("app.services.analysis_service._load_taxonomy", new_callable=AsyncMock, return_value=[]), \
             patch("app.services.analysis_service.extract_skills", new_callable=AsyncMock,
                   side_effect=Exception("LLM provider down")):

            analysis_repo = MockAnalysisRepo.return_value
            analysis_repo.get_by_id = AsyncMock(return_value=mock_analysis)
            analysis_repo.update = AsyncMock(return_value=mock_analysis)

            resume_repo = MockResumeRepo.return_value
            resume_repo.get_by_id = AsyncMock(return_value=mock_resume)

            with pytest.raises(Exception, match="LLM provider down"):
                await run_analysis(analysis_id, mock_session)

            # Verify the analysis was marked as failed (update uses **kwargs, not positional args)
            update_calls = analysis_repo.update.call_args_list
            fail_call = [c for c in update_calls if "status" in c.kwargs and c.kwargs.get("status") == "failed"]
            assert len(fail_call) == 1
            assert "LLM provider down" in fail_call[0].kwargs["error_message"]

    @pytest.mark.asyncio
    async def test_status_set_to_processing(self):
        """Analysis status is set to processing before pipeline starts."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        analysis_id = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.resume_id = uuid4()

        mock_resume = MagicMock()
        mock_resume.raw_text = "Short"

        with patch("app.services.analysis_service.AnalysisRepository") as MockAnalysisRepo, \
             patch("app.services.analysis_service.ResumeRepository") as MockResumeRepo:
            analysis_repo = MockAnalysisRepo.return_value
            analysis_repo.get_by_id = AsyncMock(return_value=mock_analysis)
            analysis_repo.update = AsyncMock(return_value=mock_analysis)

            resume_repo = MockResumeRepo.return_value
            resume_repo.get_by_id = AsyncMock(return_value=mock_resume)

            with pytest.raises(ParsingError):
                await run_analysis(analysis_id, mock_session)

            # First update should be status=processing (update uses **kwargs, not positional args)
            first_update = analysis_repo.update.call_args_list[0]
            assert first_update.kwargs == {"status": "processing"}

    @pytest.mark.asyncio
    async def test_run_analysis_with_redis(self):
        """Pipeline passes redis_client to _load_taxonomy."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_redis = AsyncMock()
        analysis_id = uuid4()

        mock_analysis = MagicMock()
        mock_analysis.resume_id = uuid4()
        mock_analysis.job_description = "Python developer needed"

        mock_resume = MagicMock()
        mock_resume.raw_text = "Python developer with extensive experience in building web applications and REST APIs. " * 3

        extraction = self._make_mock_extraction()

        mock_gap_result = MagicMock()
        mock_gap_result.category_breakdowns = []
        mock_gap_result.score_explanation = MagicMock()
        mock_gap_result.score_explanation.to_dict.return_value = {}

        mock_ats_result = MagicMock()
        mock_ats_result.format_score = 80.0
        mock_ats_result.to_dict.return_value = {}

        with patch("app.services.analysis_service.AnalysisRepository") as MockAnalysisRepo, \
             patch("app.services.analysis_service.ResumeRepository") as MockResumeRepo, \
             patch("app.services.analysis_service._load_taxonomy", new_callable=AsyncMock, return_value=[]) as mock_load, \
             patch("app.services.analysis_service.extract_skills", new_callable=AsyncMock, return_value=extraction), \
             patch("app.services.analysis_service.analyze_gap", return_value=mock_gap_result), \
             patch("app.services.analysis_service.parse_sections", return_value=MagicMock()), \
             patch("app.services.analysis_service.check_ats_compatibility", return_value=mock_ats_result), \
             patch("app.services.analysis_service.generate_suggestions", new_callable=AsyncMock, return_value=[]):

            analysis_repo = MockAnalysisRepo.return_value
            analysis_repo.get_by_id = AsyncMock(return_value=mock_analysis)
            analysis_repo.update = AsyncMock(return_value=MagicMock())

            resume_repo = MockResumeRepo.return_value
            resume_repo.get_by_id = AsyncMock(return_value=mock_resume)

            await run_analysis(analysis_id, mock_session, redis_client=mock_redis)

        mock_load.assert_called_once_with(mock_session, mock_redis)
