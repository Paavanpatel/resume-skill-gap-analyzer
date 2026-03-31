"""
Analysis endpoints for skill gap analysis.

Endpoints:
  POST /analysis/{resume_id}  -- Submit a new analysis (async via Celery)
  GET  /analysis/{analysis_id} -- Get analysis result
  GET  /analysis/{analysis_id}/status -- Poll analysis progress
  GET  /analysis/              -- List user's analyses (paginated)

The submit endpoint creates an Analysis record, dispatches a Celery task,
and returns immediately with a job_id and status_url. The client then
polls the status endpoint (or listens via WebSocket in a future phase)
until the analysis completes.

Why async? Skill extraction involves 2+ LLM API calls that take 5-15
seconds total. Blocking the HTTP request for that long is bad UX and
ties up a worker thread.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.tier_guard import enforce_analysis_quota
from app.db.session import get_db_session, get_read_db_session
from app.models.analysis import Analysis
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.resume_repo import ResumeRepository
from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    AnalysisHistoryItem,
    AnalysisHistoryResponse,
    AnalysisStatusResponse,
    AnalysisSubmitResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/{resume_id}",
    response_model=AnalysisSubmitResponse,
    status_code=202,
    summary="Submit a new skill gap analysis",
)
async def submit_analysis(
    resume_id: UUID,
    request: AnalysisRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Start an async skill gap analysis for a resume + job description.

    Creates an Analysis record with status='queued' and dispatches a
    Celery task to process it. Returns immediately with a job_id for
    polling.

    The resume must exist and belong to the current user. The job
    description must be 50-10000 characters (validated by Pydantic).
    """
    # Verify the resume exists and belongs to this user
    resume_repo = ResumeRepository(session)
    resume = await resume_repo.get_by_id(resume_id)

    if resume is None:
        raise NotFoundError(
            message="Resume not found. Upload a resume first.",
            resource_type="resume",
        )

    if str(resume.user_id) != str(user.id):
        raise NotFoundError(
            message="Resume not found.",
            resource_type="resume",
        )

    # Verify the resume has been parsed
    if not resume.raw_text or len(resume.raw_text.strip()) < 50:
        raise ValidationError(
            message="This resume hasn't been parsed yet or contains too little text. "
                    "Please re-upload.",
        )

    # Enforce monthly analysis quota before accepting the job
    await enforce_analysis_quota(user, session)

    # Stamp resume as recently used (for ResumePicker ordering)
    await resume_repo.update(resume_id, last_used_at=datetime.now(timezone.utc))

    # Create the analysis record
    analysis_repo = AnalysisRepository(session)
    analysis = await analysis_repo.create(
        user_id=user.id,
        resume_id=resume_id,
        job_title=request.job_title,
        job_description=request.job_description,
        job_company=request.job_company,
        status="queued",
    )

    await session.flush()  # Ensure the ID is generated

    # Increment usage counter for this billing period
    from app.services.usage_service import increment_analysis_count
    await increment_analysis_count(user_id=str(user.id), session=session)

    # Dispatch Celery task
    try:
        from app.workers.analysis_task import run_skill_gap_analysis
        run_skill_gap_analysis.delay(str(analysis.id))
        logger.info("Dispatched analysis task for %s", analysis.id)
    except Exception as e:
        # Celery unavailable -- log and continue. The analysis stays
        # in 'queued' state and can be picked up later, or we could
        # fall back to sync processing here.
        logger.warning(
            "Failed to dispatch Celery task for analysis %s: %s. "
            "Analysis will remain queued until a worker picks it up.",
            analysis.id,
            str(e)[:200],
        )

    return AnalysisSubmitResponse(
        job_id=analysis.id,
        status="queued",
        estimated_seconds=15,
        status_url=f"/api/v1/analysis/{analysis.id}/status",
        ws_url=f"/ws/analysis/{analysis.id}",
    )


@router.get(
    "/{analysis_id}/status",
    response_model=AnalysisStatusResponse,
    summary="Poll analysis progress",
)
async def get_analysis_status(
    analysis_id: UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_read_db_session),
):
    """
    Check the current status of an analysis.

    Returns the status, progress percentage, and current processing step.
    The client should poll this every 2-3 seconds until status is
    'completed' or 'failed'.
    """
    analysis_repo = AnalysisRepository(session)
    analysis = await analysis_repo.get_by_id(analysis_id)

    if analysis is None or str(analysis.user_id) != str(user.id):
        raise NotFoundError(
            message="Analysis not found.",
            resource_type="analysis",
        )

    # Map status to progress percentage and step description
    status_map = {
        "queued": (0, "Waiting in queue"),
        "processing": (50, "Extracting skills and computing scores"),
        "completed": (100, "Analysis complete"),
        "failed": (0, "Analysis failed"),
    }

    progress, step = status_map.get(analysis.status, (0, "Unknown"))

    return AnalysisStatusResponse(
        job_id=analysis.id,
        status=analysis.status,
        progress=progress,
        current_step=step,
        error_message=analysis.error_message if analysis.status == "failed" else None,
    )


