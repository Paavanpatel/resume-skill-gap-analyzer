"""
Analysis service -- orchestrates the full skill gap analysis pipeline.

This is the "glue" that connects all Phase 5 and Phase 6 components into
a single workflow. It's called by the Celery task (async) or directly.

Pipeline:
1. Load the resume's parsed text from DB
2. Load the skill taxonomy from DB (cached)
3. Run skill extraction (resume + job description -> LLM -> normalize)
4. Compute match score from extraction results
5. Run gap analysis (category breakdowns, score explanations)
6. Run ATS formatting checks on the parsed resume structure
7. Generate improvement suggestions (rule-based + LLM-powered)
8. Store everything in the Analysis record

The service is stateless -- all state lives in the database. This makes
it safe to retry failed analyses and scale horizontally.
"""

import json
import logging
import time
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.websockets import publish_progress
from app.core.exceptions import NotFoundError, ParsingError
from app.models.analysis import Analysis
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.resume_repo import ResumeRepository
from app.repositories.skill_repo import SkillRepository
from app.repositories.user_repo import UserRepository
from app.services.ats_checker import check_ats_compatibility
from app.services.gap_analyzer import analyze_gap
from app.services.section_parser import ParsedResume, parse_sections
from app.services.skill_extractor import ExtractionResult, extract_skills
from app.services.skill_normalizer import build_taxonomy_index
from app.services.suggestion_engine import generate_suggestions

logger = logging.getLogger(__name__)

# Redis caching constants
TAXONOMY_CACHE_KEY = "taxonomy:all"
TAXONOMY_CACHE_TTL = 3600  # 1 hour


async def _load_taxonomy(
    session: AsyncSession, redis_client: aioredis.Redis | None = None
) -> list:
    """
    Load the skill taxonomy from the database and convert to lookup format.

    Uses Redis caching with 1-hour TTL for performance. Falls back gracefully
    to direct DB loading if Redis is unavailable.

    Args:
        session: Active database session.
        redis_client: Optional Redis client for caching (passed from dependency).

    Returns:
        Taxonomy index (list of TaxonomyEntry dicts).
    """
    # Try to get from Redis cache
    if redis_client is not None:
        try:
            cached = await redis_client.get(TAXONOMY_CACHE_KEY)
            if cached:
                logger.debug("Loaded taxonomy from Redis cache")
                return json.loads(cached)
        except Exception as e:
            logger.warning("Redis taxonomy cache fetch failed: %s", str(e)[:200])
            # Fall through to DB load

    # Cache miss or Redis unavailable -- load from DB
    skill_repo = SkillRepository(session)
    raw_skills = await skill_repo.get_all(skip=0, limit=1000)

    # Convert ORM objects to dicts for build_taxonomy_index
    skills_data = []
    for skill in raw_skills:
        skills_data.append(
            {
                "name": skill.name,
                "category": skill.category,
                "weight": getattr(skill, "weight", 1.0),
                "aliases": getattr(skill, "aliases", []) or [],
            }
        )

    taxonomy = build_taxonomy_index(skills_data)

    # Store in Redis cache for next time
    if redis_client is not None:
        try:
            await redis_client.setex(
                TAXONOMY_CACHE_KEY,
                TAXONOMY_CACHE_TTL,
                json.dumps(taxonomy),
            )
            logger.debug("Cached taxonomy in Redis for %d seconds", TAXONOMY_CACHE_TTL)
        except Exception as e:
            logger.warning("Redis taxonomy cache store failed: %s", str(e)[:200])
            # Graceful degradation -- cache store failure is non-fatal

    return taxonomy


