"""
Skill extraction service -- the core of Phase 5.

Orchestrates the full extraction pipeline:
1. Send resume text to LLM -> get extracted skills
2. Send job description to LLM -> get required skills
3. Normalize both against the skill taxonomy
4. Compare to find matched and missing skills
5. Return structured result for scoring (Phase 6)

The extraction runs two LLM calls in parallel (resume + job description)
to cut wall-clock time roughly in half. Each call is independent -- the
LLM doesn't need the other's output to do its extraction.
"""

import asyncio
import logging
import re
import time
from dataclasses import dataclass

from rapidfuzz import fuzz

from app.core.exceptions import ErrorCode, ParsingError
from app.services.llm_client import LLMResponse, call_llm
from app.services.prompts import (
    SKILL_EXTRACTION_SYSTEM,
    build_job_extraction_prompt,
    build_resume_extraction_prompt,
)
from app.services.skill_normalizer import (
    NormalizedSkill,
    SkillNormalizer,
    TaxonomyEntry,
)

logger = logging.getLogger(__name__)

# Strips dot-separated language suffixes so "React.js" == "React", "Node.js" == "Node".
# Only matches a literal dot followed by the suffix to avoid stripping letters from
# skill names like "TypeScript" or "express".
_TECH_SUFFIX_RE = re.compile(r"\.(js|ts|py|rb|go)$", re.IGNORECASE)


def _strip_tech_suffix(name: str) -> str:
    """Return the lowercased skill name with common dot-extension variants removed."""
    return _TECH_SUFFIX_RE.sub("", name.strip()).lower()


@dataclass
class ExtractionResult:
    """Complete result from the skill extraction pipeline."""

    resume_skills: list[NormalizedSkill]
    job_skills: list[NormalizedSkill]
    matched_skills: list[NormalizedSkill]
    missing_skills: list[NormalizedSkill]
    provider: str
    model: str
    total_tokens: int
    extraction_time_ms: int

    def to_dict(self) -> dict:
        """Serialize for JSON storage in the Analysis JSONB columns."""
        return {
            "resume_skills": [
                {
                    "name": s.name,
                    "confidence": s.confidence,
                    "category": s.category,
                    "source": s.source,
                }
                for s in self.resume_skills
            ],
            "job_skills": [
                {
                    "name": s.name,
                    "confidence": s.confidence,
                    "category": s.category,
                    "source": s.source,
                    "required": s.required,
                }
                for s in self.job_skills
            ],
            "matched_skills": [
                {
                    "name": s.name,
                    "confidence": s.confidence,
                    "category": s.category,
                }
                for s in self.matched_skills
            ],
            "missing_skills": [
                {
                    "name": s.name,
                    "category": s.category,
                    "weight": s.weight,
                    "required": s.required,
                    "priority": _compute_priority(s),
                }
                for s in self.missing_skills
            ],
        }

    @classmethod
    def from_analysis(cls, analysis) -> "ExtractionResult":
        """
        Reconstruct an ExtractionResult from a completed Analysis model.

        Used by Phase 9 endpoints (roadmap, advisor) that need to rebuild
        the extraction data from what's stored in the JSONB columns.
        """

        def _to_skills(
            raw: list | None, source: str = "resume"
        ) -> list[NormalizedSkill]:
            if not raw:
                return []
            skills = []
            for s in raw:
                if not isinstance(s, dict):
                    continue
                skills.append(
                    NormalizedSkill(
                        name=s.get("name", ""),
                        category=s.get("category", "general"),
                        confidence=float(s.get("confidence", 0.8)),
                        weight=float(s.get("weight", 1.0)),
                        in_taxonomy=True,
                        source=s.get("source", source),
                        required=s.get("required"),
                    )
                )
            return skills

        return cls(
            resume_skills=_to_skills(analysis.resume_skills, "resume"),
            job_skills=_to_skills(analysis.job_skills, "job_description"),
            matched_skills=_to_skills(analysis.matched_skills, "resume"),
            missing_skills=_to_skills(analysis.missing_skills, "job_description"),
            provider=analysis.ai_provider or "unknown",
            model=analysis.ai_model or "unknown",
            total_tokens=analysis.ai_tokens_used or 0,
            extraction_time_ms=0,
        )


def _compute_priority(skill: NormalizedSkill) -> str:
    """
    Assign a priority label based on weight and whether the skill is required.

    Priority rules:
    - HIGH: Required skills with weight >= 2.0 (core tech stack)
    - MEDIUM: Required skills with lower weight, or preferred skills with high weight
    - LOW: Everything else (nice-to-have, low-weight tools)
    """
    is_required = skill.required is True
    if is_required and skill.weight >= 2.0:
        return "high"
    if is_required or skill.weight >= 1.5:
        return "medium"
    return "low"


