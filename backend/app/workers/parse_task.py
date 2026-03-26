"""
Celery task for async resume re-parsing.

The primary upload flow is synchronous (upload -> parse -> respond).
This task exists for:
  - Re-parsing existing resumes when the parser improves
  - Bulk processing when many resumes need parsing
  - Retry logic if the initial parse fails transiently

Usage:
  from app.workers.parse_task import reparse_resume
  reparse_resume.delay(str(resume_id))
"""

import asyncio
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="reparse_resume",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def reparse_resume(self, resume_id: str) -> dict:
    """
    Re-parse an existing resume from its stored file.

    This is a sync Celery task that wraps the async parsing pipeline.
    Celery doesn't natively support async tasks, so we run the async
    code in a new event loop.
    """
    try:
        result = asyncio.run(_reparse(resume_id))
        return result
    except Exception as exc:
        logger.error("Failed to reparse resume %s: %s", resume_id, exc)
        raise self.retry(exc=exc)


async def _reparse(resume_id: str) -> dict:
    """Async implementation of the reparse logic."""
    from uuid import UUID

    from app.db.session import WriteSession
    from app.services.file_storage import read_file
    from app.services.resume_parser import parse_and_persist

    async with WriteSession() as session:
        try:
            from app.repositories.resume_repo import ResumeRepository

            repo = ResumeRepository(session)
            resume = await repo.get_by_id(UUID(resume_id))

            if resume is None:
                return {"status": "error", "detail": "Resume not found"}

            # Read the stored file
            file_content = await read_file(resume.file_path)

            # Re-run the full parsing pipeline
            updated = await parse_and_persist(
                resume_id=UUID(resume_id),
                file_content=file_content,
                file_type=resume.file_type,
                filename=resume.original_filename,
                session=session,
            )

            await session.commit()

            return {
                "status": "success",
                "resume_id": resume_id,
                "word_count": len((updated.raw_text or "").split()),
            }
        except Exception:
            await session.rollback()
            raise
