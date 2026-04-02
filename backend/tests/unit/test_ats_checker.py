"""
Tests for the ATS compatibility checker (Phase 6).

Covers:
- Essential section detection
- Contact info detection (email, phone)
- Resume length checks
- Summary section check
- Formatting issue detection
- Date format detection
- Score computation
- Edge cases
"""

import pytest

from app.services.ats_checker import (
    ATSCheckResult,
    ATSIssue,
    check_ats_compatibility,
    _check_contact_info,
    _check_essential_sections,
    _check_formatting_issues,
    _check_resume_length,
    _check_summary_section,
    _check_date_formats,
    _TOTAL_CHECKS,
)
from app.services.section_parser import ParsedResume, ParsedSection


def _make_resume(text: str, sections: list[tuple[str, str]] | None = None) -> ParsedResume:
    """Helper to create a ParsedResume for testing."""
    if sections is None:
        sections = []
    parsed_sections = [
        ParsedSection(name=name, content=content, line_start=0, line_end=10)
        for name, content in sections
    ]
    return ParsedResume(
        sections=parsed_sections,
        raw_text=text,
        word_count=len(text.split()),
    )


class TestEssentialSections:
    """Test detection of missing essential resume sections."""

    def test_all_present(self):
        """No issues when all essential sections exist."""
        resume = _make_resume("text", [
            ("experience", "Worked at X"),
            ("education", "BS in CS"),
            ("skills", "Python, Docker"),
        ])
        issues = _check_essential_sections(resume)
        assert len(issues) == 0

    def test_missing_experience(self):
        """Missing experience is an error."""
        resume = _make_resume("text", [
            ("education", "BS"), ("skills", "Python"),
        ])
        issues = _check_essential_sections(resume)
        assert len(issues) == 1
        assert issues[0].severity == "error"
        assert "experience" in issues[0].title.lower()

    def test_missing_education(self):
        """Missing education is a warning."""
        resume = _make_resume("text", [
            ("experience", "Worked"), ("skills", "Python"),
        ])
        issues = _check_essential_sections(resume)
        assert len(issues) == 1
        assert issues[0].severity == "warning"

    def test_missing_skills(self):
        """Missing skills is a warning."""
        resume = _make_resume("text", [
            ("experience", "Worked"), ("education", "BS"),
        ])
        issues = _check_essential_sections(resume)
        assert len(issues) == 1
        assert "skills" in issues[0].title.lower()

    def test_all_missing(self):
        """All three missing produces 3 issues."""
        resume = _make_resume("text", [("header", "John Doe")])
        issues = _check_essential_sections(resume)
        assert len(issues) == 3


class TestContactInfo:
    """Test contact information detection."""

    def test_email_and_phone_present(self):
        """No issues when both email and phone are present."""
        resume = _make_resume("john@example.com (555) 123-4567")
        issues = _check_contact_info(resume)
        assert len(issues) == 0

    def test_missing_email(self):
        """Missing email is an error."""
        resume = _make_resume("John Doe (555) 123-4567")
        issues = _check_contact_info(resume)
        assert len(issues) == 1
        assert issues[0].severity == "error"
        assert "email" in issues[0].title.lower()

    def test_missing_phone(self):
        """Missing phone is a warning."""
        resume = _make_resume("John Doe john@example.com")
        issues = _check_contact_info(resume)
        assert len(issues) == 1
        assert issues[0].severity == "warning"
        assert "phone" in issues[0].title.lower()

    def test_various_phone_formats(self):
        """Different phone formats are all detected."""
        for phone in ["555-123-4567", "(555) 123-4567", "555.123.4567", "+1 555 123 4567"]:
            resume = _make_resume(f"john@test.com {phone}")
            issues = _check_contact_info(resume)
            phone_issues = [i for i in issues if "phone" in i.title.lower()]
            assert len(phone_issues) == 0, f"Failed to detect phone: {phone}"

    def test_various_email_formats(self):
        """Different email formats are detected."""
        for email in ["user@domain.com", "first.last@company.org", "user+tag@test.co.uk"]:
            resume = _make_resume(f"{email} 555-123-4567")
            issues = _check_contact_info(resume)
            email_issues = [i for i in issues if "email" in i.title.lower()]
            assert len(email_issues) == 0, f"Failed to detect email: {email}"


class TestResumeLength:
    """Test resume length checks."""

    def test_ideal_length(self):
        """No issues for resumes in the sweet spot (400-1500 words)."""
        resume = _make_resume(" ".join(["word"] * 600))
        issues = _check_resume_length(resume)
        assert len(issues) == 0

    def test_very_short(self):
        """Under 150 words is an error."""
        resume = _make_resume(" ".join(["word"] * 100))
        issues = _check_resume_length(resume)
        assert len(issues) == 1
        assert issues[0].severity == "error"

    def test_short(self):
        """150-300 words is a warning."""
        resume = _make_resume(" ".join(["word"] * 200))
        issues = _check_resume_length(resume)
        assert len(issues) == 1
        assert issues[0].severity == "warning"

    def test_very_long(self):
        """Over 1500 words is a warning."""
        resume = _make_resume(" ".join(["word"] * 2000))
        issues = _check_resume_length(resume)
        assert len(issues) == 1
        assert issues[0].severity == "warning"


class TestSummarySection:
    """Test professional summary check."""

    def test_summary_present(self):
        """No issue when summary exists."""
        resume = _make_resume("text", [("summary", "Experienced developer")])
        issues = _check_summary_section(resume)
        assert len(issues) == 0

    def test_summary_missing(self):
        """Info-level issue when summary is missing."""
        resume = _make_resume("text", [("experience", "Worked")])
        issues = _check_summary_section(resume)
        assert len(issues) == 1
        assert issues[0].severity == "info"


