"""
Tests for the gap analysis service (Phase 6).

Covers:
- Category-level breakdown computation
- Category priority assignment
- Score explanation generation
- Strength/weakness identification
- Overall verdict determination
- Edge cases (empty skills, single category, etc.)
"""

import pytest

from app.services.gap_analyzer import (
    CategoryBreakdown,
    GapAnalysisResult,
    ScoreExplanation,
    _category_priority,
    _identify_strengths,
    _identify_weaknesses,
    _overall_verdict,
    analyze_gap,
    compute_category_breakdowns,
    explain_scores,
)
from app.services.skill_extractor import ExtractionResult
from app.services.skill_normalizer import NormalizedSkill


def _skill(
    name,
    category="programming_language",
    weight=1.5,
    required=None,
    confidence=0.9,
    in_taxonomy=True,
    source="job_description",
):
    """Helper to create a NormalizedSkill."""
    return NormalizedSkill(
        name=name,
        category=category,
        confidence=confidence,
        weight=weight,
        in_taxonomy=in_taxonomy,
        required=required,
        source=source,
    )


def _extraction(resume_skills, job_skills, matched_skills, missing_skills):
    """Helper to create an ExtractionResult."""
    return ExtractionResult(
        resume_skills=resume_skills,
        job_skills=job_skills,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        provider="openai",
        model="gpt-4o",
        total_tokens=500,
        extraction_time_ms=100,
    )


class TestCategoryBreakdowns:
    """Test category-level gap breakdown computation."""

    def test_single_category_full_match(self):
        """All skills matched in one category -> 100%."""
        job = [
            _skill("Python", "programming_language"),
            _skill("JavaScript", "programming_language"),
        ]
        matched = [
            _skill("Python", "programming_language"),
            _skill("JavaScript", "programming_language"),
        ]
        extraction = _extraction([], job, matched, [])

        breakdowns = compute_category_breakdowns(extraction)
        assert len(breakdowns) == 1
        assert breakdowns[0].category == "programming_language"
        assert breakdowns[0].match_percentage == 100.0
        assert breakdowns[0].matched_count == 2
        assert breakdowns[0].missing_count == 0

    def test_single_category_partial_match(self):
        """Some skills matched -> correct percentage."""
        job = [_skill("Python"), _skill("Go"), _skill("Rust")]
        matched = [_skill("Python")]
        missing = [_skill("Go"), _skill("Rust")]
        extraction = _extraction([], job, matched, missing)

        breakdowns = compute_category_breakdowns(extraction)
        assert breakdowns[0].match_percentage == pytest.approx(33.3, abs=0.1)
        assert breakdowns[0].matched_count == 1
        assert breakdowns[0].missing_count == 2

    def test_multiple_categories(self):
        """Skills across multiple categories produce separate breakdowns."""
        job = [
            _skill("Python", "programming_language"),
            _skill("Docker", "devops"),
            _skill("PostgreSQL", "database"),
        ]
        matched = [_skill("Python", "programming_language")]
        missing = [_skill("Docker", "devops"), _skill("PostgreSQL", "database")]
        extraction = _extraction([], job, matched, missing)

        breakdowns = compute_category_breakdowns(extraction)
        cats = {b.category for b in breakdowns}
        assert cats == {"programming_language", "devops", "database"}

    def test_empty_job_skills(self):
        """No job skills -> no breakdowns."""
        extraction = _extraction([], [], [], [])
        assert compute_category_breakdowns(extraction) == []

    def test_display_names(self):
        """Categories get human-readable display names."""
        job = [_skill("Docker", "devops")]
        extraction = _extraction([], job, [], [_skill("Docker", "devops")])

        breakdowns = compute_category_breakdowns(extraction)
        assert breakdowns[0].display_name == "DevOps & Cloud"

    def test_unknown_category_display_name(self):
        """Unknown categories get title-cased names."""
        job = [_skill("Figma", "ui_design")]
        extraction = _extraction([], job, [], [_skill("Figma", "ui_design")])

        breakdowns = compute_category_breakdowns(extraction)
        assert breakdowns[0].display_name == "Ui Design"

    def test_sorting_critical_first(self):
        """Critical gaps are sorted before nice-to-haves."""
        job = [
            _skill("Python", "programming_language", required=True, weight=2.5),
            _skill("Go", "programming_language", required=True, weight=2.0),
            _skill("Jira", "tool", required=False, weight=0.5),
        ]
        matched = [_skill("Jira", "tool")]
        missing = [
            _skill("Python", "programming_language", required=True, weight=2.5),
            _skill("Go", "programming_language", required=True, weight=2.0),
        ]
        extraction = _extraction([], job, matched, missing)

        breakdowns = compute_category_breakdowns(extraction)
        # programming_language (critical gap) should come before tool (nice_to_have)
        assert breakdowns[0].category == "programming_language"
        assert breakdowns[0].priority == "critical"

    def test_to_dict_serialization(self):
        """Breakdowns serialize correctly for JSONB storage."""
        job = [_skill("Python")]
        extraction = _extraction([], job, [_skill("Python")], [])

        breakdowns = compute_category_breakdowns(extraction)
        d = breakdowns[0].to_dict()
        assert d["category"] == "programming_language"
        assert d["matched_skills"] == ["Python"]
        assert isinstance(d["match_percentage"], float)