async def _extract_skills_from_text(
    text: str,
    prompt_builder: callable,
    source: str,
) -> tuple[list[dict], LLMResponse]:
    """
    Send text to the LLM and parse the skill extraction response.

    Args:
        text: Resume text or job description.
        prompt_builder: Function that wraps text into the extraction prompt.
        source: "resume" or "job_description" (for logging).

    Returns:
        Tuple of (raw skill dicts from LLM, LLM response metadata).
    """
    prompt = prompt_builder(text)
    messages = [{"role": "user", "content": prompt}]

    response = await call_llm(
        messages=messages,
        system_prompt=SKILL_EXTRACTION_SYSTEM,
        temperature=0.1,  # Low temperature for consistent structured output
        max_tokens=4096,
    )

    data = response.parse_json()
    raw_skills = data.get("skills")

    # Validate response structure -- LLM might return null or wrong type
    if not isinstance(raw_skills, list):
        logger.warning(
            "LLM returned non-list 'skills' field from %s: %s",
            source,
            type(raw_skills).__name__,
        )
        raw_skills = []

    skills = raw_skills

    logger.info(
        "Extracted %d skills from %s (provider=%s, tokens=%d)",
        len(skills),
        source,
        response.provider,
        response.total_tokens,
    )

    return skills, response


async def extract_skills(
    resume_text: str,
    job_description: str,
    taxonomy: list[TaxonomyEntry],
) -> ExtractionResult:
    """
    Run the full skill extraction pipeline.

    This is the main entry point for Phase 5. It:
    1. Extracts skills from resume and job description in parallel
    2. Normalizes both sets against the taxonomy
    3. Computes matched and missing skills

    Args:
        resume_text: Parsed resume text from Phase 4.
        job_description: Raw job description from the user.
        taxonomy: Preloaded skill taxonomy entries.

    Returns:
        ExtractionResult with all skill data and metadata.

    Raises:
        ParsingError: If the LLM returns unusable output.
    """
    start_time = time.perf_counter()

    # Run both extractions in parallel -- they're independent
    try:
        resume_task = _extract_skills_from_text(
            text=resume_text,
            prompt_builder=build_resume_extraction_prompt,
            source="resume",
        )
        job_task = _extract_skills_from_text(
            text=job_description,
            prompt_builder=build_job_extraction_prompt,
            source="job_description",
        )

        (
            (raw_resume_skills, resume_response),
            (raw_job_skills, job_response),
        ) = await asyncio.gather(resume_task, job_task)
    except Exception as e:
        from app.core.exceptions import AppError

        if isinstance(e, AppError):  # Already a typed application error
            raise
        raise ParsingError(
            message=f"Skill extraction failed: {str(e)[:200]}",
            error_code=ErrorCode.AI_PROVIDER_ERROR,
        ) from e

    # Normalize against taxonomy
    normalizer = SkillNormalizer(taxonomy)
    resume_skills = normalizer.normalize(raw_resume_skills, source="resume")
    job_skills = normalizer.normalize(raw_job_skills, source="job_description")

    # Compare: find matches and gaps.
    # Three-pass matching:
    #   1. Exact (case-insensitive) canonical name match.
    #   2. Suffix match: strip dot-extensions (.js, .ts, …) so that
    #      off-taxonomy variants like "React.js" / "React" are treated as equal.
    #   3. Fuzzy match: token_sort_ratio >= 88 catches variants like
    #      "TensorFlow 2" / "TensorFlow" or "ML" / "Machine Learning".
    _FUZZY_THRESHOLD = 88
    resume_skill_names = {s.name.lower() for s in resume_skills}
    resume_skill_names_stripped = {_strip_tech_suffix(s.name) for s in resume_skills}

    matched_skills = []
    missing_skills = []
    for s in job_skills:
        job_lower = s.name.lower()
        if job_lower in resume_skill_names:
            matched_skills.append(s)
        elif _strip_tech_suffix(s.name) in resume_skill_names_stripped:
            matched_skills.append(s)
        elif any(
            fuzz.token_sort_ratio(job_lower, r) >= _FUZZY_THRESHOLD
            for r in resume_skill_names
        ):
            matched_skills.append(s)
        else:
            missing_skills.append(s)

    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
    total_tokens = resume_response.total_tokens + job_response.total_tokens

    logger.info(
        "Skill extraction complete: %d resume skills, %d job skills, "
        "%d matched, %d missing (time=%dms, tokens=%d)",
        len(resume_skills),
        len(job_skills),
        len(matched_skills),
        len(missing_skills),
        elapsed_ms,
        total_tokens,
    )

    return ExtractionResult(
        resume_skills=resume_skills,
        job_skills=job_skills,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        provider=resume_response.provider,
        model=resume_response.model,
        total_tokens=total_tokens,
        extraction_time_ms=elapsed_ms,
    )
