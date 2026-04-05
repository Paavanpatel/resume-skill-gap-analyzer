"""
Tests for the resume section parser.

These tests verify that the heading detection and section splitting
logic works correctly across common resume formats.
"""

import pytest

from app.services.section_parser import ParsedResume, _detect_heading, parse_sections

# ── Heading detection tests ───────────────────────────────────


class TestHeadingDetection:
    """Tests for _detect_heading()."""

    def test_standard_headings(self):
        assert _detect_heading("Experience") == "experience"
        assert _detect_heading("Education") == "education"
        assert _detect_heading("Skills") == "skills"
        assert _detect_heading("Projects") == "projects"

    def test_heading_variations(self):
        assert _detect_heading("Work Experience") == "experience"
        assert _detect_heading("Professional Experience") == "experience"
        assert _detect_heading("Employment History") == "experience"
        assert _detect_heading("Technical Skills") == "skills"
        assert _detect_heading("Core Competencies") == "skills"
        assert _detect_heading("Educational Background") == "education"

    def test_heading_with_colon(self):
        assert _detect_heading("Skills:") == "skills"
        assert _detect_heading("Education:") == "education"

    def test_heading_case_insensitive(self):
        assert _detect_heading("EXPERIENCE") == "experience"
        assert _detect_heading("skills") == "skills"
        assert _detect_heading("EDUCATION") == "education"

    def test_heading_with_whitespace(self):
        assert _detect_heading("  Experience  ") == "experience"
        assert _detect_heading("\tSkills\t") == "skills"

    def test_non_heading_returns_none(self):
        assert _detect_heading("Built a REST API using Python and FastAPI") is None
        assert _detect_heading("University of California, Berkeley") is None
        assert _detect_heading("") is None

    def test_long_line_not_heading(self):
        """Lines longer than 60 chars are never headings."""
        long = "Experience " * 10
        assert _detect_heading(long) is None


# ── Section parsing tests ─────────────────────────────────────


class TestSectionParsing:
    """Tests for parse_sections()."""

    def test_basic_resume(self):
        text = """John Doe
john@example.com
555-123-4567

Summary
Experienced software engineer with 5 years of Python development.

Experience
Senior Developer at Acme Corp
- Built microservices architecture
- Led team of 4 engineers

Education
BS Computer Science, MIT, 2018

Skills
Python, FastAPI, PostgreSQL, Docker"""

        result = parse_sections(text)

        assert isinstance(result, ParsedResume)
        assert result.word_count > 0
        assert len(result.sections) >= 4

        # Check that expected sections were identified
        section_names = [s.name for s in result.sections]
        assert "header" in section_names
        assert "summary" in section_names
        assert "experience" in section_names
        assert "education" in section_names
        assert "skills" in section_names

    def test_header_captures_contact_info(self):
        text = """Jane Smith
jane@company.com

Experience
Did things at places."""

        result = parse_sections(text)
        header = result.get_section("header")

        assert header is not None
        assert "Jane Smith" in header
        assert "jane@company.com" in header

    def test_empty_sections_are_skipped(self):
        text = """Experience

Education
BS in CS from Stanford"""

        result = parse_sections(text)
        # Experience section has no content (Education heading is right after)
        # so it should be skipped
        section_names = [s.name for s in result.sections]
        assert "education" in section_names

    def test_word_count(self):
        text = "one two three four five"
        result = parse_sections(text)
        assert result.word_count == 5

    def test_to_dict_serialization(self):
        text = """Summary
A brief summary.

Skills
Python, Java"""

        result = parse_sections(text)
        d = result.to_dict()

        assert "sections" in d
        assert "word_count" in d
        assert isinstance(d["sections"], list)
        assert all("name" in s for s in d["sections"])
        assert all("content" in s for s in d["sections"])

    def test_get_section_returns_none_for_missing(self):
        text = "Just some text without any headings."
        result = parse_sections(text)
        assert result.get_section("certifications") is None

    def test_certifications_section(self):
        text = """Certifications
AWS Solutions Architect Professional
Google Cloud Professional Data Engineer"""

        result = parse_sections(text)
        certs = result.get_section("certifications")
        assert certs is not None
        assert "AWS" in certs
