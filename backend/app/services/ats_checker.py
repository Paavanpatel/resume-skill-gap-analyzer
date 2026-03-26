"""
ATS (Applicant Tracking System) formatting checker.

Scans the resume's parsed structure for common ATS pitfalls. Real ATS
systems (Taleo, Greenhouse, Lever, Workday) are primarily keyword
matchers, but they also penalize resumes that:
- Are missing standard section headings (ATS can't categorize the content)
- Are too short or too long (heuristic for quality)
- Lack contact information (can't reach the candidate)
- Have unusual formatting cues in the text

This module is purely structural analysis -- it checks the parsed resume
(from Phase 4's section parser), not the skill match (that's in Phase 5/6).
The output complements the skill-based ATS score with formatting advice.

Each check returns a list of ATSIssue objects with severity, description,
and a concrete fix. The frontend renders these as a checklist.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.section_parser import ParsedResume


@dataclass
class ATSIssue:
    """A single ATS compatibility issue found in the resume."""
    severity: str  # "error", "warning", "info"
    category: str  # "structure", "content", "formatting", "contact"
    title: str
    description: str
    fix: str

    def to_dict(self) -> dict:
        return {
            "severity": self.severity,
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "fix": self.fix,
        }


@dataclass
class ATSCheckResult:
    """Complete ATS check output."""
    issues: list[ATSIssue]
    format_score: float  # 0-100, purely structural (not skill-based)
    passed_checks: int
    total_checks: int

    def to_dict(self) -> dict:
        return {
            "issues": [i.to_dict() for i in self.issues],
            "format_score": self.format_score,
            "passed_checks": self.passed_checks,
            "total_checks": self.total_checks,
        }


# ── Individual checks ────────────────────────────────────────────


def _check_essential_sections(resume: ParsedResume) -> list[ATSIssue]:
    """
    Check for sections that ATS systems expect to find.

    Most ATS systems look for Experience, Education, and Skills sections
    by name. Missing these means the ATS can't categorize your content,
    which often leads to lower ranking or rejection.
    """
    issues = []
    section_names = {s.name for s in resume.sections}

    essential = {
        "experience": (
            "error",
            "Missing 'Experience' section",
            "ATS systems look for a clearly labeled Experience or Work History section "
            "to identify your professional background.",
            "Add a section titled 'Experience' or 'Work Experience' with your job history.",
        ),
        "education": (
            "warning",
            "Missing 'Education' section",
            "Most ATS systems expect an Education section. Without it, your "
            "qualifications may not be parsed correctly.",
            "Add a section titled 'Education' listing your degrees and institutions.",
        ),
        "skills": (
            "warning",
            "Missing 'Skills' section",
            "A dedicated Skills section helps ATS systems match your resume "
            "to job requirements via keyword matching.",
            "Add a section titled 'Skills' or 'Technical Skills' with a list of your key competencies.",
        ),
    }

    for section_key, (severity, title, desc, fix) in essential.items():
        if section_key not in section_names:
            issues.append(ATSIssue(
                severity=severity,
                category="structure",
                title=title,
                description=desc,
                fix=fix,
            ))

    return issues


_EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_PATTERN = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?"               # Optional country code (1-3 digits)
    r"(?:\(?\d{2,4}\)?[-.\s]?)"              # Area code (2-4 digits)
    r"\d{3,4}[-.\s]?\d{3,4}"                # Number
)


def _check_contact_info(resume: ParsedResume) -> list[ATSIssue]:
    """
    Check for basic contact information in the resume.

    ATS systems extract email and phone to create candidate profiles.
    Missing contact info means the recruiter can't reach you even if
    your resume scores well.
    """
    issues = []
    full_text = resume.raw_text

    if not _EMAIL_PATTERN.search(full_text):
        issues.append(ATSIssue(
            severity="error",
            category="contact",
            title="No email address found",
            description="ATS systems extract your email to create a candidate profile. "
                        "Without it, recruiters cannot contact you.",
            fix="Add your professional email address near the top of your resume.",
        ))

    if not _PHONE_PATTERN.search(full_text):
        issues.append(ATSIssue(
            severity="warning",
            category="contact",
            title="No phone number found",
            description="Most ATS systems expect a phone number for the candidate profile.",
            fix="Add your phone number near the top of your resume.",
        ))

    return issues


def _check_resume_length(resume: ParsedResume) -> list[ATSIssue]:
    """
    Check if the resume is an appropriate length.

    Too short suggests missing content; too long suggests it needs editing.
    Most ATS and recruiter guidelines suggest 1-2 pages (400-1200 words).
    """
    issues = []
    wc = resume.word_count

    if wc < 150:
        issues.append(ATSIssue(
            severity="error",
            category="content",
            title=f"Resume is very short ({wc} words)",
            description="Resumes under 150 words lack the detail ATS systems need "
                        "for effective keyword matching. This often results in low match scores.",
            fix="Expand your resume with more detail about your experience, projects, and skills. "
                "Aim for 400-800 words.",
        ))
    elif wc < 300:
        issues.append(ATSIssue(
            severity="warning",
            category="content",
            title=f"Resume may be too short ({wc} words)",
            description="Short resumes provide fewer keyword matching opportunities. "
                        "Consider adding more detail.",
            fix="Add quantifiable achievements, project descriptions, or expand your skills section. "
                "Aim for 400-800 words.",
        ))
    elif wc > 1500:
        issues.append(ATSIssue(
            severity="warning",
            category="content",
            title=f"Resume may be too long ({wc} words)",
            description="Very long resumes can dilute keyword density and are harder "
                        "for recruiters to scan quickly.",
            fix="Consider condensing to 1-2 pages. Focus on the most relevant and recent experience.",
        ))

    return issues


def _check_summary_section(resume: ParsedResume) -> list[ATSIssue]:
    """
    Check for a professional summary or objective.

    While not required by ATS, a summary section provides concentrated
    keywords near the top of the resume, which many ATS systems weight
    more heavily.
    """
    issues = []
    section_names = {s.name for s in resume.sections}

    if "summary" not in section_names:
        issues.append(ATSIssue(
            severity="info",
            category="structure",
            title="No summary or objective section",
            description="A professional summary at the top of your resume provides "
                        "concentrated keywords that ATS systems often weight more heavily.",
            fix="Add a 2-3 sentence 'Professional Summary' section at the top of your resume "
                "highlighting your key qualifications for the target role.",
        ))

    return issues


def _check_formatting_issues(resume: ParsedResume) -> list[ATSIssue]:
    """
    Check for text patterns that suggest ATS-unfriendly formatting.

    ATS systems process plain text, so certain formatting artifacts
    (excessive special characters, table-like layouts, headers/footers)
    can confuse the parser.
    """
    issues = []
    text = resume.raw_text

    # Check for excessive special characters (sign of table/column layout)
    special_char_ratio = len(re.findall(r"[|│┃┆┊╎]", text)) / max(len(text), 1)
    if special_char_ratio > 0.01:
        issues.append(ATSIssue(
            severity="warning",
            category="formatting",
            title="Possible table or column layout detected",
            description="ATS systems often misparse multi-column or table-based layouts, "
                        "scrambling your content.",
            fix="Use a single-column resume layout. Avoid tables, text boxes, and multi-column formatting.",
        ))

    # Check for excessive bullet characters that might indicate parsing issues
    bullet_chars = len(re.findall(r"[●◆◇■□▪▫★☆►▸‣⁃]", text))
    if bullet_chars > 30:
        issues.append(ATSIssue(
            severity="info",
            category="formatting",
            title="Non-standard bullet characters detected",
            description="Some ATS systems don't recognize fancy bullet characters and may "
                        "display them as garbled text.",
            fix="Use standard bullet characters (• or -) or plain dashes instead of special Unicode bullets.",
        ))

    # Check for lines that look like page headers/footers
    lines = text.split("\n")
    page_pattern = re.compile(r"^\s*(?:page\s*\d+|^\d+\s*$|\d+\s*/\s*\d+)", re.IGNORECASE)
    page_markers = sum(1 for line in lines if page_pattern.match(line.strip()))
    if page_markers >= 2:
        issues.append(ATSIssue(
            severity="info",
            category="formatting",
            title="Page number artifacts detected",
            description="Page numbers embedded in the text can confuse ATS parsers.",
            fix="Remove page numbers from your resume. They're unnecessary for digital submissions.",
        ))

    return issues


def _check_date_formats(resume: ParsedResume) -> list[ATSIssue]:
    """
    Check that dates in the experience section are in a parseable format.

    ATS systems extract dates to compute years of experience. Common
    parseable formats: "Jan 2020 - Present", "2019 - 2023", "March 2021".
    Uncommon formats like "Q1 2020" or relative dates like "3 years" are
    harder for ATS to parse.
    """
    issues = []

    exp_content = resume.get_section("experience") or ""
    if not exp_content:
        return issues

    # Look for standard date patterns
    standard_date = re.compile(
        r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}"
        r"|"
        r"\d{1,2}/\d{4}"
        r"|"
        r"\d{4}\s*[-–—]\s*(?:\d{4}|[Pp]resent|[Cc]urrent)",
        re.IGNORECASE,
    )

    if not standard_date.search(exp_content):
        issues.append(ATSIssue(
            severity="warning",
            category="content",
            title="No recognizable dates in Experience section",
            description="ATS systems extract dates to calculate your years of experience. "
                        "Without clear dates, this calculation fails.",
            fix="Include dates in a standard format like 'Jan 2020 - Present' or '2019 - 2023' "
                "for each position.",
        ))

    return issues


# ── Main entry point ─────────────────────────────────────────────


# Total number of checks we run (for the score calculation)
_TOTAL_CHECKS = 8


def check_ats_compatibility(resume: ParsedResume) -> ATSCheckResult:
    """
    Run all ATS compatibility checks on a parsed resume.

    Returns a result with all issues found, a formatting score, and
    pass/fail counts. The formatting score is separate from the
    skill-based ATS score in analysis_service.py -- this one only
    looks at resume structure and formatting.

    Args:
        resume: Parsed resume from the section parser (Phase 4).

    Returns:
        ATSCheckResult with issues, score, and pass/fail stats.
    """
    all_issues: list[ATSIssue] = []

    # Run each check and track which ones produced errors/warnings.
    # A single check function can produce multiple issues (e.g., missing
    # both Experience and Education), but it still counts as one failed check.
    checks_failed = 0

    for check_fn in [
        _check_essential_sections,
        _check_contact_info,
        _check_resume_length,
        _check_summary_section,
        _check_formatting_issues,
        _check_date_formats,
    ]:
        issues = check_fn(resume)
        all_issues.extend(issues)
        if any(i.severity in ("error", "warning") for i in issues):
            checks_failed += 1

    # Compute format score based on issue severity
    # Each error deducts 15 points, warning 8, info 3
    deductions = sum(
        {"error": 15, "warning": 8, "info": 3}.get(i.severity, 0)
        for i in all_issues
    )
    format_score = round(max(0.0, min(100.0, 100.0 - deductions)), 1)

    passed = _TOTAL_CHECKS - checks_failed

    return ATSCheckResult(
        issues=all_issues,
        format_score=format_score,
        passed_checks=max(0, passed),
        total_checks=_TOTAL_CHECKS,
    )
