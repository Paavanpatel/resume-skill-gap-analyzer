"""
Model registry.

Import all models here so that Alembic and SQLAlchemy can discover them
when running migrations or creating tables.
"""

from app.models.analysis import Analysis
from app.models.resume import Resume
from app.models.roadmap import Roadmap
from app.models.skill import Skill
from app.models.usage import UsageRecord
from app.models.user import User

__all__ = ["User", "Resume", "Analysis", "Skill", "Roadmap", "UsageRecord"]
