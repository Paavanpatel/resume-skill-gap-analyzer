"""
Insights endpoints -- Phase 9 (roadmap, advisor, PDF export).

These endpoints build on a completed analysis. They require:
1. The analysis must exist and belong to the current user
2. The analysis must have status='completed'

Endpoints:
  POST /insights/{analysis_id}/roadmap  -- Generate learning roadmap
  GET  /insights/{analysis_id}/roadmap  -- Get existing roadmap
  POST /insights/{analysis_id}/advisor  -- Generate resume rewrites
  GET  /insights/{analysis_id}/export   -- Download PDF report

Why separate from /analysis?
These are optional, more expensive operations (LLM calls, PDF generation)
that the user triggers explicitly after reviewing their analysis. Keeping
them under /insights keeps the /analysis endpoints fast and focused.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.core.exceptions import NotFoundError, ValidationError
from app.core.tier_guard import require_tier
from app.db.session import get_db_session, get_read_db_session
from app.models.analysis import Analysis
from app.models.roadmap import Roadmap
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.resume_repo import ResumeRepository
from app.schemas.advisor import AdvisorResponse
from app.schemas.roadmap import RoadmapResponse

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────


async def _get_completed_analysis(
    analysis_id: UUID,
    user_id: UUID,
    session: AsyncSession,
) -> Analysis:
    """Load an analysis and verify ownership + completion."""
    repo = AnalysisRepository(session)
    analysis = await repo.get_by_id(analysis_id)

    if analysis is None or str(analysis.user_id) != str(user_id):
        raise NotFoundError(
            message="Analysis not found.",
            resource_type="analysis",
        )

    if analysis.status != "completed":
        raise ValidationError(
            message=f"Analysis is '{analysis.status}'. Insights are only "
                    "available for completed analyses.",
        )

    return analysis


# ── Roadmap endpoints ────────────────────────────────────────────


@router.post(
    "/{analysis_id}/roadmap",
    response_model=RoadmapResponse,
    status_code=201,
    summary="Generate a learning roadmap",
)
async def generate_roadmap_endpoint(
    analysis_id: UUID,
    user: CurrentUser,
    _tier: None = Depends(require_tier("pro")),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Generate a personalized learning roadmap for the skill gaps
    identified in this analysis. Uses the LLM to create week-by-week
    learning phases with objectives and resources.

    If a roadmap already exists for this analysis, it's returned as-is.
    Call DELETE first if you want to regenerate.
    """
    analysis = await _get_completed_analysis(analysis_id, user.id, session)

    # Check if roadmap already exists
    result = await session.execute(
        select(Roadmap).where(Roadmap.analysis_id == analysis_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return RoadmapResponse(
            id=existing.id,
            analysis_id=existing.analysis_id,
            total_weeks=existing.total_weeks,
            phases=existing.phases,
        )

    # Build extraction and gap analysis data from stored analysis
    from app.services.roadmap_generator import generate_roadmap
    from app.services.skill_extractor import ExtractionResult
    from app.services.gap_analyzer import analyze_gap

    extraction = ExtractionResult.from_analysis(analysis)
    match_score = analysis.match_score or 0.0
    ats_score = analysis.ats_score or 0.0
    gap_result = analyze_gap(extraction, match_score, ats_score)

    roadmap = await generate_roadmap(
        analysis_id=analysis_id,
        extraction=extraction,
        gap_analysis=gap_result,
        job_description=analysis.job_description,
        session=session,
    )

    await session.commit()

    return RoadmapResponse(
        id=roadmap.id,
        analysis_id=roadmap.analysis_id,
        total_weeks=roadmap.total_weeks,
        phases=roadmap.phases,
    )


@router.get(
    "/{analysis_id}/roadmap",
    response_model=RoadmapResponse,
    summary="Get existing roadmap",
)
async def get_roadmap_endpoint(
    analysis_id: UUID,
    user: CurrentUser,
    _tier: None = Depends(require_tier("pro")),
    session: AsyncSession = Depends(get_read_db_session),
):
    """Get the learning roadmap for a completed analysis. Returns 404 if none exists."""
    await _get_completed_analysis(analysis_id, user.id, session)

    result = await session.execute(
        select(Roadmap).where(Roadmap.analysis_id == analysis_id)
    )
    roadmap = result.scalar_one_or_none()

    if roadmap is None:
        raise NotFoundError(
            message="No roadmap has been generated for this analysis yet. "
                    "POST to generate one.",
            resource_type="roadmap",
        )

    return RoadmapResponse(
        id=roadmap.id,
        analysis_id=roadmap.analysis_id,
        total_weeks=roadmap.total_weeks,
        phases=roadmap.phases,
    )


# ── Resume advisor endpoint ──────────────────────────────────────


@router.post(
    "/{analysis_id}/advisor",
    response_model=AdvisorResponse,
    summary="Generate resume section rewrites",
)
async def generate_advisor_endpoint(
    analysis_id: UUID,
    user: CurrentUser,
    _tier: None = Depends(require_tier("pro")),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Generate AI-powered resume section rewrites tailored to the job.

    Returns rewritten sections (summary, experience, skills) with
    before/after text and explanations of changes. The rewrites
    preserve the candidate's truthful experience while optimizing
    for the target job's keywords and requirements.
    """
    analysis = await _get_completed_analysis(analysis_id, user.id, session)

    # Load the resume text
    resume_repo = ResumeRepository(session)
    resume = await resume_repo.get_by_id(analysis.resume_id)
    if resume is None or not resume.raw_text:
        raise NotFoundError(
            message="Associated resume text not found.",
            resource_type="resume",
        )

    from app.services.resume_advisor import generate_resume_advice
    from app.services.skill_extractor import ExtractionResult
    from app.services.gap_analyzer import analyze_gap

    extraction = ExtractionResult.from_analysis(analysis)
    match_score = analysis.match_score or 0.0
    ats_score = analysis.ats_score or 0.0
    gap_result = analyze_gap(extraction, match_score, ats_score)

    result = await generate_resume_advice(
        resume_text=resume.raw_text,
        job_description=analysis.job_description,
        extraction=extraction,
        gap_analysis=gap_result,
        match_score=match_score,
    )

    # Persist the advisor result to the database
    from app.services.resume_advisor import save_advisor_result
    await save_advisor_result(analysis_id, result, session)
    await session.commit()

    return AdvisorResponse(
        rewrites=[
            {
                "section": r.section,
                "original": r.original,
                "rewritten": r.rewritten,
                "changes_made": r.changes_made,
                "confidence": r.confidence,
            }
            for r in result.rewrites
        ],
        overall_summary=result.overall_summary,
    )


# ── PDF export endpoint ──────────────────────────────────────────


@router.get(
    "/{analysis_id}/export",
    summary="Download PDF report",
    response_class=Response,
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "PDF analysis report",
        }
    },
)
async def export_pdf_endpoint(
    analysis_id: UUID,
    user: CurrentUser,
    _tier: None = Depends(require_tier("pro")),
    session: AsyncSession = Depends(get_read_db_session),
):
    """
    Generate and download a PDF report for a completed analysis.

    The report includes scores, skill gaps, category breakdowns,
    suggestions, and learning roadmap (if generated).
    """
    analysis = await _get_completed_analysis(analysis_id, user.id, session)

    # Build analysis dict for the PDF exporter
    analysis_data = {
        "id": str(analysis.id),
        "job_title": analysis.job_title,
        "job_company": analysis.job_company,
        "match_score": analysis.match_score,
        "ats_score": analysis.ats_score,
        "matched_skills": analysis.matched_skills or [],
        "missing_skills": analysis.missing_skills or [],
        "suggestions": analysis.suggestions or [],
        "category_breakdowns": analysis.category_breakdowns or [],
        "score_explanation": analysis.score_explanation,
        "ats_check": analysis.ats_check,
        "created_at": str(analysis.created_at) if analysis.created_at else None,
    }

    # Check for roadmap
    result = await session.execute(
        select(Roadmap).where(Roadmap.analysis_id == analysis_id)
    )
    roadmap_model = result.scalar_one_or_none()
    roadmap_data = None
    if roadmap_model:
        roadmap_data = {
            "total_weeks": roadmap_model.total_weeks,
            "phases": roadmap_model.phases,
        }

    from app.services.pdf_exporter import generate_pdf_report

    pdf_bytes = generate_pdf_report(
        analysis=analysis_data,
        roadmap=roadmap_data,
    )

    # Build filename
    title_slug = (analysis.job_title or "analysis").replace(" ", "-")[:30]
    filename = f"skillgap-report-{title_slug}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
