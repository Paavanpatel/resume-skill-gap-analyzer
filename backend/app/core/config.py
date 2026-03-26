"""
Application configuration loaded from environment variables.

Uses pydantic-settings for type-safe config with .env file support.
All secrets come from environment variables, never hardcoded.
"""

import warnings
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the entire backend application."""

    # ── Application ──────────────────────────────────────────
    app_name: str = "Resume Skill Gap Analyzer"
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # ── Server ───────────────────────────────────────────────
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_workers: int = 4
    secret_key: str = "change-me-in-production"
    allowed_origins: str = "http://localhost:3000"

    # ── Database ─────────────────────────────────────────────
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "skill_gap_analyzer"
    postgres_user: str = "postgres"
    postgres_password: str = "change-me-in-production"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def async_database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ── Redis ────────────────────────────────────────────────
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""

    @property
    def redis_url(self) -> str:
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/0"
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    # ── AI / LLM ─────────────────────────────────────────────
    ai_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"
    ai_fallback_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # ── JWT Auth ─────────────────────────────────────────────
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # ── Rate Limiting ────────────────────────────────────────
    rate_limit_per_minute: int = 30
    rate_limit_analysis_per_hour: int = 10

    # ── Celery ───────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ── File Upload ──────────────────────────────────────────
    max_upload_size_mb: int = 10
    storage_backend: str = "local"
    storage_local_path: str = "./storage"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",  # Ignore env vars not defined in this model
    }


_INSECURE_DEFAULTS = {"change-me-in-production"}


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance. Call this instead of Settings() directly."""
    settings = Settings()

    # Refuse to start in production with insecure default secrets
    if settings.app_env == "production":
        for field_name in ("secret_key", "jwt_secret_key", "postgres_password"):
            value = getattr(settings, field_name)
            if value in _INSECURE_DEFAULTS:
                raise RuntimeError(
                    f"FATAL: '{field_name}' still has its insecure default value. "
                    f"Set a strong, unique value via environment variable before "
                    f"running in production."
                )
    elif any(
        getattr(settings, f) in _INSECURE_DEFAULTS
        for f in ("secret_key", "jwt_secret_key", "postgres_password")
    ):
        warnings.warn(
            "Running with insecure default secrets. "
            "This is fine for local development but MUST be changed for production.",
            stacklevel=2,
        )

    return settings
