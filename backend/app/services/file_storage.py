"""
File storage abstraction.

Currently uses local filesystem storage. The interface is designed so we can
swap in S3/GCS later by implementing the same functions with a different backend.
The storage_backend config setting ("local" vs "s3") will drive that switch.

Files are stored under: {storage_local_path}/uploads/{user_id}/{uuid}_{filename}
This structure:
- Isolates users from each other (security)
- Uses UUIDs to prevent filename collisions
- Keeps the original filename for display purposes

Security:
- Filenames are sanitized to remove path traversal characters (../)
- All resolved paths are verified to stay within the storage root
- Only alphanumeric, hyphen, underscore, and dot characters survive sanitization
"""

import logging
import re
import uuid
from pathlib import Path

from app.core.config import get_settings
from app.core.exceptions import StorageError

logger = logging.getLogger(__name__)


def _sanitize_filename(filename: str) -> str:
    """
    Strip dangerous characters from a filename.

    Why: User-supplied filenames can contain path traversal sequences
    (../../etc/passwd), null bytes, or special characters that cause
    issues on different operating systems. We keep only safe characters.
    """
    # Take just the filename portion (strip any directory components).
    # Handle both Unix (/) and Windows (\) separators, because uploads
    # from Windows browsers may include backslash paths even though
    # the server runs on Linux where \ isn't a separator.
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]

    # Replace any character that isn't alphanumeric, hyphen, underscore, or dot
    safe = re.sub(r"[^\w.\-]", "_", name)

    # Collapse multiple underscores/dots
    safe = re.sub(r"_{2,}", "_", safe)
    safe = re.sub(r"\.{2,}", ".", safe)

    # Strip leading dots (hidden files) and leading/trailing underscores
    safe = safe.lstrip(".").strip("_")

    # Fallback for completely empty result
    if not safe:
        safe = "unnamed_file"

    return safe


def _verify_path_within_root(path: Path, root: Path) -> None:
    """
    Verify that a resolved path stays within the storage root.

    This prevents path traversal attacks where a crafted filename or
    relative path escapes the storage directory. We resolve both paths
    to their absolute, canonical forms and check containment.
    """
    resolved = path.resolve()
    root_resolved = root.resolve()
    if not str(resolved).startswith(str(root_resolved)):
        logger.error(
            "Path traversal attempt detected: %s escapes root %s",
            resolved,
            root_resolved,
        )
        raise StorageError("Invalid file path.")


async def save_upload(
    file_content: bytes,
    user_id: str,
    original_filename: str,
) -> str:
    """
    Save uploaded file content to local storage.

    Args:
        file_content: Raw bytes of the uploaded file.
        user_id: UUID string of the uploading user.
        original_filename: Original name of the file.

    Returns:
        The relative storage path (for DB persistence).

    Raises:
        StorageError: If the file cannot be written.
    """
    settings = get_settings()
    storage_base = Path(settings.storage_local_path)
    storage_root = storage_base / "uploads" / str(user_id)

    try:
        storage_root.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.error("Cannot create storage directory %s: %s", storage_root, e)
        raise StorageError("File storage is temporarily unavailable.") from e

    # Sanitize the filename and prefix with UUID for uniqueness
    safe_name = _sanitize_filename(original_filename)
    safe_filename = f"{uuid.uuid4().hex[:12]}_{safe_name}"
    file_path = storage_root / safe_filename

    # Verify the final path is within the storage root
    _verify_path_within_root(file_path, storage_base)

    try:
        file_path.write_bytes(file_content)
    except OSError as e:
        logger.error("Cannot write file %s: %s", file_path, e)
        raise StorageError("Could not save the uploaded file.") from e

    relative = str(file_path.relative_to(storage_base))
    # Normalize to forward slashes for cross-platform compatibility (Windows → Unix paths)
    relative = relative.replace("\\", "/")
    logger.info("Saved upload: %s (%d bytes)", relative, len(file_content))
    return relative


async def read_file(relative_path: str) -> bytes:
    """
    Read a file from storage by its relative path.

    Used when re-parsing a previously uploaded resume.
    """
    settings = get_settings()
    storage_base = Path(settings.storage_local_path)
    full_path = storage_base / relative_path

    # Guard against path traversal
    _verify_path_within_root(full_path, storage_base)

    if not full_path.exists():
        raise StorageError("The requested file was not found in storage.")

    try:
        return full_path.read_bytes()
    except OSError as e:
        logger.error("Cannot read file %s: %s", full_path, e)
        raise StorageError("Could not read the file from storage.") from e


async def delete_file(relative_path: str) -> None:
    """Delete a file from storage."""
    settings = get_settings()
    storage_base = Path(settings.storage_local_path)
    full_path = storage_base / relative_path

    _verify_path_within_root(full_path, storage_base)

    if full_path.exists():
        try:
            full_path.unlink()
            logger.info("Deleted file: %s", relative_path)
        except OSError as e:
            logger.error("Cannot delete file %s: %s", full_path, e)
            raise StorageError("Could not delete the file.") from e
