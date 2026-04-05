"""
Unit tests for the roadmap generator service (Phase 9).

Tests:
- Week estimation from gap severity
- Rule-based roadmap generation (fallback path)
- Phase structure and ordering
- Empty/no-gap edge cases
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.gap_analyzer import (
    CategoryBreakdown,
    GapAnalysisResult,
    ScoreExplanation,
)
from app.services.roadmap_generator import (
    GeneratedRoadmap,
    RoadmapPhase,
    _estimate_weeks,
    generate_llm_roadmap,
    generate_rule_based_roadmap,
)
from app.services.skill_extractor import ExtractionResult
from app.services.skill_normalizer import NormalizedSkill

# ── Fixtures ─────────────────────────────────────────────────────


def _make_extraction(matched=3, missing=5) -> ExtractionResult:
    matched_skills = [
        NormalizedSkill(
            name=f"MatchedSkill{i}",
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
            name=f"MissingSkill{i}",
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


def _make_gap_result(critical=2, important=1, nice=1) -> GapAnalysisResult:
    breakdowns = []
    if critical:
        breakdowns.append(
            CategoryBreakdown(
                category="devops",
                display_name="DevOps",
                total_job_skills=critical + 1,
                matched_count=1,
                missing_count=critical,
                match_percentage=30.0,
                matched_skills=["Docker"],
                missing_skills=[f"Skill{i}" for i in range(critical)],
                priority="critical",
            )
        )
    if important:
        breakdowns.append(
            CategoryBreakdown(
                category="cloud",
                display_name="Cloud",
                total_job_skills=important + 1,
                matched_count=1,
                missing_count=important,
                match_percentage=50.0,
                matched_skills=["AWS"],
                missing_skills=[f"CloudSkill{i}" for i in range(important)],
                priority="important",
            )
        )
    if nice:
        breakdowns.append(
            CategoryBreakdown(
                category="soft_skills",
                display_name="Soft Skills",
                total_job_skills=nice + 1,
                matched_count=1,
                missing_count=nice,
                match_percentage=50.0,
                matched_skills=["Communication"],
                missing_skills=[f"SoftSkill{i}" for i in range(nice)],
                priority="nice_to_have",
            )
        )

    return GapAnalysisResult(
        category_breakdowns=breakdowns,
        score_explanation=ScoreExplanation(
            match_score=50.0,
            ats_score=40.0,
            match_summary="Moderate match",
            ats_summary="Below average",
            strengths=["Good Python"],
            weaknesses=["Missing DevOps"],
            overall_verdict="moderate_match",
        ),
    )


# ── Week estimation tests ────────────────────────────────────────


class TestEstimateWeeks:
    def test_minimum_four_weeks(self):
        gap = _make_gap_result(critical=0, important=0, nice=1)
        weeks = _estimate_weeks(gap)
        assert weeks >= 4

    def test_critical_skills_add_more_weeks(self):
        light = _make_gap_result(critical=1, important=0, nice=0)
        heavy = _make_gap_result(critical=5, important=0, nice=0)
        assert _estimate_weeks(heavy) > _estimate_weeks(light)

    def test_maximum_sixteen_weeks(self):
        gap = _make_gap_result(critical=10, important=5, nice=5)
        weeks = _estimate_weeks(gap)
        assert weeks <= 16

    def test_always_even_number(self):
        for c in range(6):
            gap = _make_gap_result(critical=c, important=1, nice=1)
            assert _estimate_weeks(gap) % 2 == 0


# ── Rule-based roadmap tests ────────────────────────────────────


class TestRuleBasedRoadmap:
    def test_produces_phases(self):
        extraction = _make_extraction()
        gap = _make_gap_result(critical=2, important=1, nice=1)
        roadmap = generate_rule_based_roadmap(extraction, gap)
        assert isinstance(roadmap, GeneratedRoadmap)
        assert roadmap.total_weeks > 0
        assert len(roadmap.phases) > 0

    def test_critical_skills_first(self):
        extraction = _make_extraction()
        gap = _make_gap_result(critical=2, important=1, nice=1)
        roadmap = generate_rule_based_roadmap(extraction, gap)
        # First phase should focus on critical skills
        first_phase = roadmap.phases[0]
        assert "Skill0" in first_phase.focus or "Skill1" in first_phase.focus

    def test_no_missing_skills(self):
        extraction = _make_extraction(matched=5, missing=0)
        gap = _make_gap_result(critical=0, important=0, nice=0)
        roadmap = generate_rule_based_roadmap(extraction, gap)
        assert roadmap.total_weeks == 0
        assert len(roadmap.phases) == 1
        assert "No gaps" in roadmap.phases[0].focus

    def test_phase_has_required_fields(self):
        extraction = _make_extraction()
        gap = _make_gap_result(critical=2, important=1)
        roadmap = generate_rule_based_roadmap(extraction, gap)
        for phase in roadmap.phases:
            assert phase.week_range
            assert phase.focus
            assert len(phase.objectives) > 0
            assert len(phase.resources) > 0

    def test_to_dict_serialization(self):
        extraction = _make_extraction()
        gap = _make_gap_result(critical=1)
        roadmap = generate_rule_based_roadmap(extraction, gap)
        d = roadmap.to_dict()
        assert "total_weeks" in d
        assert "phases" in d
        assert isinstance(d["phases"], list)
        assert "week_range" in d["phases"][0]


# ── LLM roadmap tests ───────────────────────────────────────────


class TestLLMRoadmap:
    @pytest.mark.asyncio
    async def test_falls_back_on_llm_error(self):
        extraction = _make_extraction()
        gap = _make_gap_result(critical=2)
        with patch(
            "app.services.llm_client.call_llm", side_effect=Exception("API down")
        ):
            roadmap = await generate_llm_roadmap(extraction, gap, "Job description")
        # Should fall back to rule-based
        assert isinstance(roadmap, GeneratedRoadmap)
        assert roadmap.total_weeks > 0

    @pytest.mark.asyncio
    async def test_parses_llm_response(self):
        mock_response = MagicMock()
        mock_response.parse_json.return_value = {
            "phases": [
                {
                    "week_range": "1-2",
                    "focus": "Docker Fundamentals",
                    "objectives": ["Learn containers", "Write Dockerfiles"],
                    "resources": ["Docker docs"],
                },
                {
                    "week_range": "3-4",
                    "focus": "Kubernetes Basics",
                    "objectives": ["Deploy pods"],
                    "resources": ["K8s tutorials"],
                },
            ]
        }

        with patch(
            "app.services.llm_client.call_llm",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            extraction = _make_extraction()
            gap = _make_gap_result(critical=2)
            roadmap = await generate_llm_roadmap(extraction, gap, "Job description")

        assert len(roadmap.phases) == 2
        assert roadmap.phases[0].focus == "Docker Fundamentals"
        assert "Learn containers" in roadmap.phases[0].objectives

    @pytest.mark.asyncio
    async def test_empty_llm_response_falls_back(self):
        mock_response = MagicMock()
        mock_response.parse_json.return_value = {"phases": []}

        with patch(
            "app.services.llm_client.call_llm",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            extraction = _make_extraction()
            gap = _make_gap_result(critical=2)
            roadmap = await generate_llm_roadmap(extraction, gap, "Job description")

        # Should fall back
        assert len(roadmap.phases) > 0
