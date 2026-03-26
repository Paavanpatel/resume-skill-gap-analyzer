"""
Tests for the suggestion engine (Phase 6).

Covers:
- Rule-based missing skill suggestions
- Category gap suggestions
- ATS issue suggestions
- Deduplication and priority sorting
- LLM prompt builder
- Edge cases
"""

import pytest

from app.services.suggestion_engine import (
    Suggestion,
    generate_rule_based_suggestions,
    _missing_skill_suggestions,
    _category_gap_suggestions,
    _ats_issue_suggestions,
    build_suggestion_prompt,
)
from app.services.ats_checker import ATSCheckResult, ATSIssue
from app.services.gap_analyzer import (
    CategoryBreakdown,
    GapAnalysisResult,
    ScoreExplanation,
)
from app.services.skill_extractor import ExtractionResult
from app.services.skill_normalizer import NormalizedSkill


def _skill(name, category="programming_language", weight=1.5, required=None):
    return NormalizedSkill(
        name=name, category=category, confidence=0.9,
        weight=weight, in_taxonomy=True, required=required,
    )


def _extraction(missing_skills, matched_skills=None):
    """Create a minimal ExtractionResult."""
    return ExtractionResult(
        resume_skills=matched_skills or [],
        job_skills=missing_skills + (matched_skills or []),
        matched_skills=matched_skills or [],
        missing_skills=missing_skills,
        provider="openai", model="gpt-4o",
        total_tokens=500, extraction_time_ms=100,
    )


def _gap_result(breakdowns=None):
    """Create a minimal GapAnalysisResult."""
    return GapAnalysisResult(
        category_breakdowns=breakdowns or [],
        score_explanation=ScoreExplanation(
            match_score=50, ats_score=50,
            match_summary="", ats_summary="",
            strengths=[], weaknesses=[],
            overall_verdict="moderate_match",
        ),
    )


def _ats_result(issues=None):
    """Create a minimal ATSCheckResult."""
    return ATSCheckResult(
        issues=issues or [],
        format_score=80.0,
        passed_checks=6,
        total_checks=8,
    )


class TestMissingSkillSuggestions:
    """Test suggestions for missing skills."""

    def test_high_priority_required_skills(self):
        """Required high-weight skills produce high-priority suggestions."""
        missing = [
            _skill("Python", required=True, weight=2.5),
            _skill("AWS", "devops", required=True, weight=2.0),
        ]
        extraction = _extraction(missing)
        suggestions = _missing_skill_suggestions(extraction)

        assert len(suggestions) >= 1
        assert suggestions[0].priority == "high"
        assert "Python" in suggestions[0].suggested
        assert "AWS" in suggestions[0].suggested

    def test_medium_priority_skills(self):
        """Required but lower-weight skills produce medium-priority suggestions."""
        missing = [
            _skill("Git", "tool", required=True, weight=1.0),
        ]
        extraction = _extraction(missing)
        suggestions = _missing_skill_suggestions(extraction)

        has_medium = any(s.priority == "medium" for s in suggestions)
        assert has_medium

    def test_low_priority_nice_to_haves(self):
        """Non-required low-weight skills produce low-priority suggestions."""
        missing = [
            _skill("Jira", "tool", required=False, weight=0.5),
        ]
        extraction = _extraction(missing)
        suggestions = _missing_skill_suggestions(extraction)

        assert len(suggestions) >= 1
        assert suggestions[0].priority == "low"

    def test_no_missing_skills(self):
        """No missing skills -> no suggestions."""
        extraction = _extraction([])
        suggestions = _missing_skill_suggestions(extraction)
        assert len(suggestions) == 0

    def test_suggestions_capped(self):
        """Suggestions don't produce an overwhelming list."""
        missing = [_skill(f"Skill{i}", required=True, weight=2.0) for i in range(20)]
        extraction = _extraction(missing)
        suggestions = _missing_skill_suggestions(extraction)
        assert len(suggestions) <= 3  # max 3 groups (high, medium, low)


