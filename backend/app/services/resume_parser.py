"""
Resume parsing orchestrator.

This is the top-level service that coordinates the full parsing pipeline:
  1. Extract raw text (PDF or DOCX extractor)
  2. Sanitize the text (strip junk, check for injection)
  3. Parse into sections (heading detection)
  4. Persist to database (via repository)

Called from the API endpoint (sync upload) or Celery task (async re-parse).
"""

import json
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ErrorCode, ParsingError
from app.models.resume import Resume
from app.repositories.resume_repo import ResumeRepository
from app.services.docx_extractor import DOCXExtractionError, extract_text_from_docx
from app.services.pdf_extractor import PDFExtractionError, extract_text_from_pdf
from app.services.section_parser import ParsedResume, parse_sections
from app.services.text_sanitizer import sanitize_text

logger = logging.getLogger(__name__)


async def parse_resume_content(
    file_content: bytes,
    file_type: str,
    filename: str,
) -> ParsedResume:
    """
    Run the extraction + sanitization + section parsing pipeline.

    This is a pure function (no DB side effects) so it can be used
    both in the upload flow and for re-parsing existing files.

    Args:
        file_content: Raw file bytes.
        file_type: "pdf" or "docx".
        filename: Original filename for logging.

    Returns:
        ParsedResume with sections and metadata.

    Raises:
        ParsingError: If extraction or parsing fails.
    """
    # Step 1: Extract raw text based on file type
    try:
        if file_type == "pdf":
            raw_text = extract_text_from_pdf(file_content)
        elif file_type == "docx":
            raw_text = extract_text_from_docx(file_content)
        else:
            raise ParsingError(
                message=f"Unsupported file type: {file_type}",
                error_code=ErrorCode.PARSE_FAILED,
                details={"file_type": file_type},
            )
    except (PDFExtractionError, DOCXExtractionError) as e:
        logger.warning("Text extraction failed for '%s': %s", filename, e)
        raise ParsingError(
            message=str(e),
            error_code=ErrorCode.PARSE_FAILED,
            details={"filename": filename, "file_type": file_type},
        ) from e

    # Step 2: Sanitize extracted text
    clean_text = sanitize_text(raw_text, source_filename=filename)

    if not clean_text:
        raise ParsingError(
            message="No usable text found after cleaning. The resume may be an image-only document.",
            error_code=ErrorCode.NO_TEXT_EXTRACTED,
            details={"filename": filename},
        )

    # Step 3: Parse into sections
    parsed = parse_sections(clean_text)

    logger.info(
        "Parsed resume '%s': %d sections, %d words",
        filename,
        len(parsed.sections),
        parsed.word_count,
    )

    return parsed


async def parse_and_persist(
    resume_id: UUID,
    file_content: bytes,
    file_type: str,
    filename: str,
    session: AsyncSession,
) -> Resume:
    """
    Parse a resume and save the results to the database.

    Updates the Resume record with raw_text and parsed_sections.
    The session is managed by the caller (the API dependency or Celery task).

    Args:
        resume_id: ID of the existing Resume record.
        file_content: Raw file bytes.
        file_type: "pdf" or "docx".
        filename: Original filename.
        session: Active DB session.

    Returns:
        Updated Resume model instance.

    Raises:
        ParsingError: If parsing fails.
        NotFoundError: If the resume record is not found.
    """
    from app.core.exceptions import NotFoundError

    repo = ResumeRepository(session)

    resume = await repo.get_by_id(resume_id)
    if resume is None:
        raise NotFoundError(
            message="Resume not found.",
            resource_type="resume",
            resource_id=str(resume_id),
        )

    parsed = await parse_resume_content(file_content, file_type, filename)

    # Persist parsed data
    updated = await repo.update(
        resume_id,
        raw_text=parsed.raw_text,
        parsed_sections=json.dumps(parsed.to_dict()),
    )

    logger.info("Saved parsed content for resume %s", resume_id)
    return updated
