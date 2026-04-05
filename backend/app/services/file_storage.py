"""
File storage abstraction — Protocol + LocalStorage + S3Storage.

Switching backends is driven by the `storage_backend` config setting:
  "local"  →  LocalStorage (filesystem under storage_local_path)
  "s3"     →  S3Storage    (AWS S3 or MinIO via aioboto3)

The stored path / S3 key format is:  uploads/{user_id}/{12hex}_{safe_filename}
This structure is identical for both backends, so switching backends does NOT
require DB migrations — only a migration of the physical files (see
scripts/migrate_to_s3.py).

Security (LocalStorage):
  - Filenames sanitised — path traversal chars stripped
  - Resolved paths verified to stay within storage root
"""

import logging
import re
import uuid
from pathlib import Path
from typing import Protocol, runtime_checkable

from app.core.config import get_settings
from app.core.exceptions import StorageError

logger = logging.getLogger(__name__)


# ── Shared filename sanitisation ──────────────────────────────────────────────


def _sanitize_filename(filename: str) -> str:
    """Strip dangerous characters from a user-supplied filename."""
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    safe = re.sub(r"[^\w.\-]", "_", name)
    safe = re.sub(r"_{2,}", "_", safe)
    safe = re.sub(r"\.{2,}", ".", safe)
    safe = safe.lstrip(".").strip("_")
    return safe or "unnamed_file"


def _verify_path_within_root(path: Path, root: Path) -> None:
    """Raise StorageError if `path` escapes `root`."""
    if not str(path.resolve()).startswith(str(root.resolve())):
        logger.error("Path traversal attempt: %s escapes root %s", path, root)
        raise StorageError("Invalid file path.")


# ── Protocol ──────────────────────────────────────────────────────────────────


@runtime_checkable
class StorageBackend(Protocol):
    async def save_upload(
        self, file_content: bytes, user_id: str, original_filename: str
    ) -> str: ...

    async def upload_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> None: ...

    async def read_file(self, path: str) -> bytes: ...

    async def delete_file(self, path: str) -> None: ...

    async def generate_presigned_url(
        self, path: str, expiry_seconds: int = 3600
    ) -> str | None: ...

    async def get_stats(self) -> dict: ...


# ── LocalStorage ──────────────────────────────────────────────────────────────


class LocalStorage:
    """Filesystem-backed storage. Keys are paths relative to `base_path`."""

    def __init__(self, base_path: str) -> None:
        self._base = Path(base_path)

    def _guard(self, path: Path) -> None:
        """Raise StorageError if `path` escapes the storage root."""
        _verify_path_within_root(path, self._base)

    async def save_upload(
        self, file_content: bytes, user_id: str, original_filename: str
    ) -> str:
        storage_root = self._base / "uploads" / str(user_id)
        try:
            storage_root.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.error("Cannot create storage directory %s: %s", storage_root, e)
            raise StorageError("File storage is temporarily unavailable.") from e

        safe_name = _sanitize_filename(original_filename)
        key = f"{uuid.uuid4().hex[:12]}_{safe_name}"
        file_path = storage_root / key
        self._guard(file_path)

        try:
            file_path.write_bytes(file_content)
        except OSError as e:
            logger.error("Cannot write file %s: %s", file_path, e)
            raise StorageError("Could not save the uploaded file.") from e

        relative = str(file_path.relative_to(self._base)).replace("\\", "/")
        logger.info("Saved upload: %s (%d bytes)", relative, len(file_content))
        return relative

    async def upload_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> None:
        """Store arbitrary bytes at `key` (relative to storage root)."""
        dest = self._base / key
        self._guard(dest)
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        except OSError as e:
            logger.error("Cannot write bytes to %s: %s", dest, e)
            raise StorageError("Could not store file.") from e

    async def read_file(self, path: str) -> bytes:
        full_path = self._base / path
        self._guard(full_path)
        if not full_path.exists():
            raise StorageError("The requested file was not found in storage.")
        try:
            return full_path.read_bytes()
        except OSError as e:
            logger.error("Cannot read file %s: %s", full_path, e)
            raise StorageError("Could not read the file from storage.") from e

    async def delete_file(self, path: str) -> None:
        full_path = self._base / path
        self._guard(full_path)
        if full_path.exists():
            try:
                full_path.unlink()
                logger.info("Deleted file: %s", path)
            except OSError as e:
                logger.error("Cannot delete file %s: %s", full_path, e)
                raise StorageError("Could not delete the file.") from e

    async def generate_presigned_url(
        self, path: str, expiry_seconds: int = 3600
    ) -> str | None:
        # Local storage has no concept of pre-signed URLs; callers fall back
        # to proxying bytes through the API.
        return None

    async def get_stats(self) -> dict:
        uploads_dir = self._base / "uploads"
        total_files = 0
        total_bytes = 0
        if uploads_dir.exists():
            for f in uploads_dir.rglob("*"):
                if f.is_file():
                    total_files += 1
                    total_bytes += f.stat().st_size
        return {
            "backend": "local",
            "total_files": total_files,
            "total_bytes": total_bytes,
            "bucket": None,
        }


