"""Centralized configuration loaded from environment variables."""

import os


class Settings:
    ENV: str = os.getenv("ENV", "dev")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://nobleport:postgres@db:5432/designagent",
    )
    # Sync URL for SQLAlchemy create_engine (psycopg in sync mode)
    DATABASE_URL_SYNC: str = DATABASE_URL.replace("+psycopg", "+psycopg")

    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    CELERY_BROKER_URL: str = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    CELERY_RESULT_BACKEND: str = f"redis://{REDIS_HOST}:{REDIS_PORT}/1"

    ARTIFACT_ROOT: str = os.getenv("ARTIFACT_ROOT", "/artifacts")
    SIGNED_URL_SECRET: str = os.getenv("SIGNED_URL_SECRET", "change-me")


settings = Settings()
