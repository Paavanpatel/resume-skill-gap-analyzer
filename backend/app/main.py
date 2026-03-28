"""
FastAPI application entry point.

Creates and configures the FastAPI application with:
- CORS middleware
- Security headers middleware
- Request ID tracking middleware
- Global exception handlers
- API router mounting
- Lifespan events (startup/shutdown)
- Health check endpoint
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.error_handlers import register_error_handlers
from app.core.logging_config import configure_logging
from app.core.middleware import RateLimitMiddleware, RequestIdMiddleware, SecurityHeadersMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown events."""
    configure_logging()
    settings = get_settings()
    logger.info("Starting %s in %s mode...", settings.app_name, settings.app_env)
    yield
    logger.info("Shutting down %s...", settings.app_name)


def create_app() -> FastAPI:
    """Application factory. Creates and configures the FastAPI instance."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Analyze resume-to-job skill gaps and generate learning roadmaps",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # ── Middleware (order matters: last added = first executed) ──
    # Security headers on every response
    app.add_middleware(SecurityHeadersMiddleware)

    # Rate limiting (Redis-backed, fail-open if Redis unavailable)
    app.add_middleware(
        RateLimitMiddleware,
        redis_url=settings.redis_url,
        general_limit=settings.rate_limit_per_minute,
        analysis_limit=settings.rate_limit_analysis_per_hour,
    )

    # Request ID tracking and request logging
    app.add_middleware(RequestIdMiddleware)

    # CORS (must be outermost to handle preflight OPTIONS requests)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception handlers ────────────────────────────────────
    register_error_handlers(app)

    # ── Routers ───────────────────────────────────────────────
    from app.api.v1.router import api_router
    app.include_router(api_router, prefix="/api/v1")

    # ── WebSocket routes (no /api/v1 prefix — ws_url is /ws/analysis/{id}) ──
    from app.api.v1.websockets import router as ws_router
    app.include_router(ws_router)

    # ── Health Check ──────────────────────────────────────────
    @app.get("/api/v1/health", tags=["system"])
    async def health_check():
        """
        Production-grade health check.

        Returns connectivity status for all dependencies so container
        orchestrators (Docker, K8s) and load balancers can make
        informed routing decisions.
        """
        import time
        checks: dict = {}

        # -- Database connectivity --
        try:
            import asyncpg
            conn = await asyncpg.connect(
                host=settings.postgres_host,
                port=settings.postgres_port,
                user=settings.postgres_user,
                password=settings.postgres_password,
                database=settings.postgres_db,
                timeout=5,
            )
            await conn.execute("SELECT 1")
            await conn.close()
            checks["database"] = "ok"
        except Exception as exc:
            checks["database"] = f"error: {type(exc).__name__}"

        # -- Redis connectivity --
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
            await r.ping()
            await r.aclose()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {type(exc).__name__}"

        overall = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"

        return {
            "status": overall,
            "app": settings.app_name,
            "version": "1.0.0",
            "environment": settings.app_env,
            "checks": checks,
            "timestamp": time.time(),
        }

    return app


app = create_app()
