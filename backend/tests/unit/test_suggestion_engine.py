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

from unittest.mock import AsyncMock, patch

import pytest

from app.services.ats_checker import ATSCheckResult, ATSIssue
from app.services.gap_analyzer import (
    CategoryBreakdown,
    GapAnalysisResult,
    ScoreExplanation,
)
from app.services.section_parser import ParsedResume, ParsedSection
from app.services.skill_extractor import ExtractionResult
from app.services.skill_normalizer import NormalizedSkill
from app.services.suggestion_engine import (
    MAX_RULE_SUGGESTIONS,
    MAX_TOTAL_SUGGESTIONS,
    Suggestion,
    _ats_issue_suggestions,
    _build_condensed_resume,
    _category_gap_suggestions,
    _missing_skill_suggestions,
    build_suggestion_prompt,
    generate_rule_based_suggestions,
    generate_suggestions,
)


def _skill(name, category="programming_language", weight=1.5, required=None):
    return NormalizedSkill(
        name=name,
        category=category,
        confidence=0.9,
        weight=weight,
        in_taxonomy=True,
        required=required,
    )


def _extraction(missing_skills, matched_skills=None):
    """Create a minimal ExtractionResult."""
    return ExtractionResult(
        resume_skills=matched_skills or [],
        job_skills=missing_skills + (matched_skills or []),
        matched_skills=matched_skills or [],
        missing_skills=missing_skills,
        provider="openai",
        model="gpt-4o",
        total_tokens=500,
        extraction_time_ms=100,
    )


def _make_parsed_resume(sections=None, raw_text="") -> ParsedResume:
    """Create a ParsedResume for testing."""
    parsed_sections = [
        ParsedSection(name=name, content=content, line_start=0, line_end=10)
        for name, content in (sections or [])
    ]
    return ParsedResume(
        sections=parsed_sections,
        raw_text=raw_text,
        word_count=len(raw_text.split()),
    )