def _compute_match_score(result: ExtractionResult) -> float:
    """
    Compute a weighted match score from extraction results.

    The score considers:
    - How many job skills the candidate has (base match)
    - Skill weights from the taxonomy (higher-weight skills matter more)
    - LLM-assigned confidence (required skills score higher than implied ones)

    Effective weight formula:
        effective_weight = skill.weight * skill.confidence

    Examples:
    - Required (confidence=0.95) + taxonomy weight 2.0 → effective 1.9
    - Preferred (confidence=0.7) + taxonomy weight 1.5 → effective 1.05
    - Implied (confidence=0.4) + off-taxonomy default weight 1.0 → effective 0.4

    For off-taxonomy skills (weight defaults to 1.0) this means confidence
    alone drives importance, which correctly prioritises "must-haves" the LLM
    identified with high certainty over vague implied skills.

    Score formula:
        matched_effective / total_effective * 100

    This gives a 0-100 percentage where:
    - 100 = candidate has every skill the job asks for
    - 0 = no overlap at all
    """
    if not result.job_skills:
        return 0.0

    total_weight = sum(s.weight * s.confidence for s in result.job_skills)
    if total_weight == 0:
        return 0.0

    matched_weight = sum(s.weight * s.confidence for s in result.matched_skills)
    score = (matched_weight / total_weight) * 100

    return round(min(score, 100.0), 1)


def _compute_ats_score(result: ExtractionResult) -> float:
    """
    Compute a simplified ATS (Applicant Tracking System) compatibility score.

    ATS systems typically do keyword matching, so this score focuses on
    exact skill name matches without weighting. It's simpler than match_score
    on purpose -- it approximates what a basic ATS would see.

    Score = (matched_count / total_job_skills) * 100

    A real ATS also checks formatting, section headers, dates, etc.
    We'll add those signals in a later phase.
    """
    if not result.job_skills:
        return 0.0

    total = len(result.job_skills)
    matched = len(result.matched_skills)

    score = (matched / total) * 100
    return round(min(score, 100.0), 1)


