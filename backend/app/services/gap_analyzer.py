"""
Gap analysis service -- the core of Phase 6.

Takes the ExtractionResult from Phase 5 and produces deeper analysis:
1. Category-level skill breakdown (where are you strong/weak?)
2. Score explanation (human-readable breakdown of how scores were computed)

This module contains pure functions that take extraction data in and
return analysis data out. No DB access, no LLM calls -- just computation.
This makes it fast, deterministic, and trivially testable.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.skill_extractor import ExtractionResult
from app.services.skill_normalizer import NormalizedSkill

# ── Data structures ──────────────────────────────────────────────


@dataclass
class CategoryBreakdown:
    """Skill gap analysis for a single category (e.g., 'programming_language')."""

    category: str
    display_name: str
    total_job_skills: int
    matched_count: int
    missing_count: int
    match_percentage: float
    matched_skills: list[str]
    missing_skills: list[str]
    priority: str  # "critical", "important", "nice_to_have"

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "display_name": self.display_name,
            "total_job_skills": self.total_job_skills,
            "matched_count": self.matched_count,
            "missing_count": self.missing_count,
            "match_percentage": self.match_percentage,
            "matched_skills": self.matched_skills,
            "missing_skills": self.missing_skills,
            "priority": self.priority,
        }


@dataclass
class ScoreExplanation:
    """Human-readable explanation of how scores were computed."""

    match_score: float
    ats_score: float
    match_summary: str
    ats_summary: str
    strengths: list[str]
    weaknesses: list[str]
    overall_verdict: str  # "strong_match", "moderate_match", "weak_match", "poor_match"
    missing_required_count: int = (
        0  # Number of missing required skills (may cap verdict)
    )

    def to_dict(self) -> dict:
        return {
            "match_score": self.match_score,
            "ats_score": self.ats_score,
            "match_summary": self.match_summary,
            "ats_summary": self.ats_summary,
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "overall_verdict": self.overall_verdict,
            "missing_required_count": self.missing_required_count,
        }


@dataclass
class GapAnalysisResult:
    """Complete output from the gap analysis pipeline."""

    category_breakdowns: list[CategoryBreakdown]
    score_explanation: ScoreExplanation

    def to_dict(self) -> dict:
        return {
            "category_breakdowns": [c.to_dict() for c in self.category_breakdowns],
            "score_explanation": self.score_explanation.to_dict(),
        }


# ── Category display names ──────────────────────────────────────

CATEGORY_DISPLAY_NAMES = {
    "programming_language": "Programming Languages",
    "framework": "Frameworks & Libraries",
    "database": "Databases",
    "devops": "DevOps & Cloud",
    "tool": "Tools & Platforms",
    "soft_skill": "Soft Skills",
    "methodology": "Methodologies",
    "data_science": "Data Science & ML",
    "security": "Security",
    "testing": "Testing & QA",
    "design": "Design",
    "other": "Other",
}


# ── Category breakdown ──────────────────────────────────────────


def compute_category_breakdowns(
    extraction: ExtractionResult,
) -> list[CategoryBreakdown]:
    """
    Break down the skill match by category.

    Groups all job skills by their category, then for each category computes
    how many the candidate matched vs missed. This tells the user exactly
    where they're strong and where they need improvement.

    Categories are sorted by priority: critical gaps first, strengths last.
    """
    if not extraction.job_skills:
        return []

    # Group job skills by category
    job_by_cat: dict[str, list[NormalizedSkill]] = {}
    for skill in extraction.job_skills:
        cat = skill.category or "other"
        job_by_cat.setdefault(cat, []).append(skill)

    # Build a set of matched skill names for O(1) lookup
    matched_names = {s.name.lower() for s in extraction.matched_skills}

    breakdowns = []
    for category, job_skills in job_by_cat.items():
        matched = [s for s in job_skills if s.name.lower() in matched_names]
        missing = [s for s in job_skills if s.name.lower() not in matched_names]

        total = len(job_skills)
        match_pct = round((len(matched) / total) * 100, 1) if total > 0 else 0.0

        # Determine priority based on gap severity and skill importance
        priority = _category_priority(matched, missing)

        breakdowns.append(
            CategoryBreakdown(
                category=category,
                display_name=CATEGORY_DISPLAY_NAMES.get(
                    category, category.replace("_", " ").title()
                ),
                total_job_skills=total,
                matched_count=len(matched),
                missing_count=len(missing),
                match_percentage=match_pct,
                matched_skills=[s.name for s in matched],
                missing_skills=[s.name for s in missing],
                priority=priority,
            )
        )

    # Sort: critical gaps first, then important, then nice_to_have
    priority_order = {"critical": 0, "important": 1, "nice_to_have": 2}
    breakdowns.sort(key=lambda b: (priority_order.get(b.priority, 3), -b.missing_count))

    return breakdowns


def _category_priority(
    matched: list[NormalizedSkill],
    missing: list[NormalizedSkill],
) -> str:
    """
    Determine how critical a category gap is.

    Rules:
    - critical: >50% of skills missing AND at least one required skill missing
    - important: some missing skills (but mostly matched) OR missing non-required
    - nice_to_have: all matched, or only low-weight skills missing
    """
    if not missing:
        return "nice_to_have"

    total = len(matched) + len(missing)  # >= 1 since missing is non-empty
    missing_pct = len(missing) / total

    has_required_missing = any(s.required is True for s in missing)
    avg_missing_weight = sum(s.weight for s in missing) / len(missing)

    # Critical: majority of skills missing AND required skills in the gap
    if missing_pct >= 0.5 and has_required_missing:
        return "critical"
    if has_required_missing or avg_missing_weight >= 1.5:
        return "important"
    return "nice_to_have"


# ── Score explanation ────────────────────────────────────────────


def explain_scores(
    match_score: float,
    ats_score: float,
    extraction: ExtractionResult,
) -> ScoreExplanation:
    """
    Generate a human-readable explanation of the scores.

    This transforms raw numbers into actionable text the user can
    understand without knowing the scoring formula.
    """
    # Match score explanation
    total_job = len(extraction.job_skills)
    total_matched = len(extraction.matched_skills)

    match_summary = (
        f"Your resume matches {total_matched} of {total_job} skills "
        f"from the job description ({match_score:.0f}% weighted match). "
    )
    if match_score >= 80:
        match_summary += (
            "This is a strong match — you meet most of the core requirements."
        )
    elif match_score >= 60:
        match_summary += "This is a moderate match — you have a solid foundation but some gaps to address."
    elif match_score >= 40:
        match_summary += "This is a partial match — significant upskilling or experience may be needed."
    else:
        match_summary += "This is a weak match — consider roles that better align with your current skills, or plan for significant development."

    # ATS score explanation
    ats_summary = (
        f"ATS keyword match: {total_matched}/{total_job} skills ({ats_score:.0f}%). "
    )
    if ats_score >= 70:
        ats_summary += "Your resume should pass most ATS keyword filters."
    elif ats_score >= 50:
        ats_summary += "Your resume may get filtered by stricter ATS systems. Adding missing keywords could help."
    else:
        ats_summary += "Your resume is likely to be filtered by ATS. Consider adding more matching keywords."

    # Strengths (categories where you have 100% match)
    strengths = _identify_strengths(extraction)

    # Weaknesses (missing required skills)
    weaknesses = _identify_weaknesses(extraction)

    # Overall verdict (may be capped if required skills are missing)
    missing_required_count = sum(
        1 for s in extraction.missing_skills if s.required is True
    )
    verdict = _overall_verdict(match_score, ats_score, missing_required_count)

    if missing_required_count >= 2:
        skill_word = "skills" if missing_required_count != 1 else "skill"
        weaknesses.append(
            f"Missing {missing_required_count} required {skill_word} — verdict capped to {verdict}"
        )
    elif missing_required_count == 1:
        weaknesses.append("Missing 1 required skill — verdict capped to moderate_match")

    return ScoreExplanation(
        match_score=match_score,
        ats_score=ats_score,
        match_summary=match_summary,
        ats_summary=ats_summary,
        strengths=strengths,
        weaknesses=weaknesses,
        overall_verdict=verdict,
        missing_required_count=missing_required_count,
    )


def _identify_strengths(extraction: ExtractionResult) -> list[str]:
    """Find the candidate's key strengths relative to the job."""
    strengths = []

    # High-confidence, high-weight matched skills
    strong_matches = [
        s for s in extraction.matched_skills if s.confidence >= 0.8 and s.weight >= 1.5
    ]
    if strong_matches:
        names = ", ".join(s.name for s in strong_matches[:5])
        strengths.append(f"Strong in core skills: {names}")

    # Categories where 100% is matched
    matched_names = {s.name.lower() for s in extraction.matched_skills}
    cats: dict[str, dict] = {}
    for s in extraction.job_skills:
        cat = s.category or "other"
        cats.setdefault(cat, {"total": 0, "matched": 0})
        cats[cat]["total"] += 1
        if s.name.lower() in matched_names:
            cats[cat]["matched"] += 1

    for cat, counts in cats.items():
        if counts["total"] >= 2 and counts["matched"] == counts["total"]:
            display = CATEGORY_DISPLAY_NAMES.get(cat, cat.replace("_", " ").title())
            strengths.append(f"Full coverage in {display}")

    # Resume has extra relevant skills beyond what the job asked for
    job_names = {s.name.lower() for s in extraction.job_skills}
    extra_relevant = [
        s
        for s in extraction.resume_skills
        if s.name.lower() not in job_names and s.in_taxonomy and s.weight >= 1.5
    ]
    if extra_relevant:
        names = ", ".join(s.name for s in extra_relevant[:3])
        strengths.append(f"Additional valuable skills: {names}")

    return strengths[:5]  # Cap at 5


