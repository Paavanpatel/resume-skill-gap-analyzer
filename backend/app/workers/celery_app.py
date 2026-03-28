"""
Celery application configuration.

This is the entry point for Celery workers. Start a worker with:
  celery -A app.workers.celery_app worker --loglevel=info

Tasks are auto-discovered from the app.workers package.
"""

import logging

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_process_init

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

celery_app = Celery(
    "skill_gap_analyzer",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,  # Re-deliver if worker crashes mid-task
    worker_prefetch_multiplier=1,  # Fair scheduling under load
    # ── Celery Beat schedule ──────────────────────────────────
    beat_schedule={
        # Daily DB backup at 02:00 UTC
        "daily-db-backup": {
            "task": "daily_db_backup",
            "schedule": crontab(hour=2, minute=0),
        },
        # Weekly sweep of stale analyses — every Sunday at 03:00 UTC
        "weekly-sweep-stale": {
            "task": "weekly_sweep_stale",
            "schedule": crontab(hour=3, minute=0, day_of_week=0),
        },
    },
)


@worker_process_init.connect
def on_worker_process_init(**kwargs):
    """
    Called in each forked worker process after fork.

    Disposes the inherited (stale) async engine pools and creates fresh ones.
    Without this, asyncpg connections from the parent process try to use the
    parent's event loop, which is closed in the child — causing
    'RuntimeError: Event loop is closed' on every database operation.
    """
    from app.db.session import reinitialize_engines

    reinitialize_engines()
    logger.info("Reinitialized database engines for worker process")


# Import task modules explicitly so Celery registers their @shared_task
# and @celery_app.task decorators. The default autodiscover_tasks() only
# looks for files named 'tasks.py', but ours are named analysis_task.py
# and parse_task.py.
import app.workers.analysis_task  # noqa: F401, E402
import app.workers.parse_task  # noqa: F401, E402
import app.workers.backup_task  # noqa: F401, E402