def _gap_result(breakdowns=None):
    """Create a minimal GapAnalysisResult."""
    return GapAnalysisResult(
        category_breakdowns=breakdowns or [],
        score_explanation=ScoreExplanation(
            match_score=50,
            ats_score=50,
            match_summary="",
            ats_summary="",
            strengths=[],
            weaknesses=[],
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
            category="devops",
            display_name="DevOps & Cloud",
            total_job_skills=3,
            matched_count=0,
            missing_count=3,
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
            category="database",
            display_name="Databases",
            total_job_skills=2,
            matched_count=1,
            missing_count=1,
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
            category="tool",
            display_name="Tools",
            total_job_skills=1,
            matched_count=1,
            missing_count=0,
            match_percentage=100.0,
            matched_skills=["Git"],
            missing_skills=[],
            priority="nice_to_have",
        )
        gap = _gap_result([breakdown])
        suggestions = _category_gap_suggestions(gap)
        assert len(suggestions) == 0


class TestATSIssueSuggestions:
    """Test conversion of ATS issues to suggestions."""

    def test_error_becomes_high(self):
        """ATS errors become high-priority suggestions."""
        issues = [
            ATSIssue(
                severity="error",
                category="structure",
                title="Missing Experience",
                description="No experience section",
                fix="Add an Experience section",
            )
        ]
        ats = _ats_result(issues)
        suggestions = _ats_issue_suggestions(ats)

        assert len(suggestions) == 1
        assert suggestions[0].priority == "high"
        assert suggestions[0].source == "rule"

    def test_warning_becomes_medium(self):
        """ATS warnings become medium-priority suggestions."""
        issues = [
            ATSIssue(
                severity="warning",
                category="contact",
                title="No phone",
                description="Missing phone",
                fix="Add phone number",
            )
        ]
        ats = _ats_result(issues)
        suggestions = _ats_issue_suggestions(ats)
        assert suggestions[0].priority == "medium"

    def test_info_becomes_low(self):
        """ATS info becomes low-priority suggestions."""
        issues = [
            ATSIssue(
                severity="info",
                category="structure",
                title="No summary",
                description="Missing summary",
                fix="Add a summary",
            )
        ]
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
            category="devops",
            display_name="DevOps",
            total_job_skills=1,
            matched_count=0,
            missing_count=1,
            match_percentage=0.0,
            matched_skills=[],
            missing_skills=["AWS"],
            priority="critical",
        )
        gap = _gap_result([breakdown])

        ats_issues = [
            ATSIssue(
                severity="error",
                category="structure",
                title="Missing Experience",
                description="...",
                fix="Add Experience section",
            )
        ]
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

    def test_capped_at_rule_max(self):
        """Rule suggestions are capped at MAX_RULE_SUGGESTIONS."""
        missing = [_skill(f"Skill{i}", required=True, weight=2.0) for i in range(15)]
        extraction = _extraction(missing)

        breakdowns = [
            CategoryBreakdown(
                category=f"cat{i}",
                display_name=f"Cat {i}",
                total_job_skills=1,
                matched_count=0,
                missing_count=1,
                match_percentage=0.0,
                matched_skills=[],
                missing_skills=[f"Skill{i}"],
                priority="critical",
            )
            for i in range(5)
        ]
        gap = _gap_result(breakdowns)

        ats_issues = [
            ATSIssue(
                severity="error",
                category="structure",
                title=f"Issue {i}",
                description="...",
                fix=f"Fix {i}",
            )
            for i in range(5)
        ]
        ats = _ats_result(ats_issues)

        suggestions = generate_rule_based_suggestions(extraction, gap, ats)
        assert len(suggestions) <= MAX_RULE_SUGGESTIONS

    def test_deduplication(self):
        """Duplicate suggestions are removed."""
        missing = [_skill("AWS", "devops", required=True, weight=2.5)]
        extraction = _extraction(missing)

        # Create a gap that produces a similar suggestion
        breakdown = CategoryBreakdown(
            category="devops",
            display_name="DevOps",
            total_job_skills=1,
            matched_count=0,
            missing_count=1,
            match_percentage=0.0,
            matched_skills=[],
            missing_skills=["AWS"],
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

    def test_contains_resume_sections(self):
        """Parsed section content is included in the prompt."""
        parsed_resume = _make_parsed_resume([("skills", "Python, Docker")])
        prompt = build_suggestion_prompt(
            parsed_resume=parsed_resume,
            job_description="Need AWS experience",
            match_score=50.0,
            matched_skills=[_skill("Python")],
            missing_skills=[_skill("AWS", "devops")],
        )
        assert "Python, Docker" in prompt
        assert "<resume_sections>" in prompt

    def test_contains_gap_summary(self):
        """Gap summary with scores and skills is included."""
        parsed_resume = _make_parsed_resume([("skills", "Python")], raw_text="test")
        prompt = build_suggestion_prompt(
            parsed_resume=parsed_resume,
            job_description="test",
            match_score=72.5,
            matched_skills=[_skill("Python")],
            missing_skills=[_skill("AWS", "devops")],
        )
        assert "72" in prompt  # match score
        assert "Python" in prompt  # matched
        assert "AWS" in prompt  # missing

    def test_contains_category_breakdowns(self):
        """Category breakdowns are included when gap_analysis is provided."""
        breakdown = CategoryBreakdown(
            category="devops",
            display_name="DevOps & Cloud",
            total_job_skills=3,
            matched_count=1,
            missing_count=2,
            match_percentage=33.3,
            matched_skills=["Docker"],
            missing_skills=["AWS", "Kubernetes"],
            priority="critical",
        )
        gap = _gap_result([breakdown])
        parsed_resume = _make_parsed_resume([("skills", "Docker")], raw_text="test")
        prompt = build_suggestion_prompt(
            parsed_resume=parsed_resume,
            job_description="test",
            match_score=33.0,
            matched_skills=[_skill("Docker", "devops")],
            missing_skills=[_skill("AWS", "devops"), _skill("Kubernetes", "devops")],
            gap_analysis=gap,
        )
        assert "DevOps & Cloud" in prompt
        assert "critical" in prompt
        assert "1/3 matched" in prompt
        assert "AWS" in prompt
        assert "Kubernetes" in prompt
        assert "<category_breakdowns>" in prompt

    def test_no_gap_analysis_shows_fallback(self):
        """Prompt works without gap_analysis (backward compat)."""
        parsed_resume = _make_parsed_resume([("skills", "Python")], raw_text="test")
        prompt = build_suggestion_prompt(
            parsed_resume=parsed_resume,
            job_description="test",
            match_score=50.0,
            matched_skills=[_skill("Python")],
            missing_skills=[],
            gap_analysis=None,
        )
        assert "No category breakdowns available" in prompt

    def test_experience_truncated_skills_preserved(self):
        """Long experience is capped at 2,000 chars; skills section is always included."""
        long_experience = "Lead developer. " * 500  # ~8,000 chars
        skills_content = "Python, FastAPI, PostgreSQL, Redis"
        parsed_resume = _make_parsed_resume(
            [
                ("experience", long_experience),
                ("skills", skills_content),
            ]
        )
        prompt = build_suggestion_prompt(
            parsed_resume=parsed_resume,
            job_description="test",
            match_score=50.0,
            matched_skills=[],
            missing_skills=[],
        )
        assert skills_content in prompt
        # Experience must have been truncated — the raw text is ~8k but prompt is much less
        assert len(prompt) < len(long_experience)

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


class TestBuildCondensedResume:
    """Test that _build_condensed_resume always surfaces critical sections."""

    def test_skills_after_3000_chars_are_included(self):
        """Skills section content is present even when it starts after char 3,000."""
        # A realistic chronological resume: 4,000 chars of contact + experience first,
        # then a Skills section that would be invisible to a blind [:3000] slice.
        long_experience = "x" * 4000
        skills_content = "Python, FastAPI, PostgreSQL, Redis, Docker, Kubernetes"
        parsed_resume = _make_parsed_resume(
            [
                ("experience", long_experience),
                ("skills", skills_content),
            ],
            raw_text=long_experience + "\nSkills\n" + skills_content,
        )

        result = _build_condensed_resume(parsed_resume)

        assert skills_content in result, (
            "Skills section was not included — LLM would have missed these keywords"
        )

    def test_summary_and_education_always_included(self):
        """Summary and education sections are included regardless of length."""
        long_experience = "Senior Engineer at BigCorp. " * 200  # ~5,600 chars
        parsed_resume = _make_parsed_resume(
            [
                ("experience", long_experience),
                ("summary", "Experienced backend engineer with 8 years in Python."),
                ("education", "B.Sc. Computer Science, MIT, 2016"),
                ("skills", "Python, Go, Rust"),
            ]
        )

        result = _build_condensed_resume(parsed_resume)

        assert "Experienced backend engineer" in result
        assert "B.Sc. Computer Science" in result
        assert "Python, Go, Rust" in result

    def test_experience_is_capped_at_2000_chars(self):
        """Experience longer than 2,000 chars is truncated in the output."""
        long_experience = "A" * 5000
        parsed_resume = _make_parsed_resume([("experience", long_experience)])

        result = _build_condensed_resume(parsed_resume)

        # The full 5,000-char block must not appear verbatim
        assert long_experience not in result
        assert len(result) < len(long_experience)

    def test_fallback_when_no_sections_parsed(self):
        """Falls back to raw_text[:3000] when section parsing produced nothing."""
        raw = "Plain resume text with no headings. " * 200  # ~7,200 chars
        parsed_resume = _make_parsed_resume(sections=[], raw_text=raw)

        result = _build_condensed_resume(parsed_resume)

        assert result == raw[:3000]


def _make_heavy_inputs():
    """Build inputs that produce MAX_RULE_SUGGESTIONS rule suggestions."""
    missing = [_skill(f"Skill{i}", required=True, weight=2.0) for i in range(5)]
    extraction = _extraction(missing)
    breakdowns = [
        CategoryBreakdown(
            category=f"cat{i}",
            display_name=f"Cat {i}",
            total_job_skills=1,
            matched_count=0,
            missing_count=1,
            match_percentage=0.0,
            matched_skills=[],
            missing_skills=[f"S{i}"],
            priority="critical",
        )
        for i in range(5)
    ]
    gap = _gap_result(breakdowns)
    ats_issues = [
        ATSIssue(
            severity="error",
            category="structure",
            title=f"Issue {i}",
            description="...",
            fix=f"Fix {i}",
        )
        for i in range(5)
    ]
    ats = _ats_result(ats_issues)
    return extraction, gap, ats


class TestLLMSuggestionsMerging:
    """LLM suggestions must not be silently discarded."""

    async def test_llm_suggestions_appear_when_rule_cap_was_previously_full(self):
        """When rule suggestions would have filled the old 10-slot cap, LLM results still appear."""
        extraction, gap, ats = _make_heavy_inputs()

        llm_result = [
            Suggestion(
                section="summary",
                current="missing",
                suggested=f"LLM suggestion {i}",
                reason="Helps",
                priority="medium",
                source="llm",
            )
            for i in range(3)
        ]

        with patch(
            "app.services.suggestion_engine.generate_llm_suggestions",
            new=AsyncMock(return_value=llm_result),
        ):
            result = await generate_suggestions(
                parsed_resume=_make_parsed_resume(),
                job_description="test",
                match_score=50.0,
                extraction=extraction,
                gap_analysis=gap,
                ats_check=ats,
                include_llm=True,
            )

        llm_in_result = [s for s in result if s["source"] == "llm"]
        assert len(llm_in_result) >= 1, "LLM suggestions were discarded"
        assert len(result) <= MAX_TOTAL_SUGGESTIONS

    async def test_llm_high_priority_sorts_before_medium_rule_suggestions(self):
        """A high-priority LLM suggestion should appear before medium-priority rule suggestions."""
        # Only medium-priority rule suggestions
        missing = [_skill("Git", "tool", required=True, weight=1.0)]
        extraction = _extraction(missing)
        gap = _gap_result()
        ats = _ats_result()

        llm_result = [
            Suggestion(
                section="experience",
                current="missing",
                suggested="Add a critical missing skill from LLM",
                reason="Critical gap",
                priority="high",
                source="llm",
            )
        ]

        with patch(
            "app.services.suggestion_engine.generate_llm_suggestions",
            new=AsyncMock(return_value=llm_result),
        ):
            result = await generate_suggestions(
                parsed_resume=_make_parsed_resume(),
                job_description="test",
                match_score=40.0,
                extraction=extraction,
                gap_analysis=gap,
                ats_check=ats,
                include_llm=True,
            )

        priority_order = {"high": 0, "medium": 1, "low": 2}
        numeric = [priority_order.get(s["priority"], 3) for s in result]
        assert numeric == sorted(numeric), "Results are not sorted by priority"

        # The high-priority LLM suggestion must appear before any medium-priority entries
        high_indices = [i for i, s in enumerate(result) if s["priority"] == "high"]
        medium_indices = [i for i, s in enumerate(result) if s["priority"] == "medium"]
        if high_indices and medium_indices:
            assert max(high_indices) < min(medium_indices)


class TestLLMPriorityParsing:
    """LLM suggestions respect the priority field from the JSON response."""

    async def test_valid_priority_values_are_preserved(self):
        """high/medium/low from LLM JSON are accepted as-is."""
        from unittest.mock import MagicMock

        from app.services.suggestion_engine import generate_llm_suggestions

        mock_response = MagicMock()
        mock_response.parse_json.return_value = {
            "suggestions": [
                {
                    "section": "skills",
                    "suggested": "Add Docker",
                    "reason": "r",
                    "priority": "high",
                },
                {
                    "section": "summary",
                    "suggested": "Rewrite it",
                    "reason": "r",
                    "priority": "low",
                },
                {
                    "section": "experience",
                    "suggested": "Add project",
                    "reason": "r",
                },  # missing → default
            ]
        }
        with patch(
            "app.services.llm_client.call_llm",
            new=AsyncMock(return_value=mock_response),
        ):
            suggestions = await generate_llm_suggestions(
                _make_parsed_resume(), "jd", 50.0, _extraction([])
            )

        priorities = {s.suggested: s.priority for s in suggestions}
        assert priorities["Add Docker"] == "high"
        assert priorities["Rewrite it"] == "low"
        assert priorities["Add project"] == "medium"  # default fallback

    async def test_invalid_priority_falls_back_to_medium(self):
        """An unrecognised priority value from the LLM falls back to 'medium'."""
        from unittest.mock import MagicMock

        from app.services.suggestion_engine import generate_llm_suggestions

        mock_response = MagicMock()
        mock_response.parse_json.return_value = {
            "suggestions": [
                {
                    "section": "skills",
                    "suggested": "Add Rust",
                    "reason": "r",
                    "priority": "critical",
                },
            ]
        }
        with patch(
            "app.services.llm_client.call_llm",
            new=AsyncMock(return_value=mock_response),
        ):
            suggestions = await generate_llm_suggestions(
                _make_parsed_resume(), "jd", 50.0, _extraction([])
            )

        assert suggestions[0].priority == "medium"
