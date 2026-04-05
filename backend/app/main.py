"""
FastAPI application entry point.

Creates and configures the FastAPI application with:
- CORS middleware
- Security headers middleware
- Request ID tracking + Prometheus HTTP metrics middleware
- Global exception handlers
- API router mounting (includes /health/live, /health/ready, /metrics)
- Lifespan events (startup/shutdown)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.error_handlers import register_error_handlers
from app.core.logging_config import configure_logging
from app.core.middleware import (
    RateLimitMiddleware,
    RequestIdMiddleware,
    SecurityHeadersMiddleware,
)

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

    # ── Legacy /health alias — redirects to /health/ready for backward compat ──
    from fastapi.responses import RedirectResponse

    @app.get("/api/v1/health", tags=["health"], include_in_schema=False)
    async def health_legacy():
        """Backward-compat alias for /api/v1/health/ready."""
        return RedirectResponse(url="/api/v1/health/ready", status_code=307)

    return app


app = create_app()