async def run_analysis(
    analysis_id: UUID,
    session: AsyncSession,
    redis_client: aioredis.Redis | None = None,
) -> Analysis:
    """
    Execute the full analysis pipeline for a queued analysis record.

    This is the main entry point called by the Celery task. The Analysis
    record must already exist in the database with status='queued'.

    Flow:
    1. Load the analysis record -> update status to 'processing'
    2. Load the associated resume's parsed text
    3. Load skill taxonomy (with Redis caching)
    4. Run skill extraction (parallel LLM calls)
    5. Compute scores
    6. Store results -> update status to 'completed'

    If anything fails, status is set to 'failed' with the error message.

    Args:
        analysis_id: UUID of the existing Analysis record.
        session: Active database session (caller manages commit/rollback).
        redis_client: Optional Redis client for caching (gracefully degraded if None).

    Returns:
        The updated Analysis record.

    Raises:
        NotFoundError: If the analysis or its resume doesn't exist.
        ParsingError: If skill extraction fails (LLM issues).
    """
    start_time = time.perf_counter()

    analysis_repo = AnalysisRepository(session)
    resume_repo = ResumeRepository(session)

    # 1. Load and validate the analysis record
    analysis = await analysis_repo.get_by_id(analysis_id)
    if analysis is None:
        raise NotFoundError(
            message=f"Analysis {analysis_id} not found",
            resource_type="analysis",
        )

    # Update status to processing
    await analysis_repo.update(analysis_id, status="processing")
    await session.flush()  # Make status visible to polling queries

    # Publish initial progress via WebSocket
    await publish_progress(
        redis_client,
        str(analysis_id),
        status="processing",
        progress=0,
        current_step="Parsing resume",
    )

    try:
        # 2. Load the resume's parsed text
        resume = await resume_repo.get_by_id(analysis.resume_id)
        if resume is None:
            raise NotFoundError(
                message="Associated resume not found",
                resource_type="resume",
            )

        resume_text = resume.raw_text
        if not resume_text or len(resume_text.strip()) < 50:
            raise ParsingError(
                message="Resume text is too short for meaningful analysis. "
                "Please upload a resume with more content.",
            )

        # 3. Load skill taxonomy (with Redis caching)
        taxonomy = await _load_taxonomy(session, redis_client)

        # Publish: parsing done, extracting skills
        await publish_progress(
            redis_client,
            str(analysis_id),
            status="processing",
            progress=25,
            current_step="Extracting skills",
        )

        logger.info(
            "Starting skill extraction for analysis %s (resume=%s, taxonomy_size=%d)",
            analysis_id,
            analysis.resume_id,
            len(taxonomy),
        )

        # 4. Run skill extraction (Phase 5)
        extraction = await extract_skills(
            resume_text=resume_text,
            job_description=analysis.job_description,
            taxonomy=taxonomy,
        )

        # 5. Compute scores (Phase 5)
        match_score = _compute_match_score(extraction)
        ats_score = _compute_ats_score(extraction)

        # Publish: extraction done, matching and scoring
        await publish_progress(
            redis_client,
            str(analysis_id),
            status="processing",
            progress=50,
            current_step="Matching skills and scoring",
        )

        # 6. Run gap analysis (Phase 6)
        gap_result = analyze_gap(extraction, match_score, ats_score)

        # 7. Run ATS formatting checks (Phase 6)
        # Use stored parsed_sections from upload to avoid double-parsing and
        # ensure consistency (the upload and analysis always use the same parse).
        # Fall back to re-parsing for legacy records that pre-date this field.
        if resume.parsed_sections:
            parsed_resume = ParsedResume.from_dict(json.loads(resume.parsed_sections))
        else:
            parsed_resume = parse_sections(resume_text)
        ats_result = check_ats_compatibility(parsed_resume)

        # Publish: gap analysis done, generating suggestions
        await publish_progress(
            redis_client,
            str(analysis_id),
            status="processing",
            progress=75,
            current_step="Generating suggestions and insights",
        )

        # 8. Generate improvement suggestions (Phase 6)
        # Gate LLM suggestions behind paid tiers to avoid token spend on free users
        user_repo = UserRepository(session)
        user = await user_repo.get_by_id(analysis.user_id)
        include_llm = user is not None and user.tier != "free"

        suggestions = await generate_suggestions(
            parsed_resume=parsed_resume,
            job_description=analysis.job_description,
            match_score=match_score,
            extraction=extraction,
            gap_analysis=gap_result,
            ats_check=ats_result,
            include_llm=include_llm,
        )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # 9. Store all results
        skill_data = extraction.to_dict()

        update_data = {
            "status": "completed",
            "match_score": match_score,
            "ats_score": ats_score,
            "resume_skills": skill_data["resume_skills"],
            "job_skills": skill_data["job_skills"],
            "matched_skills": skill_data["matched_skills"],
            "missing_skills": skill_data["missing_skills"],
            "suggestions": suggestions,
            "category_breakdowns": [
                b.to_dict() for b in gap_result.category_breakdowns
            ],
            "score_explanation": gap_result.score_explanation.to_dict(),
            "ats_check": ats_result.to_dict(),
            "ai_provider": extraction.provider,
            "ai_model": extraction.model,
            "ai_tokens_used": extraction.total_tokens,
            "processing_time_ms": elapsed_ms,
            "error_message": None,
        }

        updated_analysis = await analysis_repo.update(analysis_id, **update_data)

        # Publish completion via WebSocket
        await publish_progress(
            redis_client,
            str(analysis_id),
            status="completed",
            progress=100,
            current_step="Analysis complete",
        )

        logger.info(
            "Analysis %s completed: match=%.1f%%, ats=%.1f%%, format=%.1f%%, "
            "skills=%d/%d matched, suggestions=%d, time=%dms, tokens=%d, provider=%s",
            analysis_id,
            match_score,
            ats_score,
            ats_result.format_score,
            len(extraction.matched_skills),
            len(extraction.job_skills),
            len(suggestions),
            elapsed_ms,
            extraction.total_tokens,
            extraction.provider,
        )

        return updated_analysis

    except Exception as e:
        # Mark analysis as failed with error details
        error_msg = str(e)[:500]  # Truncate for storage
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        await analysis_repo.update(
            analysis_id,
            status="failed",
            error_message=error_msg,
            processing_time_ms=elapsed_ms,
        )

        # Publish failure via WebSocket
        await publish_progress(
            redis_client,
            str(analysis_id),
            status="failed",
            progress=0,
            current_step="Analysis failed",
            error_message=error_msg,
        )

        logger.error(
            "Analysis %s failed after %dms: %s",
            analysis_id,
            elapsed_ms,
            error_msg,
        )

        raise