def _identify_weaknesses(extraction: ExtractionResult) -> list[str]:
    """Find the candidate's key weaknesses relative to the job."""
    weaknesses = []

    # Missing required skills (most critical)
    required_missing = [s for s in extraction.missing_skills if s.required is True]
    if required_missing:
        names = ", ".join(s.name for s in required_missing[:5])
        weaknesses.append(f"Missing required skills: {names}")

    # Missing high-weight skills (even if not explicitly required)
    heavy_missing = [
        s
        for s in extraction.missing_skills
        if s.weight >= 2.0 and s.required is not True
    ]
    if heavy_missing:
        names = ", ".join(s.name for s in heavy_missing[:3])
        weaknesses.append(f"Missing high-impact skills: {names}")

    # Categories with zero matches
    matched_names = {s.name.lower() for s in extraction.matched_skills}
    cats: dict[str, dict] = {}
    for s in extraction.job_skills:
        cat = s.category or "other"
        cats.setdefault(cat, {"total": 0, "matched": 0})
        cats[cat]["total"] += 1
        if s.name.lower() in matched_names:
            cats[cat]["matched"] += 1

    for cat, counts in cats.items():
        if counts["total"] >= 2 and counts["matched"] == 0:
            display = CATEGORY_DISPLAY_NAMES.get(cat, cat.replace("_", " ").title())
            weaknesses.append(
                f"No coverage in {display} ({counts['total']} skills needed)"
            )

    return weaknesses[:5]  # Cap at 5


