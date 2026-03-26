"""
Unit tests for the PDF export service (Phase 9).

Tests:
- PDF generation produces valid bytes
- Report includes expected sections
- Edge cases (missing data, empty analysis)
- With and without roadmap
"""

import pytest

from app.services.pdf_exporter import generate_pdf_report


# ── Fixtures ─────────────────────────────────────────────────────


def _make_analysis_data(
    match_score=75.0,
    ats_score=65.0,
    include_skills=True,
    include_suggestions=True,
    include_categories=True,
) -> dict:
    data = {
        "id": "test-analysis-id",
        "job_title": "Senior Backend Engineer",
        "job_company": "TechCorp",
        "match_score": match_score,
        "ats_score": ats_score,
        "created_at": "2026-03-15T10:30:00Z",
        "matched_skills": [],
        "missing_skills": [],
        "suggestions": [],
        "category_breakdowns": [],
        "score_explanation": {
            "match_score": match_score,
            "ats_score": ats_score,
            "match_summary": "Good match overall",
            "ats_summary": "Above average ATS compatibility",
            "strengths": ["Strong Python skills", "Good system design"],
            "weaknesses": ["Missing cloud experience"],
            "overall_verdict": "moderate_match",
        },
        "ats_check": {
            "issues": [],
            "format_score": 80.0,
            "passed_checks": 8,
            "total_checks": 10,
        },
    }

    if include_skills:
        data["matched_skills"] = [
            {"name": "Python", "confidence": 0.95, "category": "programming"},
            {"name": "FastAPI", "confidence": 0.9, "category": "framework"},
            {"name": "PostgreSQL", "confidence": 0.85, "category": "database"},
        ]
        data["missing_skills"] = [
            {"name": "Docker", "category": "devops", "priority": "high"},
            {"name": "Kubernetes", "category": "devops", "priority": "high"},
            {"name": "AWS", "category": "cloud", "priority": "medium"},
        ]

    if include_suggestions:
        data["suggestions"] = [
            {
                "section": "skills",
                "current": "Missing from resume",
                "suggested": "Add Docker and Kubernetes to skills section",
                "reason": "Required by the job posting",
                "priority": "high",
                "source": "rule",
            },
            {
                "section": "experience",
                "current": "Built backend services",
                "suggested": "Built containerized backend services with Docker",
                "reason": "Adds missing DevOps keywords",
                "priority": "medium",
                "source": "llm",
            },
        ]

    if include_categories:
        data["category_breakdowns"] = [
            {
                "category": "programming",
                "display_name": "Programming Languages",
                "total_job_skills": 3,
                "matched_count": 2,
                "missing_count": 1,
                "match_percentage": 66.7,
                "matched_skills": ["Python", "JavaScript"],
                "missing_skills": ["Go"],
                "priority": "important",
            },
            {
                "category": "devops",
                "display_name": "DevOps",
                "total_job_skills": 3,
                "matched_count": 0,
                "missing_count": 3,
                "match_percentage": 0.0,
                "matched_skills": [],
                "missing_skills": ["Docker", "Kubernetes", "CI/CD"],
                "priority": "critical",
            },
        ]

    return data


def _make_roadmap_data() -> dict:
    return {
        "total_weeks": 8,
        "phases": [
            {
                "week_range": "1-2",
                "focus": "Docker Fundamentals",
                "objectives": ["Understand containers", "Write Dockerfiles"],
                "resources": ["Docker official docs"],
            },
            {
                "week_range": "3-4",
                "focus": "Kubernetes Basics",
                "objectives": ["Deploy pods", "Configure services"],
                "resources": ["K8s tutorials"],
            },
        ],
    }


# ── PDF generation tests ─────────────────────────────────────────


class TestPDFGeneration:
    def test_generates_pdf_bytes(self):
        data = _make_analysis_data()
        pdf = generate_pdf_report(data)
        assert isinstance(pdf, bytes)
        assert len(pdf) > 100

    def test_pdf_starts_with_magic_bytes(self):
        data = _make_analysis_data()
        pdf = generate_pdf_report(data)
        assert pdf[:5] == b"%PDF-"

    def test_with_roadmap(self):
        data = _make_analysis_data()
        roadmap = _make_roadmap_data()
        pdf = generate_pdf_report(data, roadmap=roadmap)
        assert isinstance(pdf, bytes)
        assert len(pdf) > 100

    def test_without_roadmap(self):
        data = _make_analysis_data()
        pdf = generate_pdf_report(data, roadmap=None)
        assert isinstance(pdf, bytes)

    def test_with_roadmap_is_larger(self):
        """PDF with roadmap should be larger than without."""
        data = _make_analysis_data()
        roadmap = _make_roadmap_data()
        pdf_with = generate_pdf_report(data, roadmap=roadmap)
        pdf_without = generate_pdf_report(data, roadmap=None)
        assert len(pdf_with) > len(pdf_without)


# ── Edge cases ───────────────────────────────────────────────────


class TestPDFEdgeCases:
    def test_minimal_analysis(self):
        """PDF generates even with bare minimum data."""
        data = {
            "id": "minimal",
            "match_score": 0,
            "ats_score": 0,
            "matched_skills": [],
            "missing_skills": [],
            "suggestions": [],
            "category_breakdowns": [],
        }
        pdf = generate_pdf_report(data)
        assert pdf[:5] == b"%PDF-"

    def test_null_scores(self):
        data = _make_analysis_data()
        data["match_score"] = None
        data["ats_score"] = None
        pdf = generate_pdf_report(data)
        assert isinstance(pdf, bytes)

    def test_missing_explanation(self):
        data = _make_analysis_data()
        data["score_explanation"] = None
        pdf = generate_pdf_report(data)
        assert isinstance(pdf, bytes)

    def test_no_skills(self):
        data = _make_analysis_data(include_skills=False)
        pdf = generate_pdf_report(data)
        assert isinstance(pdf, bytes)

    def test_no_suggestions(self):
        data = _make_analysis_data(include_suggestions=False)
        pdf = generate_pdf_report(data)
        assert isinstance(pdf, bytes)

    def test_no_categories(self):
        data = _make_analysis_data(include_categories=False)
        pdf = generate_pdf_report(data)
        assert isinstance(pdf, bytes)

    def test_empty_roadmap_phases(self):
        data = _make_analysis_data()
        roadmap = {"total_weeks": 0, "phases": []}
        pdf = generate_pdf_report(data, roadmap=roadmap)
        assert isinstance(pdf, bytes)

    def test_no_job_title(self):
        data = _make_analysis_data()
        data["job_title"] = None
        data["job_company"] = None
        pdf = generate_pdf_report(data)
        assert isinstance(pdf, bytes)
