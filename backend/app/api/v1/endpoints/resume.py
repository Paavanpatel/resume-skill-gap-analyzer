"""
Resume upload and parsing endpoints.

POST /api/v1/resume/upload   -- Upload a resume file (PDF/DOCX)
GET  /api/v1/resume/{id}     -- Get a parsed resume by ID
GET  /api/v1/resume/         -- List user's resumes

Error handling: Route handlers don't construct error responses manually.
They call services that raise AppError subclasses, which the global
exception handlers (error_handlers.py) convert to consistent JSON.
The only validation here is input bounds (pagination limits).

Note: Auth is stubbed with a hardcoded user ID until Phase 7.
In production, user_id comes from the JWT token via get_current_user.
"""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.db.session import get_db_session, get_read_db_session
from app.models.analysis import Analysis
from app.models.user import User
from app.repositories.resume_repo import ResumeRepository
from app.schemas.resume import PaginatedResumeResponse, ResumeParseResponse, ResumeUploadResponse
from app.services.file_storage import delete_file, save_upload
from app.services.file_validator import validate_upload
from app.services.resume_parser import parse_resume_content

router = APIRouter()

# Pagination bounds to prevent abuse
MAX_PAGE_SIZE = 100


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and parse a resume",
    responses={
        400: {"description": "Invalid file (wrong type, too large, corrupted)"},
        422: {"description": "Could not extract text from the file"},
        500: {"description": "Storage or server error"},
    },
)
async def upload_resume(
    user: CurrentUser,
    file: UploadFile = File(..., description="PDF or DOCX resume file"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Upload a resume file, validate it, extract text, and parse into sections.

    The response includes the resume ID which is needed for subsequent
    analysis endpoints (Phase 5+).

    Errors are raised as exceptions and handled globally -- no manual
    HTTPException construction needed here.
    """
    # 1. Validate the file (raises FileUploadError on failure)
    validation = await validate_upload(file)

    # 2. Read file content
    file_content = await file.read()
    await file.seek(0)

    # 3. Store the file (raises StorageError on failure)
    file_path = await save_upload(
        file_content=file_content,
        user_id=str(user.id),
        original_filename=file.filename or "unnamed",
    )

    # 4. Parse the resume (raises ParsingError on failure)
    parsed = await parse_resume_content(
        file_content=file_content,
        file_type=validation.file_type,
        filename=file.filename or "unnamed",
    )

    # 5. Save to database
    repo = ResumeRepository(session)
    resume = await repo.create(
        user_id=user.id,
        original_filename=file.filename or "unnamed",
        file_path=file_path,
        file_type=validation.file_type,
        file_size_bytes=validation.file_size,
        raw_text=parsed.raw_text,
        parsed_sections=json.dumps(parsed.to_dict()),
    )

    return resume


@router.get(
    "/{resume_id}",
    response_model=ResumeParseResponse,
    summary="Get a parsed resume by ID",
    responses={
        404: {"description": "Resume not found"},
    },
)
async def get_resume(
    resume_id: UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_read_db_session),
):
    """Fetch a resume's parsed content by its ID."""
    repo = ResumeRepository(session)
    resume = await repo.get_by_id(resume_id)

    if resume is None or str(resume.user_id) != str(user.id):
        raise NotFoundError(
            message="Resume not found.",
            resource_type="resume",
            resource_id=str(resume_id),
        )

    # Convert stored JSON string back to dict for the response
    sections = None
    if resume.parsed_sections:
        try:
            sections = json.loads(resume.parsed_sections)
        except json.JSONDecodeError:
            sections = None

    return ResumeParseResponse(
        id=resume.id,
        original_filename=resume.original_filename,
        raw_text=resume.raw_text or "",
        parsed_sections=sections,
        word_count=len((resume.raw_text or "").split()),
    )


@router.delete(
    "/{resume_id}",
    status_code=204,
    summary="Delete a resume",
    responses={
        409: {"description": "Resume has an analysis currently processing"},
    },
)
async def delete_resume(
    resume_id: UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Delete a resume and all its associated analyses.

    Returns 409 if any linked analysis is actively processing. The
    physical file is deleted from storage after the DB row is removed.
    Cascade on the ORM relationship removes all child analyses.
    """
    repo = ResumeRepository(session)
    resume = await repo.get_by_id(resume_id)

    if resume is None or str(resume.user_id) != str(user.id):
        raise NotFoundError(
            message="Resume not found.",
            resource_type="resume",
            resource_id=str(resume_id),
        )

    # Block deletion if any analysis is mid-flight
    result = await session.execute(
        select(Analysis)
        .where(Analysis.resume_id == resume_id)
        .where(Analysis.status == "processing")
        .limit(1)
    )
    if result.scalar_one_or_none() is not None:
        raise ConflictError(
            "This resume has an analysis currently processing. "
            "Please wait for it to complete before deleting the resume."
        )

    file_path = resume.file_path
    await repo.delete(resume_id)

    # Best-effort file deletion (don't fail the request if the file is missing)
    try:
        await delete_file(file_path)
    except Exception:
        pass

    return Response(status_code=204)


@router.get(
    "/",
    response_model=PaginatedResumeResponse,
    summary="List uploaded resumes",
)
async def list_resumes(
    user: CurrentUser,
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=MAX_PAGE_SIZE, description="Max records to return"),
    session: AsyncSession = Depends(get_read_db_session),
):
    """
    List unique resumes for the current user, newest first.

    Duplicates (same filename) are collapsed — only the most recent
    upload per filename is returned.

    Pagination params are validated via Query constraints:
    - skip must be >= 0
    - limit must be between 1 and 100
    FastAPI's built-in validation handles out-of-range values automatically.
    """
    repo = ResumeRepository(session)
    resumes = await repo.get_by_user(
        user_id=user.id,
        skip=skip,
        limit=limit,
    )
    total = await repo.count_unique_by_user(user_id=user.id)
    return PaginatedResumeResponse(
        resumes=resumes, total=total, skip=skip, limit=limit
    )
