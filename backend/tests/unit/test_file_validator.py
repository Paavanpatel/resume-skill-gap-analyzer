"""
Tests for file validation service.

These tests verify that the upload validator correctly accepts
valid files and rejects invalid ones (wrong type, too large, bad magic bytes).
Now tests check for FileUploadError exceptions instead of result objects.
"""

from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ErrorCode, FileUploadError
from app.services.file_validator import (
    FileValidationResult,
    _get_extension,
    validate_upload,
)

# ── Extension extraction ──────────────────────────────────────


class TestGetExtension:
    def test_pdf(self):
        assert _get_extension("resume.pdf") == "pdf"

    def test_docx(self):
        assert _get_extension("resume.docx") == "docx"

    def test_uppercase(self):
        assert _get_extension("Resume.PDF") == "pdf"

    def test_no_extension(self):
        assert _get_extension("resume") is None

    def test_double_extension(self):
        assert _get_extension("resume.backup.pdf") == "pdf"


# ── Upload validation ─────────────────────────────────────────


def _make_upload_file(
    filename: str,
    content: bytes,
    content_type: str = "application/octet-stream",
):
    """Create a mock UploadFile for testing."""
    mock_file = AsyncMock()
    mock_file.filename = filename
    mock_file.content_type = content_type
    mock_file.read = AsyncMock(return_value=content)
    mock_file.seek = AsyncMock()
    return mock_file


class TestValidateUpload:
    @pytest.mark.asyncio
    async def test_valid_pdf(self):
        content = b"%PDF-1.4 some pdf content here"
        file = _make_upload_file("resume.pdf", content)

        result = await validate_upload(file)

        assert result.file_type == "pdf"
        assert result.file_size == len(content)

    @pytest.mark.asyncio
    async def test_valid_docx(self):
        content = b"PK\x03\x04" + b"\x00" * 100
        file = _make_upload_file("resume.docx", content)

        result = await validate_upload(file)

        assert result.file_type == "docx"

    @pytest.mark.asyncio
    async def test_reject_unsupported_extension(self):
        file = _make_upload_file("resume.txt", b"some text")

        with pytest.raises(FileUploadError) as exc_info:
            await validate_upload(file)

        assert exc_info.value.error_code == ErrorCode.FILE_TYPE_NOT_ALLOWED
        assert "Unsupported file type" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_reject_empty_file(self):
        file = _make_upload_file("empty.pdf", b"")

        with pytest.raises(FileUploadError) as exc_info:
            await validate_upload(file)

        assert exc_info.value.error_code == ErrorCode.FILE_EMPTY

    @pytest.mark.asyncio
    async def test_reject_wrong_magic_bytes(self):
        """A .pdf file that's actually a ZIP (wrong magic bytes)."""
        content = b"PK\x03\x04 this is actually a zip"
        file = _make_upload_file("sneaky.pdf", content)

        with pytest.raises(FileUploadError) as exc_info:
            await validate_upload(file)

        assert exc_info.value.error_code == ErrorCode.FILE_CORRUPTED

    @pytest.mark.asyncio
    async def test_reject_oversized_file(self):
        """File exceeding MAX_UPLOAD_SIZE_MB."""
        content = b"%PDF" + b"\x00" * (11 * 1024 * 1024)
        file = _make_upload_file("huge.pdf", content)

        with pytest.raises(FileUploadError) as exc_info:
            await validate_upload(file)

        assert exc_info.value.error_code == ErrorCode.FILE_TOO_LARGE
        assert exc_info.value.details["max_size_mb"] == 10

    @pytest.mark.asyncio
    async def test_reject_no_filename(self):
        """File without a filename."""
        file = _make_upload_file("", b"%PDF some content")

        with pytest.raises(FileUploadError) as exc_info:
            await validate_upload(file)

        assert exc_info.value.error_code == ErrorCode.VALIDATION_ERROR
