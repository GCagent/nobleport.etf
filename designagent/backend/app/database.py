"""Database engine and session factory.

Engine creation is lazy so that model imports work without a live DB
(critical for Celery autodiscover and offline validation).
"""

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


@lru_cache(maxsize=1)
def get_engine():
    return create_engine(settings.DATABASE_URL_SYNC, echo=(settings.ENV == "dev"))


def get_session_factory():
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


# Convenience alias — most code uses SessionLocal()
def SessionLocal():
    return get_session_factory()()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
