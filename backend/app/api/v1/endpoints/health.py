"""
Health check endpoints following Kubernetes liveness/readiness probe conventions.

  GET /api/v1/health/live  — Liveness probe
    Returns 200 as long as the process is alive and the event loop is running.
    No dependency checks. Container orchestrators use this to decide whether to
    restart a pod.

  GET /api/v1/health/ready — Readiness probe
    Verifies all dependencies (DB, Redis, Celery) are reachable before declaring
    the instance ready to serve traffic. Returns 503 if critical deps (DB/Redis)
    are down. Container orchestrators use this to remove pods from the LB pool.

Both endpoints are rate-limit exempt (see middleware.py _EXEMPT_PATHS).
"""

import asyncio
import logging
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger(__name__)
_settings = get_settings()


@router.get("/live")
async def liveness():
    """
    Liveness probe — just confirm the process is up.

    Intentionally minimal: no I/O, no dependency checks.
    Fast enough for high-frequency probe intervals (every 5s).
    """
    return {"status": "ok", "timestamp": time.time()}


@router.get("/ready")
async def readiness():
    """
    Readiness probe — verify all dependencies are reachable.

    Runs three checks concurrently to keep latency low:
    - database: asyncpg SELECT 1
    - redis:    PING
    - celery:   inspect().ping() with 2s timeout

    Status logic:
    - healthy:  all three pass
    - degraded: DB + Redis pass but Celery has no live workers
    - unhealthy: DB or Redis unreachable (return HTTP 503)
    """
    checks: dict[str, str] = {}

    async def _check_db() -> str:
        try:
            import asyncpg
            conn = await asyncpg.connect(
                host=_settings.postgres_host,
                port=_settings.postgres_port,
                user=_settings.postgres_user,
                password=_settings.postgres_password,
                database=_settings.postgres_db,
                timeout=5,
            )
            await conn.execute("SELECT 1")
            await conn.close()
            return "ok"
        except Exception as exc:
            logger.warning("DB readiness check failed: %s", exc)
            return f"error: {type(exc).__name__}"

    async def _check_redis() -> str:
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(_settings.redis_url, socket_connect_timeout=2)
            await r.ping()
            await r.aclose()
            return "ok"
        except Exception as exc:
            logger.warning("Redis readiness check failed: %s", exc)
            return f"error: {type(exc).__name__}"

    async def _check_celery() -> str:
        """
        Ping Celery workers via the control interface.

        We run inspect().ping() in a thread executor because it's a blocking
        amqp/redis call under the hood.
        Returns 'ok' if at least one worker responds, 'no_workers' if the
        broker is reachable but no workers are running, or 'error: ...' on
        broker connectivity failures.
        """
        try:
            from app.workers.celery_app import celery_app
            loop = asyncio.get_running_loop()
            inspect = celery_app.control.inspect(timeout=2.0)
            result = await loop.run_in_executor(None, inspect.ping)
            if result:
                return "ok"
            return "no_workers"
        except Exception as exc:
            logger.warning("Celery readiness check failed: %s", exc)
            return f"error: {type(exc).__name__}"

    db_result, redis_result, celery_result = await asyncio.gather(
        _check_db(), _check_redis(), _check_celery()
    )

    checks["database"] = db_result
    checks["redis"] = redis_result
    checks["celery"] = celery_result

    db_ok = checks["database"] == "ok"
    redis_ok = checks["redis"] == "ok"

    if db_ok and redis_ok and checks["celery"] == "ok":
        overall = "healthy"
    elif db_ok and redis_ok:
        overall = "degraded"  # Celery workers offline but core infra is up
    else:
        overall = "unhealthy"

    http_status = 503 if overall == "unhealthy" else 200
    return JSONResponse(
        status_code=http_status,
        content={
            "status": overall,
            "checks": checks,
            "app": _settings.app_name,
            "version": "1.0.0",
            "environment": _settings.app_env,
            "timestamp": time.time(),
        },
    )
