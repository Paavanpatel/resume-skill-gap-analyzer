"""
Celery beat maintenance tasks.

Scheduled via celery_app.conf.beat_schedule:
  - daily-db-backup: runs at 02:00 UTC every day
  - weekly-sweep-stale: runs at 03:00 UTC every Sunday

pg_dump is invoked as a subprocess so we don't need a Python
PostgreSQL dump library — the binary is already available via
the libpq / postgres-client system package.

Backup naming:  rsga_backup_YYYYMMDD_HHMMSS.dump
Retention:      keeps the last 7 daily backups, then deletes older ones.
Storage:        writes to /app/storage/backups/ by default;
                override with BACKUP_DIR env var.
"""

import asyncio
import glob
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# How many daily backups to retain before pruning
BACKUP_RETENTION_COUNT = int(os.getenv("BACKUP_RETENTION_COUNT", "7"))

# Where to write dumps.  Mounted as a Docker volume in prod.
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/app/storage/backups"))


# ── Daily backup ───────────────────────────────────────────────


@celery_app.task(
    name="daily_db_backup",
    bind=True,
    max_retries=2,
    default_retry_delay=300,  # 5 min between retries
)
def daily_db_backup(self) -> dict:
    """
    Dump the PostgreSQL database to a .dump file and prune old backups.

    Uses pg_dump's custom format (-Fc) for compressed, restore-able dumps.
    Requires the postgres-client binary (pg_dump) to be installed in the
    container — added to Dockerfile.prod as `postgresql-client`.
    """
    try:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_file = BACKUP_DIR / f"rsga_backup_{timestamp}.dump"

        from app.core.config import get_settings

        s = get_settings()

        env = {
            **os.environ,
            "PGPASSWORD": s.postgres_password,
        }

        logger.info("Starting DB backup → %s", backup_file)

        result = subprocess.run(
            [
                "pg_dump",
                "--format=custom",
                "--compress=6",
                f"--host={s.postgres_host}",
                f"--port={s.postgres_port}",
                f"--username={s.postgres_user}",
                f"--dbname={s.postgres_db}",
                f"--file={backup_file}",
            ],
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"pg_dump failed (rc={result.returncode}): {result.stderr.strip()}"
            )

        size_bytes = backup_file.stat().st_size
        logger.info(
            "DB backup complete: %s (%.1f MB)",
            backup_file.name,
            size_bytes / 1_048_576,
        )

        # Prune old backups — keep only the most recent N
        _prune_old_backups()

        return {
            "status": "success",
            "file": str(backup_file),
            "size_bytes": size_bytes,
            "timestamp": timestamp,
        }

    except Exception as exc:
        logger.error("DB backup failed: %s", exc)
        raise self.retry(exc=exc)


def _prune_old_backups() -> None:
    """Delete backups older than the retention window."""
    dumps = sorted(
        glob.glob(str(BACKUP_DIR / "rsga_backup_*.dump")),
        reverse=True,  # newest first
    )
    to_delete = dumps[BACKUP_RETENTION_COUNT:]
    for old_file in to_delete:
        try:
            Path(old_file).unlink()
            logger.info("Pruned old backup: %s", old_file)
        except OSError as err:
            logger.warning("Could not delete %s: %s", old_file, err)


# ── Weekly stale-analysis sweep ────────────────────────────────


@celery_app.task(
    name="weekly_sweep_stale",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
def weekly_sweep_stale(self) -> dict:
    """
    Mark analyses that have been stuck in 'processing' for > 24 hours
    as 'failed' and free the associated resources.

    Mirrors the logic in POST /api/v1/admin/sweep-stale but runs
    on a schedule rather than requiring an admin HTTP call.
    """
    try:
        result = asyncio.run(_sweep())
        return result
    except Exception as exc:
        logger.error("Stale-analysis sweep failed: %s", exc)
        raise self.retry(exc=exc)


async def _sweep() -> dict:
    """Async implementation that wraps the existing sweep service."""
    from datetime import timedelta

    from sqlalchemy import and_, update

    from app.db.session import WriteSession
    from app.models.analysis import Analysis, AnalysisStatus

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with WriteSession() as session:
        stmt = (
            update(Analysis)
            .where(
                and_(
                    Analysis.status == AnalysisStatus.PROCESSING,
                    Analysis.updated_at < cutoff,
                )
            )
            .values(status=AnalysisStatus.FAILED)
            .returning(Analysis.id)
        )
        rows = (await session.execute(stmt)).fetchall()
        await session.commit()

    swept = len(rows)
    logger.info("Weekly sweep: marked %d stale analyses as failed", swept)
    return {"status": "success", "swept": swept, "cutoff_utc": cutoff.isoformat()}