class TestCategoryGapSuggestions:
    """Test suggestions from category gaps."""

    def test_critical_gap_suggestion(self):
        """Critical category gaps produce high-priority suggestions."""
        breakdown = CategoryBreakdown(
            category="devops", display_name="DevOps & Cloud",
            total_job_skills=3, matched_count=0, missing_count=3,
            match_percentage=0.0,
            matched_skills=[],
            missing_skills=["Docker", "AWS", "Kubernetes"],
            priority="critical",
        )
        gap = _gap_result([breakdown])
        suggestions = _category_gap_suggestions(gap)

        assert len(suggestions) == 1
        assert suggestions[0].priority == "high"
        assert "Docker" in suggestions[0].suggested
        assert "DevOps & Cloud" in suggestions[0].reason

    def test_important_gap_suggestion(self):
        """Important gaps produce medium-priority suggestions."""
        breakdown = CategoryBreakdown(
            category="database", display_name="Databases",
            total_job_skills=2, matched_count=1, missing_count=1,
            match_percentage=50.0,
            matched_skills=["PostgreSQL"],
            missing_skills=["Redis"],
            priority="important",
        )
        gap = _gap_result([breakdown])
        suggestions = _category_gap_suggestions(gap)

        assert len(suggestions) == 1
        assert suggestions[0].priority == "medium"

    def test_nice_to_have_no_suggestion(self):
        """Nice-to-have gaps don't produce suggestions."""
        breakdown = CategoryBreakdown(
            category="tool", display_name="Tools",
            total_job_skills=1, matched_count=1, missing_count=0,
            match_percentage=100.0,
            matched_skills=["Git"], missing_skills=[],
            priority="nice_to_have",
        )
        gap = _gap_result([breakdown])
        suggestions = _category_gap_suggestions(gap)
        assert len(suggestions) == 0


class TestATSIssueSuggestions:
    """Test conversion of ATS issues to suggestions."""

    def test_error_becomes_high(self):
        """ATS errors become high-priority suggestions."""
        issues = [ATSIssue(
            severity="error", category="structure",
            title="Missing Experience", description="No experience section",
            fix="Add an Experience section",
        )]
        ats = _ats_result(issues)
        suggestions = _ats_issue_suggestions(ats)

        assert len(suggestions) == 1
        assert suggestions[0].priority == "high"
        assert suggestions[0].source == "rule"

    def test_warning_becomes_medium(self):
        """ATS warnings become medium-priority suggestions."""
        issues = [ATSIssue(
            severity="warning", category="contact",
            title="No phone", description="Missing phone",
            fix="Add phone number",
        )]
        ats = _ats_result(issues)
        suggestions = _ats_issue_suggestions(ats)
        assert suggestions[0].priority == "medium"

    def test_info_becomes_low(self):
        """ATS info becomes low-priority suggestions."""
        issues = [ATSIssue(
            severity="info", category="structure",
            title="No summary", description="Missing summary",
            fix="Add a summary",
        )]
        ats = _ats_result(issues)
        suggestions = _ats_issue_suggestions(ats)
        assert suggestions[0].priority == "low"


