"""
Unit tests for the resume advisor service (Phase 9).

Tests:
- Rule-based advice generation (fallback path)
- LLM advice generation with mocked responses
- LLM failure fallback
- Edge cases (no skills, no gaps)
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.gap_analyzer import (
    CategoryBreakdown,
    GapAnalysisResult,
    ScoreExplanation,
)
from app.services.resume_advisor import (
    AdvisorResult,
    SectionRewrite,
    generate_llm_advice,
    generate_resume_advice,
    generate_rule_based_advice,
)
from app.services.skill_extractor import ExtractionResult
from app.services.skill_normalizer import NormalizedSkill

# ── Fixtures ─────────────────────────────────────────────────────


def _make_extraction(matched=3, missing=4) -> ExtractionResult:
    matched_skills = [
        NormalizedSkill(
            name=f"Python{i}",
            category="programming",
            confidence=0.9,
            weight=2.0,
            in_taxonomy=True,
            source="resume",
        )
        for i in range(matched)
    ]
    missing_skills = [
        NormalizedSkill(
            name=f"Docker{i}",
            category="devops",
            confidence=0.0,
            weight=2.0,
            in_taxonomy=True,
            source="job_description",
            required=True,
        )
        for i in range(missing)
    ]
    return ExtractionResult(
        resume_skills=matched_skills,
        job_skills=matched_skills + missing_skills,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        provider="openai",
        model="gpt-4",
        total_tokens=1000,
        extraction_time_ms=500,
    )


def _make_gap_result() -> GapAnalysisResult:
    return GapAnalysisResult(
        category_breakdowns=[
            CategoryBreakdown(
                category="devops",
                display_name="DevOps",
                total_job_skills=4,
                matched_count=0,
                missing_count=4,
                match_percentage=0.0,
                matched_skills=[],
                missing_skills=["Docker", "Kubernetes", "CI/CD", "Terraform"],
                priority="critical",
            ),
        ],
        score_explanation=ScoreExplanation(
            match_score=40.0,
            ats_score=35.0,
            match_summary="Weak",
            ats_summary="Low",
            strengths=[],
            weaknesses=["Missing DevOps"],
            overall_verdict="weak_match",
        ),
    )


# ── Rule-based advice tests ──────────────────────────────────────


class TestRuleBasedAdvice:
    def test_produces_skills_rewrite_when_missing(self):
        extraction = _make_extraction(matched=2, missing=3)
        gap = _make_gap_result()
        result = generate_rule_based_advice("Resume text...", extraction, gap)
        assert isinstance(result, AdvisorResult)
        skills_rewrites = [r for r in result.rewrites if r.section == "skills"]
        assert len(skills_rewrites) >= 1

    def test_skills_rewrite_includes_missing(self):
        extraction = _make_extraction(matched=1, missing=2)
        gap = _make_gap_result()
        result = generate_rule_based_advice("Resume text...", extraction, gap)
        skills_rewrite = next(
            (r for r in result.rewrites if r.section == "skills"), None
        )
        assert skills_rewrite is not None
        assert "Docker0" in skills_rewrite.rewritten

    def test_produces_summary_rewrite_for_critical_gaps(self):
        extraction = _make_extraction()
        gap = _make_gap_result()
        result = generate_rule_based_advice("Resume text...", extraction, gap)
        summary_rewrites = [r for r in result.rewrites if r.section == "summary"]
        assert len(summary_rewrites) >= 1

    def test_no_missing_skills_produces_no_skills_rewrite(self):
        extraction = _make_extraction(matched=5, missing=0)
        gap = GapAnalysisResult(
            category_breakdowns=[],
            score_explanation=ScoreExplanation(
                match_score=95,
                ats_score=90,
                match_summary="Strong",
                ats_summary="Good",
                strengths=["All skills matched"],
                weaknesses=[],
                overall_verdict="strong_match",
            ),
        )
        result = generate_rule_based_advice("Resume text...", extraction, gap)
        skills_rewrites = [r for r in result.rewrites if r.section == "skills"]
        assert len(skills_rewrites) == 0

    def test_overall_summary_present(self):
        extraction = _make_extraction()
        gap = _make_gap_result()
        result = generate_rule_based_advice("Resume text...", extraction, gap)
        assert result.overall_summary
        assert len(result.overall_summary) > 10

    def test_rewrite_to_dict(self):
        rewrite = SectionRewrite(
            section="skills",
            original="Python",
            rewritten="Python, Docker",
            changes_made=["Added Docker"],
            confidence=0.7,
        )
        d = rewrite.to_dict()
        assert d["section"] == "skills"
        assert d["confidence"] == 0.7


# ── LLM advice tests ────────────────────────────────────────────


class TestLLMAdvice:
    @pytest.mark.asyncio
    async def test_parses_llm_response(self):
        mock_response = MagicMock()
        mock_response.parse_json.return_value = {
            "rewrites": [
                {
                    "section": "summary",
                    "original": "Backend developer",
                    "rewritten": "Backend developer with DevOps experience",
                    "changes_made": ["Added DevOps keywords"],
                    "confidence": 0.85,
                }
            ],
            "overall_summary": "Added DevOps focus to summary.",
        }

        with patch(
            "app.services.llm_client.call_llm",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            extraction = _make_extraction()
            result = await generate_llm_advice("Resume", "Job desc", extraction, 50.0)

        assert len(result.rewrites) == 1
        assert result.rewrites[0].section == "summary"
        assert result.rewrites[0].confidence == 0.85

    @pytest.mark.asyncio
    async def test_llm_failure_returns_empty(self):
        with patch(
            "app.services.llm_client.call_llm", side_effect=Exception("API down")
        ):
            extraction = _make_extraction()
            result = await generate_llm_advice("Resume", "Job desc", extraction, 50.0)
        assert len(result.rewrites) == 0

    @pytest.mark.asyncio
    async def test_full_flow_falls_back_to_rules(self):
        """generate_resume_advice falls back to rules when LLM returns empty."""
        with patch("app.services.llm_client.call_llm", side_effect=Exception("down")):
            extraction = _make_extraction()
            gap = _make_gap_result()
            result = await generate_resume_advice(
                "Resume text", "Job desc", extraction, gap, 50.0, use_llm=True
            )
        # Should have rule-based rewrites despite LLM failure
        assert len(result.rewrites) > 0

    @pytest.mark.asyncio
    async def test_no_llm_mode(self):
        extraction = _make_extraction()
        gap = _make_gap_result()
        result = await generate_resume_advice(
            "Resume text", "Job desc", extraction, gap, 50.0, use_llm=False
        )
        assert isinstance(result, AdvisorResult)
        assert len(result.rewrites) > 0


# ── Confidence clamping ──────────────────────────────────────────


class TestConfidenceClamping:
    @pytest.mark.asyncio
    async def test_confidence_clamped_to_0_1(self):
        mock_response = MagicMock()
        mock_response.parse_json.return_value = {
            "rewrites": [
                {
                    "section": "skills",
                    "original": "A",
                    "rewritten": "B",
                    "changes_made": [],
                    "confidence": 1.5,  # Over 1.0
                }
            ],
            "overall_summary": "Test",
        }

        with patch(
            "app.services.llm_client.call_llm",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            extraction = _make_extraction()
            result = await generate_llm_advice("Resume", "Job desc", extraction, 50.0)

        assert result.rewrites[0].confidence == 1.0