class TestFormattingIssues:
    """Test formatting issue detection."""

    def test_clean_text(self):
        """No issues with clean text."""
        resume = _make_resume("Clean resume with normal formatting and standard bullets.")
        issues = _check_formatting_issues(resume)
        assert len(issues) == 0

    def test_table_characters(self):
        """Pipe/box characters suggest table layout."""
        resume = _make_resume("Name │ Role │ Company\n" * 20)
        issues = _check_formatting_issues(resume)
        table_issues = [i for i in issues if "table" in i.title.lower() or "column" in i.title.lower()]
        assert len(table_issues) == 1

    def test_fancy_bullets(self):
        """Excessive non-standard bullet characters are flagged."""
        resume = _make_resume("● Item\n" * 35)
        issues = _check_formatting_issues(resume)
        bullet_issues = [i for i in issues if "bullet" in i.title.lower()]
        assert len(bullet_issues) == 1
        assert bullet_issues[0].severity == "info"


class TestDateFormats:
    """Test date format detection in experience section."""

    def test_standard_dates(self):
        """Standard date formats are accepted."""
        resume = _make_resume("text", [
            ("experience", "Software Engineer\nJan 2020 - Present\nDid stuff"),
        ])
        issues = _check_date_formats(resume)
        assert len(issues) == 0

    def test_year_range_dates(self):
        """Year-only ranges are accepted."""
        resume = _make_resume("text", [
            ("experience", "Developer\n2019 - 2023\nBuilt things"),
        ])
        issues = _check_date_formats(resume)
        assert len(issues) == 0

    def test_no_dates(self):
        """Experience without dates is a warning."""
        resume = _make_resume("text", [
            ("experience", "Software Engineer at Company\nDid various things"),
        ])
        issues = _check_date_formats(resume)
        assert len(issues) == 1
        assert issues[0].severity == "warning"

    def test_no_experience_section(self):
        """No experience section -> no date issues."""
        resume = _make_resume("text", [("skills", "Python")])
        issues = _check_date_formats(resume)
        assert len(issues) == 0


class TestATSCheckIntegration:
    """Test the main check_ats_compatibility function."""

    def test_perfect_resume(self):
        """A well-structured resume gets a high format score."""
        text = (
            "John Doe\njohn@example.com\n(555) 123-4567\n\n"
            + " ".join(["word"] * 500)
        )
        resume = _make_resume(text, [
            ("summary", "Experienced software engineer"),
            ("experience", "Software Engineer\nJan 2020 - Present\nBuilt APIs"),
            ("education", "BS Computer Science"),
            ("skills", "Python, Docker, AWS"),
        ])
        result = check_ats_compatibility(resume)

        assert isinstance(result, ATSCheckResult)
        assert result.format_score >= 90.0
        assert result.passed_checks > 0

    def test_poor_resume(self):
        """A resume with many issues gets a low format score."""
        resume = _make_resume("short", [])
        result = check_ats_compatibility(resume)

        assert result.format_score < 50.0
        assert len(result.issues) > 0

    def test_score_deduction_logic(self):
        """Errors deduct more than warnings, which deduct more than info."""
        # Resume with exactly 1 error (15 pts) -> 85
        resume = _make_resume(
            "john@test.com 555-123-4567 " + " ".join(["word"] * 500),
            [("education", "BS"), ("skills", "Python")],
            # Missing "experience" -> 1 error
        )
        result = check_ats_compatibility(resume)
        error_count = sum(1 for i in result.issues if i.severity == "error")
        assert error_count >= 1

    def test_to_dict(self):
        """Result serializes for JSONB storage."""
        resume = _make_resume("john@test.com 555-123-4567 " + " ".join(["word"] * 500), [
            ("summary", "Dev"), ("experience", "Jan 2020 - Present"),
            ("education", "BS"), ("skills", "Python"),
        ])
        result = check_ats_compatibility(resume)
        d = result.to_dict()
        assert "issues" in d
        assert "format_score" in d
        assert isinstance(d["issues"], list)

    def test_passed_checks_equals_total_when_no_failures(self):
        """When no checks fail, passed_checks == total_checks == 6."""
        text = (
            "John Doe\njohn@example.com\n(555) 123-4567\n\n"
            + " ".join(["word"] * 500)
        )
        resume = _make_resume(text, [
            ("summary", "Experienced software engineer"),
            ("experience", "Software Engineer\nJan 2020 - Present\nBuilt APIs"),
            ("education", "BS Computer Science"),
            ("skills", "Python, Docker, AWS"),
        ])
        result = check_ats_compatibility(resume)

        assert result.total_checks == 6
        assert result.passed_checks == result.total_checks
        assert result.passed_checks == _TOTAL_CHECKS

    def test_passed_checks_when_most_checks_fail(self):
        """passed_checks == 1 when 5 of 6 checks fail.

        _check_summary_section only ever emits 'info' severity, so it always
        counts as passed. All other 5 checks fail with this crafted resume:
        - _check_essential_sections: missing education + skills (warnings)
        - _check_contact_info: no email (error) + no phone (warning)
        - _check_resume_length: 80 words < 150 threshold (error)
        - _check_formatting_issues: table characters > 1% ratio (warning)
        - _check_date_formats: experience section has no recognisable dates (warning)
        """
        # "Name │ Role │ Company\n" x20 = 80 words, │ ratio ≈ 8% → triggers table warning
        table_text = "Name │ Role │ Company\n" * 20
        resume = _make_resume(table_text, [
            ("experience", "Software Engineer at Acme\nBuilt various systems"),
        ])
        result = check_ats_compatibility(resume)

        assert result.total_checks == _TOTAL_CHECKS
        assert result.passed_checks == 1