# ── S3Storage ─────────────────────────────────────────────────────────────────


class S3Storage:
    """S3-compatible object storage via aioboto3. Works with AWS S3 and MinIO."""

    def __init__(
        self,
        bucket: str,
        region: str,
        access_key_id: str,
        secret_access_key: str,
        endpoint_url: str | None = None,
    ) -> None:
        self._bucket = bucket
        self._region = region
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._endpoint_url = endpoint_url or None

    def _client(self):
        """Return an aioboto3 async S3 client context manager."""
        import aioboto3  # lazy import — only required when storage_backend=s3

        session = aioboto3.Session(
            aws_access_key_id=self._access_key_id,
            aws_secret_access_key=self._secret_access_key,
            region_name=self._region,
        )
        kwargs: dict = {}
        if self._endpoint_url:
            kwargs["endpoint_url"] = self._endpoint_url
        return session.client("s3", **kwargs)

    async def save_upload(
        self, file_content: bytes, user_id: str, original_filename: str
    ) -> str:
        safe_name = _sanitize_filename(original_filename)
        key = f"uploads/{user_id}/{uuid.uuid4().hex[:12]}_{safe_name}"
        try:
            async with self._client() as s3:
                await s3.put_object(Bucket=self._bucket, Key=key, Body=file_content)
        except Exception as e:
            logger.error("S3 put_object failed for key %s: %s", key, e)
            raise StorageError("Could not save the uploaded file.") from e
        logger.info("Saved upload to S3: %s (%d bytes)", key, len(file_content))
        return key

    async def upload_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> None:
        try:
            async with self._client() as s3:
                await s3.put_object(
                    Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
                )
        except Exception as e:
            logger.error("S3 upload_bytes failed for key %s: %s", key, e)
            raise StorageError("Could not store file.") from e

    async def read_file(self, path: str) -> bytes:
        try:
            async with self._client() as s3:
                response = await s3.get_object(Bucket=self._bucket, Key=path)
                return await response["Body"].read()
        except Exception as e:
            logger.error("S3 get_object failed for key %s: %s", path, e)
            raise StorageError("Could not read the file from storage.") from e

    async def delete_file(self, path: str) -> None:
        try:
            async with self._client() as s3:
                await s3.delete_object(Bucket=self._bucket, Key=path)
            logger.info("Deleted S3 object: %s", path)
        except Exception as e:
            logger.error("S3 delete_object failed for key %s: %s", path, e)
            raise StorageError("Could not delete the file.") from e

    async def generate_presigned_url(
        self, path: str, expiry_seconds: int = 3600
    ) -> str | None:
        try:
            async with self._client() as s3:
                url = await s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self._bucket, "Key": path},
                    ExpiresIn=expiry_seconds,
                )
            return url
        except Exception as e:
            logger.error("Presigned URL generation failed for key %s: %s", path, e)
            raise StorageError("Could not generate download URL.") from e

    async def get_stats(self) -> dict:
        total_files = 0
        total_bytes = 0
        try:
            async with self._client() as s3:
                paginator = s3.get_paginator("list_objects_v2")
                async for page in paginator.paginate(
                    Bucket=self._bucket, Prefix="uploads/"
                ):
                    for obj in page.get("Contents", []):
                        total_files += 1
                        total_bytes += obj["Size"]
        except Exception as e:
            logger.error("S3 get_stats failed: %s", e)
        return {
            "backend": "s3",
            "total_files": total_files,
            "total_bytes": total_bytes,
            "bucket": self._bucket,
        }


# ── Factory ───────────────────────────────────────────────────────────────────


def get_storage() -> StorageBackend:
    """Return the configured storage backend (cached per process via module scope)."""
    settings = get_settings()
    if settings.storage_backend == "s3":
        return S3Storage(
            bucket=settings.s3_bucket,
            region=settings.s3_region,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            endpoint_url=settings.s3_endpoint_url or None,
        )
    return LocalStorage(base_path=settings.storage_local_path)


# ── Module-level backward-compatible API ──────────────────────────────────────
# Existing callers (resume.py, parse_task.py, etc.) import these directly.


async def save_upload(file_content: bytes, user_id: str, original_filename: str) -> str:
    return await get_storage().save_upload(file_content, user_id, original_filename)


async def read_file(relative_path: str) -> bytes:
    return await get_storage().read_file(relative_path)


async def delete_file(relative_path: str) -> None:
    return await get_storage().delete_file(relative_path)
