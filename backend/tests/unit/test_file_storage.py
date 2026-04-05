"""
Comprehensive tests for file storage service.

Covers save_upload, read_file, delete_file, filename sanitization,
path traversal prevention, and error handling.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.core.exceptions import StorageError
from app.services.file_storage import (
    _sanitize_filename,
    _verify_path_within_root,
    delete_file,
    read_file,
    save_upload,
)


class TestSanitizeFilename:
    def test_normal_filename(self):
        assert _sanitize_filename("resume.pdf") == "resume.pdf"

    def test_spaces_become_underscores(self):
        result = _sanitize_filename("my resume.pdf")
        assert result == "my_resume.pdf"

    def test_path_traversal_stripped(self):
        """The ../../ attack should be neutralized."""
        result = _sanitize_filename("../../etc/passwd")
        assert ".." not in result
        assert "/" not in result

    def test_directory_prefix_stripped(self):
        result = _sanitize_filename("/uploads/secret/resume.pdf")
        assert result == "resume.pdf"

    def test_special_characters_stripped(self):
        result = _sanitize_filename("résumé<script>.pdf")
        assert "<" not in result
        assert ">" not in result

    def test_hidden_file_dot_stripped(self):
        result = _sanitize_filename(".hidden_file.pdf")
        assert not result.startswith(".")

    def test_empty_becomes_unnamed(self):
        result = _sanitize_filename("")
        assert result == "unnamed_file"

    def test_only_dots_becomes_unnamed(self):
        result = _sanitize_filename("...")
        assert result == "unnamed_file"

    def test_multiple_underscores_collapsed(self):
        result = _sanitize_filename("my___resume.pdf")
        assert "___" not in result

    def test_windows_backslash_path(self):
        result = _sanitize_filename("C:\\Users\\hacker\\resume.pdf")
        assert "Users" not in result

    def test_null_bytes_removed(self):
        result = _sanitize_filename("file\x00name.pdf")
        assert "\x00" not in result

    def test_multiple_dots_collapsed(self):
        result = _sanitize_filename("a...b.pdf")
        assert "..." not in result


class TestVerifyPathWithinRoot:
    """Tests for path traversal prevention."""

    def test_valid_path(self, tmp_path):
        child = tmp_path / "uploads" / "file.pdf"
        child.parent.mkdir(parents=True, exist_ok=True)
        _verify_path_within_root(child, tmp_path)

    def test_traversal_raises(self, tmp_path):
        evil_path = tmp_path / ".." / ".." / "etc" / "passwd"
        with pytest.raises(StorageError, match="Invalid file path"):
            _verify_path_within_root(evil_path, tmp_path)

    def test_exact_root_is_valid(self, tmp_path):
        _verify_path_within_root(tmp_path, tmp_path)


class TestSaveUpload:
    """Tests for file upload saving."""

    @pytest.mark.asyncio
    async def test_save_upload_success(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            result = await save_upload(b"hello world", "user-123", "resume.pdf")

        assert "uploads/user-123" in result
        assert "resume.pdf" in result
        full_path = tmp_path / result
        assert full_path.exists()
        assert full_path.read_bytes() == b"hello world"

    @pytest.mark.asyncio
    async def test_save_upload_sanitizes_filename(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            result = await save_upload(b"data", "user-123", "../../etc/passwd")

        assert ".." not in result

    @pytest.mark.asyncio
    async def test_save_upload_creates_directory(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            await save_upload(b"data", "new-user-456", "test.pdf")

        assert (tmp_path / "uploads" / "new-user-456").is_dir()

    @pytest.mark.asyncio
    async def test_save_upload_mkdir_fails(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with (
            patch("app.services.file_storage.get_settings", return_value=mock_settings),
            patch("pathlib.Path.mkdir", side_effect=OSError("permission denied")),
        ):
            with pytest.raises(StorageError, match="temporarily unavailable"):
                await save_upload(b"data", "user-1", "file.pdf")

    @pytest.mark.asyncio
    async def test_save_upload_write_fails(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with (
            patch("app.services.file_storage.get_settings", return_value=mock_settings),
            patch("pathlib.Path.write_bytes", side_effect=OSError("disk full")),
        ):
            with pytest.raises(StorageError, match="Could not save"):
                await save_upload(b"data", "user-1", "file.pdf")

    @pytest.mark.asyncio
    async def test_save_upload_empty_content(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            result = await save_upload(b"", "user-1", "empty.pdf")

        full_path = tmp_path / result
        assert full_path.exists()
        assert full_path.read_bytes() == b""

    @pytest.mark.asyncio
    async def test_save_upload_returns_relative_path(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            result = await save_upload(b"data", "user-1", "resume.pdf")

        # Result should be relative, not absolute
        assert not result.startswith("/")
        assert result.startswith("uploads/")


class TestReadFile:
    """Tests for reading files from storage."""

    @pytest.mark.asyncio
    async def test_read_file_success(self, tmp_path):
        (tmp_path / "uploads" / "user-1").mkdir(parents=True)
        test_file = tmp_path / "uploads" / "user-1" / "test.pdf"
        test_file.write_bytes(b"pdf content here")

        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            content = await read_file("uploads/user-1/test.pdf")

        assert content == b"pdf content here"

    @pytest.mark.asyncio
    async def test_read_file_not_found(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            with pytest.raises(StorageError, match="not found"):
                await read_file("uploads/user-1/nonexistent.pdf")

    @pytest.mark.asyncio
    async def test_read_file_path_traversal(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            with pytest.raises(StorageError):
                await read_file("../../etc/passwd")

    @pytest.mark.asyncio
    async def test_read_file_os_error(self, tmp_path):
        (tmp_path / "uploads").mkdir(parents=True)
        test_file = tmp_path / "uploads" / "test.pdf"
        test_file.write_bytes(b"data")

        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with (
            patch("app.services.file_storage.get_settings", return_value=mock_settings),
            patch("pathlib.Path.read_bytes", side_effect=OSError("io error")),
        ):
            with pytest.raises(StorageError, match="Could not read"):
                await read_file("uploads/test.pdf")


class TestDeleteFile:
    """Tests for deleting files from storage."""

    @pytest.mark.asyncio
    async def test_delete_file_success(self, tmp_path):
        (tmp_path / "uploads").mkdir(parents=True)
        test_file = tmp_path / "uploads" / "test.pdf"
        test_file.write_bytes(b"data")

        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            await delete_file("uploads/test.pdf")

        assert not test_file.exists()

    @pytest.mark.asyncio
    async def test_delete_nonexistent_file_no_error(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            await delete_file("uploads/nonexistent.pdf")

    @pytest.mark.asyncio
    async def test_delete_file_os_error(self, tmp_path):
        (tmp_path / "uploads").mkdir(parents=True)
        test_file = tmp_path / "uploads" / "test.pdf"
        test_file.write_bytes(b"data")

        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with (
            patch("app.services.file_storage.get_settings", return_value=mock_settings),
            patch("pathlib.Path.unlink", side_effect=OSError("permission denied")),
        ):
            with pytest.raises(StorageError, match="Could not delete"):
                await delete_file("uploads/test.pdf")

    @pytest.mark.asyncio
    async def test_delete_file_path_traversal(self, tmp_path):
        mock_settings = MagicMock()
        mock_settings.storage_local_path = str(tmp_path)

        with patch(
            "app.services.file_storage.get_settings", return_value=mock_settings
        ):
            with pytest.raises(StorageError):
                await delete_file("../../etc/passwd")
