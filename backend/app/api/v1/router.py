"""
Central API router that aggregates all v1 endpoint routers.

Each endpoint module is mounted here with its prefix and tags.
This is the single point where all routes are registered.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import admin, analysis, auth, billing, health, insights, resume, system

api_router = APIRouter()

# ── Active routes ─────────────────────────────────────────────
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resume.router, prefix="/resume", tags=["resume"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(health.router)                         # /health/live + /health/ready
api_router.include_router(system.metrics_router)                 # /metrics (Prometheus)
api_router.include_router(system.system_router)                  # /admin/system/*