def _overall_verdict(
    match_score: float,
    ats_score: float,
    missing_required_count: int = 0,
) -> str:
    """
    Compute an overall verdict combining both scores.

    The match score is weighted more heavily (70%) because it reflects
    actual skill depth, while ATS (30%) reflects keyword presence.

    Missing required skills cap the verdict regardless of numeric score:
    - >= 2 missing required skills: capped at "weak_match"
    - == 1 missing required skill:  capped at "moderate_match"
    """
    combined = (match_score * 0.7) + (ats_score * 0.3)

    if combined >= 75:
        raw = "strong_match"
    elif combined >= 55:
        raw = "moderate_match"
    elif combined >= 35:
        raw = "weak_match"
    else:
        raw = "poor_match"

    if missing_required_count >= 2:
        verdict_rank = {
            "strong_match": 3,
            "moderate_match": 2,
            "weak_match": 1,
            "poor_match": 0,
        }
        cap = "weak_match"
        return cap if verdict_rank[raw] > verdict_rank[cap] else raw
    if missing_required_count == 1:
        verdict_rank = {
            "strong_match": 3,
            "moderate_match": 2,
            "weak_match": 1,
            "poor_match": 0,
        }
        cap = "moderate_match"
        return cap if verdict_rank[raw] > verdict_rank[cap] else raw

    return raw


# ── Main entry point ─────────────────────────────────────────────


def analyze_gap(
    extraction: ExtractionResult,
    match_score: float,
    ats_score: float,
) -> GapAnalysisResult:
    """
    Run the full gap analysis on extraction results.

    This is the main entry point for Phase 6 gap analysis. It takes the
    Phase 5 extraction output plus computed scores and produces
    category breakdowns and score explanations.

    Args:
        extraction: The ExtractionResult from Phase 5.
        match_score: Weighted match score (0-100).
        ats_score: ATS keyword score (0-100).

    Returns:
        GapAnalysisResult with breakdowns and explanations.
    """
    breakdowns = compute_category_breakdowns(extraction)
    explanation = explain_scores(match_score, ats_score, extraction)

    return GapAnalysisResult(
        category_breakdowns=breakdowns,
        score_explanation=explanation,
    )
