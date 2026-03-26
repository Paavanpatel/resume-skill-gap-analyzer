"""
Central API router that aggregates all v1 endpoint routers.

Each endpoint module is mounted here with its prefix and tags.
This is the single point where all routes are registered.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import admin, analysis, auth, insights, resume

api_router = APIRouter()

# ── Active routes ─────────────────────────────────────────────
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resume.router, prefix="/resume", tags=["resume"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(admin.router, tags=["admin"])

# ── Coming in later phases ────────────────────────────────────
# api_router.include_router(skills.router,    prefix="/skills",    tags=["skills"])
# api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