class TestGenerateRuleBasedSuggestions:
    """Test the combined rule-based suggestion generator."""

    def test_combines_all_sources(self):
        """Suggestions come from all three rule engines."""
        missing = [_skill("AWS", "devops", required=True, weight=2.5)]
        extraction = _extraction(missing)

        breakdown = CategoryBreakdown(
            category="devops", display_name="DevOps",
            total_job_skills=1, matched_count=0, missing_count=1,
            match_percentage=0.0,
            matched_skills=[], missing_skills=["AWS"],
            priority="critical",
        )
        gap = _gap_result([breakdown])

        ats_issues = [ATSIssue(
            severity="error", category="structure",
            title="Missing Experience", description="...",
            fix="Add Experience section",
        )]
        ats = _ats_result(ats_issues)

        suggestions = generate_rule_based_suggestions(extraction, gap, ats)

        sources = {s.source for s in suggestions}
        assert sources == {"rule"}
        assert len(suggestions) >= 2  # At least skill + ATS suggestions

    def test_sorted_by_priority(self):
        """High-priority suggestions come first."""
        missing = [
            _skill("Python", required=True, weight=2.5),
            _skill("Jira", "tool", required=False, weight=0.5),
        ]
        extraction = _extraction(missing)
        gap = _gap_result()
        ats = _ats_result()

        suggestions = generate_rule_based_suggestions(extraction, gap, ats)

        if len(suggestions) >= 2:
            priorities = [s.priority for s in suggestions]
            priority_values = {"high": 0, "medium": 1, "low": 2}
            numeric = [priority_values.get(p, 3) for p in priorities]
            assert numeric == sorted(numeric)

    def test_capped_at_10(self):
        """Total suggestions are capped at 10."""
        missing = [_skill(f"Skill{i}", required=True, weight=2.0) for i in range(15)]
        extraction = _extraction(missing)

        breakdowns = [
            CategoryBreakdown(
                category=f"cat{i}", display_name=f"Cat {i}",
                total_job_skills=1, matched_count=0, missing_count=1,
                match_percentage=0.0,
                matched_skills=[], missing_skills=[f"Skill{i}"],
                priority="critical",
            )
            for i in range(5)
        ]
        gap = _gap_result(breakdowns)

        ats_issues = [ATSIssue(
            severity="error", category="structure",
            title=f"Issue {i}", description="...", fix=f"Fix {i}",
        ) for i in range(5)]
        ats = _ats_result(ats_issues)

        suggestions = generate_rule_based_suggestions(extraction, gap, ats)
        assert len(suggestions) <= 10

    def test_deduplication(self):
        """Duplicate suggestions are removed."""
        missing = [_skill("AWS", "devops", required=True, weight=2.5)]
        extraction = _extraction(missing)

        # Create a gap that produces a similar suggestion
        breakdown = CategoryBreakdown(
            category="devops", display_name="DevOps",
            total_job_skills=1, matched_count=0, missing_count=1,
            match_percentage=0.0,
            matched_skills=[], missing_skills=["AWS"],
            priority="critical",
        )
        gap = _gap_result([breakdown])
        ats = _ats_result()

        suggestions = generate_rule_based_suggestions(extraction, gap, ats)

        # Check that (section, suggested) pairs are unique
        pairs = [(s.section, s.suggested) for s in suggestions]
        assert len(pairs) == len(set(pairs))


class TestSuggestionPromptBuilder:
    """Test the LLM suggestion prompt builder."""

    def test_contains_resume_text(self):
        """Resume text is included in prompt."""
        prompt = build_suggestion_prompt(
            resume_text="I know Python and Docker",
            job_description="Need AWS experience",
            match_score=50.0,
            matched_skills=[_skill("Python")],
            missing_skills=[_skill("AWS", "devops")],
        )
        assert "I know Python and Docker" in prompt
        assert "<resume_text>" in prompt

    def test_contains_gap_summary(self):
        """Gap summary with scores and skills is included."""
        prompt = build_suggestion_prompt(
            resume_text="test",
            job_description="test",
            match_score=72.5,
            matched_skills=[_skill("Python")],
            missing_skills=[_skill("AWS", "devops")],
        )
        assert "72" in prompt  # match score
        assert "Python" in prompt  # matched
        assert "AWS" in prompt  # missing

    def test_truncates_long_text(self):
        """Long resume text is truncated to save tokens."""
        long_text = "word " * 5000  # way over 3000 chars
        prompt = build_suggestion_prompt(
            resume_text=long_text,
            job_description="test",
            match_score=50.0,
            matched_skills=[], missing_skills=[],
        )
        # prompt should be shorter than the full text
        assert len(prompt) < len(long_text)

    def test_suggestion_serialization(self):
        """Suggestion.to_dict() produces correct format."""
        s = Suggestion(
            section="skills",
            current="Python, Docker",
            suggested="Python, Docker, AWS",
            reason="Job requires AWS",
            priority="high",
            source="rule",
        )
        d = s.to_dict()
        assert d["section"] == "skills"
        assert d["priority"] == "high"
        assert d["source"] == "rule"
