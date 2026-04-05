"""
File validation service for resume uploads.

Validates uploaded files on three levels:
1. Extension check  -- only .pdf and .docx allowed
2. Size check       -- enforced against MAX_UPLOAD_SIZE_MB
3. Magic bytes      -- verifies actual file content matches claimed type

Why magic bytes? Because a file extension is just a label. Someone could rename
malware.exe to resume.pdf and the extension check would pass. Magic bytes are
the first few bytes of a file that identify its actual format, regardless of
what the filename says. This is our main defense against disguised uploads.

This module raises FileUploadError on validation failure rather than returning
a result object. This means the caller doesn't need to check is_valid -- if
validate_upload returns, the file is valid.
"""

import logging
from dataclasses import dataclass

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.exceptions import ErrorCode, FileUploadError

logger = logging.getLogger(__name__)

# Magic byte signatures for supported file types.
# PDF always starts with "%PDF". DOCX is a ZIP archive, so it starts
# with the ZIP magic bytes (PK\x03\x04).
MAGIC_BYTES = {
    "pdf": b"%PDF",
    "docx": b"PK\x03\x04",
}

ALLOWED_EXTENSIONS = {"pdf", "docx"}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    # Some systems report these MIME types instead
    "application/x-pdf",
    "application/octet-stream",  # generic fallback, still validated by magic bytes
}


@dataclass
class FileValidationResult:
    """Outcome of a successful file validation."""

    file_type: str
    file_size: int


def _get_extension(filename: str) -> str | None:
    """Extract lowercase extension without the dot."""
    if "." not in filename:
        return None
    return filename.rsplit(".", 1)[-1].lower()


async def validate_upload(file: UploadFile) -> FileValidationResult:
    """
    Run all validation checks on an uploaded file.

    Reads the file once into memory (bounded by MAX_UPLOAD_SIZE_MB + 1 MB
    to catch oversized files). Raises FileUploadError on the first failure.

    Returns:
        FileValidationResult with file_type and file_size on success.

    Raises:
        FileUploadError: With a specific error code for each failure type.
    """
    settings = get_settings()
    max_bytes = (settings.max_upload_size_mb + 1) * 1024 * 1024

    # 1. Filename presence check
    filename = file.filename or ""
    if not filename:
        raise FileUploadError(
            message="No filename provided.",
            error_code=ErrorCode.VALIDATION_ERROR,
        )

    # 2. Extension check
    extension = _get_extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise FileUploadError(
            message=f"Unsupported file type '.{extension}'. Only PDF and DOCX files are accepted.",
            error_code=ErrorCode.FILE_TYPE_NOT_ALLOWED,
            details={
                "allowed_types": sorted(ALLOWED_EXTENSIONS),
                "received": extension,
            },
        )

    # 3. Read content (bounded read to prevent memory exhaustion)
    content = await file.read(max_bytes)
    file_size = len(content)

    # 4. Size check
    size_limit = settings.max_upload_size_mb * 1024 * 1024
    if file_size > size_limit:
        raise FileUploadError(
            message=f"File exceeds the {settings.max_upload_size_mb} MB size limit.",
            error_code=ErrorCode.FILE_TOO_LARGE,
            details={
                "max_size_mb": settings.max_upload_size_mb,
                "received_size_mb": round(file_size / (1024 * 1024), 2),
            },
        )

    if file_size == 0:
        raise FileUploadError(
            message="Uploaded file is empty.",
            error_code=ErrorCode.FILE_EMPTY,
        )

    # 5. Magic bytes -- does the actual content match what the extension claims?
    expected_magic = MAGIC_BYTES.get(extension, b"")
    if not content[: len(expected_magic)] == expected_magic:
        logger.warning(
            "Magic byte mismatch for '%s': expected %s, got %s",
            filename,
            expected_magic.hex(),
            content[:8].hex(),
        )
        raise FileUploadError(
            message="File content does not match its extension. The file may be corrupted or disguised.",
            error_code=ErrorCode.FILE_CORRUPTED,
        )

    # Reset the file cursor so downstream code can read it again
    await file.seek(0)

    logger.info("Validated upload: %s (%s, %d bytes)", filename, extension, file_size)

    return FileValidationResult(
        file_type=extension,
        file_size=file_size,
    )