class TestCategoryPriority:
    """Test the _category_priority function."""

    def test_critical_many_required_missing(self):
        """Critical when >50% missing AND required skills missing."""
        matched = [_skill("A")]
        missing = [_skill("B", required=True), _skill("C", required=True)]
        assert _category_priority(matched, missing) == "critical"

    def test_important_required_but_mostly_matched(self):
        """Important when required skill missing but mostly matched."""
        matched = [_skill("A"), _skill("B"), _skill("C")]
        missing = [_skill("D", required=True)]
        assert _category_priority(matched, missing) == "important"

    def test_important_high_weight(self):
        """Important when high-weight skills missing even if not required."""
        matched = [_skill("A")]
        missing = [_skill("B", weight=2.0, required=False)]
        assert _category_priority(matched, missing) == "important"

    def test_nice_to_have_all_matched(self):
        """Nice-to-have when nothing is missing."""
        matched = [_skill("A"), _skill("B")]
        assert _category_priority(matched, []) == "nice_to_have"

    def test_nice_to_have_low_weight_missing(self):
        """Nice-to-have when only low-weight optional skills missing."""
        matched = [_skill("A")]
        missing = [_skill("B", weight=0.5, required=False)]
        assert _category_priority(matched, missing) == "nice_to_have"


class TestScoreExplanation:
    """Test the score explanation generator."""

    def test_strong_match_explanation(self):
        """High score produces positive explanation."""
        job = [_skill("Python"), _skill("Docker")]
        matched = [_skill("Python"), _skill("Docker")]
        extraction = _extraction([], job, matched, [])

        explanation = explain_scores(90.0, 100.0, extraction)
        assert "strong match" in explanation.match_summary.lower()
        assert explanation.overall_verdict == "strong_match"

    def test_weak_match_explanation(self):
        """Low score produces cautionary explanation."""
        job = [_skill("Python"), _skill("Docker"), _skill("AWS"), _skill("Go")]
        matched = [_skill("Python")]
        missing = [_skill("Docker"), _skill("AWS"), _skill("Go")]
        extraction = _extraction([], job, matched, missing)

        explanation = explain_scores(25.0, 25.0, extraction)
        assert (
            "weak match" in explanation.match_summary.lower()
            or "partial match" in explanation.match_summary.lower()
        )

    def test_strengths_identified(self):
        """Strong matched skills appear in strengths."""
        matched = [_skill("Python", weight=2.5, confidence=0.95)]
        extraction = _extraction([], [_skill("Python")], matched, [])

        explanation = explain_scores(100.0, 100.0, extraction)
        assert len(explanation.strengths) > 0
        assert any("Python" in s for s in explanation.strengths)

    def test_weaknesses_for_missing_required(self):
        """Missing required skills appear in weaknesses."""
        missing = [_skill("AWS", required=True)]
        extraction = _extraction([], [_skill("AWS", required=True)], [], missing)

        explanation = explain_scores(0.0, 0.0, extraction)
        assert len(explanation.weaknesses) > 0
        assert any("AWS" in w for w in explanation.weaknesses)

    def test_to_dict(self):
        """Explanation serializes correctly."""
        extraction = _extraction([], [], [], [])
        explanation = explain_scores(50.0, 50.0, extraction)
        d = explanation.to_dict()
        assert d["match_score"] == 50.0
        assert d["ats_score"] == 50.0
        assert "overall_verdict" in d