@router.get(
    "/history",
    response_model=AnalysisHistoryResponse,
    summary="List past analyses",
)
async def list_analyses(
    user: CurrentUser,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_read_db_session),
):
    """
    Get paginated history of the current user's analyses.

    Returns newest first with summary info (scores, job title, status).
    """
    analysis_repo = AnalysisRepository(session)

    analyses = await analysis_repo.get_by_user(
        user_id=user.id,
        skip=page * per_page,
        limit=per_page,
    )
    total = await analysis_repo.count_by_user(user.id)

    return AnalysisHistoryResponse(
        analyses=[
            AnalysisHistoryItem(
                id=a.id,
                job_title=a.job_title,
                job_company=a.job_company,
                match_score=a.match_score,
                ats_score=a.ats_score,
                status=a.status,
                created_at=a.created_at,
            )
            for a in analyses
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Get full analysis result",
)
async def get_analysis(
    analysis_id: UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_read_db_session),
):
    """
    Get the complete analysis result including scores, skills, and suggestions.

    Returns 404 if the analysis doesn't exist. If the analysis is still
    processing, it returns the current state (scores will be null).
    """
    analysis_repo = AnalysisRepository(session)
    analysis = await analysis_repo.get_by_id(analysis_id)

    if analysis is None or str(analysis.user_id) != str(user.id):
        raise NotFoundError(
            message="Analysis not found.",
            resource_type="analysis",
        )

    return AnalysisResponse(
        id=analysis.id,
        status=analysis.status,
        match_score=analysis.match_score,
        ats_score=analysis.ats_score,
        matched_skills=analysis.matched_skills or [],
        missing_skills=analysis.missing_skills or [],
        resume_skills=analysis.resume_skills or [],
        job_skills=analysis.job_skills or [],
        suggestions=analysis.suggestions or [],
        category_breakdowns=analysis.category_breakdowns or [],
        score_explanation=analysis.score_explanation,
        ats_check=analysis.ats_check,
        processing_time_ms=analysis.processing_time_ms,
        ai_provider=analysis.ai_provider,
        ai_model=analysis.ai_model,
        ai_tokens_used=analysis.ai_tokens_used,
        created_at=analysis.created_at,
    )


@router.delete(
    "/{analysis_id}",
    status_code=204,
    summary="Delete an analysis",
    responses={
        409: {"description": "Analysis is currently processing and cannot be deleted"},
    },
)
async def delete_analysis(
    analysis_id: UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Delete an analysis record and its associated roadmap.

    Returns 409 if the analysis is actively processing (to prevent
    deleting a job that Celery is mid-flight on). Cascade is handled
    by the ORM relationship (roadmap deleted automatically).
    """
    analysis_repo = AnalysisRepository(session)
    analysis = await analysis_repo.get_by_id(analysis_id)

    if analysis is None or str(analysis.user_id) != str(user.id):
        raise NotFoundError(
            message="Analysis not found.",
            resource_type="analysis",
        )

    if analysis.status == "processing":
        raise ConflictError(
            "This analysis is currently processing and cannot be deleted. "
            "Please wait for it to complete or fail."
        )

    await analysis_repo.delete(analysis_id)
    return Response(status_code=204)


MAX_RETRIES = 3


@router.post(
    "/{analysis_id}/retry",
    response_model=AnalysisSubmitResponse,
    status_code=202,
    summary="Retry a failed analysis",
    responses={
        409: {"description": "Analysis is not in a retryable state (must be failed or queued) or max retries exceeded"},
    },
)
async def retry_analysis(
    analysis_id: UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Re-queue a failed or stuck queued analysis for reprocessing.

    Analyses with status='failed' or status='queued' (stuck/never picked up)
    can be retried. Maximum 3 retries per analysis. On retry, status is
    reset to 'queued' and a new Celery task is dispatched.
    """
    analysis_repo = AnalysisRepository(session)
    analysis = await analysis_repo.get_by_id(analysis_id)

    if analysis is None or str(analysis.user_id) != str(user.id):
        raise NotFoundError(
            message="Analysis not found.",
            resource_type="analysis",
        )

    if analysis.status not in ("failed", "queued"):
        raise ConflictError(
            f"Only failed or stuck queued analyses can be retried. Current status: {analysis.status}."
        )

    if analysis.retry_count >= MAX_RETRIES:
        raise ConflictError(
            f"This analysis has already been retried {analysis.retry_count} time(s). "
            f"Maximum of {MAX_RETRIES} retries allowed."
        )

    # Reset to queued and increment retry counter
    await analysis_repo.update(
        analysis_id,
        status="queued",
        error_message=None,
        retry_count=analysis.retry_count + 1,
    )

    # Re-dispatch the Celery task
    try:
        from app.workers.analysis_task import run_skill_gap_analysis
        run_skill_gap_analysis.delay(str(analysis_id))
        logger.info("Re-dispatched analysis task for %s (retry %d)", analysis_id, analysis.retry_count + 1)
    except Exception as e:
        logger.warning(
            "Failed to dispatch Celery retry task for analysis %s: %s",
            analysis_id,
            str(e)[:200],
        )

    return AnalysisSubmitResponse(
        job_id=analysis_id,
        status="queued",
        estimated_seconds=15,
        status_url=f"/api/v1/analysis/{analysis_id}/status",
        ws_url=f"/ws/analysis/{analysis_id}",
    )
