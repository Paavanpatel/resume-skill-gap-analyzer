"""
Migration script: local filesystem → S3 (or MinIO).

Usage:
    python scripts/migrate_to_s3.py [--dry-run] [--delete-local]

What it does:
  1. Reads every Resume row from the database.
  2. For each resume, reads the local file at
     {storage_local_path}/{resume.file_path}.
  3. Uploads the file to S3 using the same key (resume.file_path).
  4. No DB change required — the stored path format is identical for both
     backends (e.g. "uploads/{user_id}/{hex}_{filename}").
  5. Optionally deletes the local file after a confirmed upload (--delete-local).

Run with --dry-run first to see what would be migrated without touching anything.

Prerequisites:
  - Set storage_backend=s3 and S3_* vars in .env (or env) before running.
  - The S3 bucket must already exist.
  - Run from the backend/ directory:  cd backend && python scripts/migrate_to_s3.py
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add backend root to sys.path so `app.*` imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text

from app.core.config import get_settings
from app.db.session import WriteSession
from app.models.resume import Resume
from app.services.file_storage import LocalStorage, S3Storage


async def migrate(dry_run: bool, delete_local: bool) -> None:
    settings = get_settings()

    local = LocalStorage(base_path=settings.storage_local_path)
    s3 = S3Storage(
        bucket=settings.s3_bucket,
        region=settings.s3_region,
        access_key_id=settings.s3_access_key_id,
        secret_access_key=settings.s3_secret_access_key,
        endpoint_url=settings.s3_endpoint_url or None,
    )

    async with WriteSession() as session:
        rows = (await session.execute(select(Resume))).scalars().all()

    print(f"Found {len(rows)} resume(s) to migrate.")
    if dry_run:
        print("DRY RUN — no files will be uploaded or deleted.\n")

    ok = 0
    skipped = 0
    failed = 0

    for resume in rows:
        key = resume.file_path
        local_path = Path(settings.storage_local_path) / key

        if not local_path.exists():
            print(f"  SKIP  {key}  (local file not found)")
            skipped += 1
            continue

        size = local_path.stat().st_size
        print(
            f"  {'WOULD UPLOAD' if dry_run else 'UPLOADING'}  {key}  ({size:,} bytes)"
        )

        if dry_run:
            ok += 1
            continue

        try:
            data = await local.read_file(key)
            await s3.upload_bytes(key, data)
            ok += 1
        except Exception as exc:
            print(f"    ERROR: {exc}")
            failed += 1
            continue

        if delete_local:
            try:
                local_path.unlink()
                print(f"    Deleted local file: {local_path}")
            except OSError as exc:
                print(f"    WARNING: could not delete local file: {exc}")

    print(f"\nDone. Migrated: {ok}  Skipped: {skipped}  Failed: {failed}")
    if failed:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate resume files from local storage to S3."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be uploaded without actually doing it.",
    )
    parser.add_argument(
        "--delete-local",
        action="store_true",
        help="Delete local files after a successful S3 upload.",
    )
    args = parser.parse_args()
    asyncio.run(migrate(dry_run=args.dry_run, delete_local=args.delete_local))


if __name__ == "__main__":
    main()