class TestOverallVerdict:
    """Test the _overall_verdict function."""

    def test_strong(self):
        assert _overall_verdict(90.0, 85.0) == "strong_match"

    def test_moderate(self):
        assert _overall_verdict(65.0, 60.0) == "moderate_match"

    def test_weak(self):
        assert _overall_verdict(40.0, 35.0) == "weak_match"

    def test_poor(self):
        assert _overall_verdict(10.0, 5.0) == "poor_match"

    def test_combined_weighting(self):
        """Match score weighted 70%, ATS 30%."""
        # 100 * 0.7 + 0 * 0.3 = 70 -> moderate_match
        assert _overall_verdict(100.0, 0.0) == "moderate_match"
        # 0 * 0.7 + 100 * 0.3 = 30 -> poor_match
        assert _overall_verdict(0.0, 100.0) == "poor_match"

    def test_two_missing_required_caps_strong_to_weak(self):
        """High combined score with 2 missing required skills is capped at weak_match."""
        # combined = 90*0.7 + 85*0.3 = 63+25.5 = 88.5 -> would be strong_match without cap
        assert _overall_verdict(90.0, 85.0, missing_required_count=2) == "weak_match"

    def test_one_missing_required_caps_strong_to_moderate(self):
        """High combined score with 1 missing required skill is capped at moderate_match."""
        assert (
            _overall_verdict(90.0, 85.0, missing_required_count=1) == "moderate_match"
        )

    def test_missing_required_does_not_upgrade_low_score(self):
        """Capping only prevents upgrades — a poor score stays poor even with required missing."""
        assert _overall_verdict(10.0, 5.0, missing_required_count=2) == "poor_match"
        assert _overall_verdict(40.0, 35.0, missing_required_count=1) == "weak_match"

    def test_zero_missing_required_no_cap(self):
        """No missing required skills → strong_match still awarded for high score."""
        assert _overall_verdict(90.0, 85.0, missing_required_count=0) == "strong_match"


class TestAnalyzeGap:
    """Test the main analyze_gap entry point."""

    def test_returns_complete_result(self):
        """Main entry point returns both breakdowns and explanation."""
        job = [_skill("Python"), _skill("Docker", "devops")]
        matched = [_skill("Python")]
        missing = [_skill("Docker", "devops")]
        extraction = _extraction([], job, matched, missing)

        result = analyze_gap(extraction, 50.0, 50.0)

        assert isinstance(result, GapAnalysisResult)
        assert len(result.category_breakdowns) >= 1
        assert result.score_explanation is not None
        assert result.score_explanation.overall_verdict in (
            "strong_match",
            "moderate_match",
            "weak_match",
            "poor_match",
        )

    def test_to_dict_serialization(self):
        """Full result serializes for JSONB storage."""
        extraction = _extraction([], [_skill("Python")], [_skill("Python")], [])
        result = analyze_gap(extraction, 100.0, 100.0)
        d = result.to_dict()
        assert "category_breakdowns" in d
        assert "score_explanation" in d

    def test_high_score_two_missing_required_not_strong_match(self):
        """Combined score > 80 but 2 missing required skills → verdict is NOT strong_match."""
        job = [
            _skill("Python", required=True),
            _skill("Go", required=True),
            _skill("Docker", "devops"),
            _skill("Redis", "database"),
            _skill("Kubernetes", "devops"),
        ]
        # Match all optional skills (high match/ats scores) but miss both required ones
        matched = [
            _skill("Docker", "devops"),
            _skill("Redis", "database"),
            _skill("Kubernetes", "devops"),
        ]
        missing = [_skill("Python", required=True), _skill("Go", required=True)]
        extraction = _extraction([], job, matched, missing)

        result = analyze_gap(extraction, 85.0, 80.0)
        verdict = result.score_explanation.overall_verdict
        assert verdict != "strong_match", (
            f"Expected verdict to be capped, got {verdict!r}"
        )
        assert verdict == "weak_match"
        assert result.score_explanation.missing_required_count == 2

    def test_high_score_zero_missing_required_is_strong_match(self):
        """Combined score > 80 with no missing required skills → strong_match."""
        job = [_skill("Python", required=True), _skill("Docker", "devops")]
        matched = [_skill("Python", required=True), _skill("Docker", "devops")]
        extraction = _extraction([], job, matched, [])

        result = analyze_gap(extraction, 90.0, 90.0)
        assert result.score_explanation.overall_verdict == "strong_match"
        assert result.score_explanation.missing_required_count == 0

    def test_score_explanation_includes_verdict_cap_note_in_weaknesses(self):
        """When verdict is capped, a note about it appears in weaknesses."""
        job = [_skill("Python", required=True), _skill("Go", required=True)]
        missing = [_skill("Python", required=True), _skill("Go", required=True)]
        extraction = _extraction([], job, [], missing)

        result = analyze_gap(extraction, 85.0, 80.0)
        weaknesses = result.score_explanation.weaknesses
        assert any("verdict capped" in w for w in weaknesses)

    def test_score_explanation_to_dict_has_missing_required_count(self):
        """Serialized explanation includes missing_required_count for the frontend."""
        job = [_skill("Python", required=True)]
        missing = [_skill("Python", required=True)]
        extraction = _extraction([], job, [], missing)

        result = analyze_gap(extraction, 85.0, 80.0)
        d = result.score_explanation.to_dict()
        assert "missing_required_count" in d
        assert d["missing_required_count"] == 1
