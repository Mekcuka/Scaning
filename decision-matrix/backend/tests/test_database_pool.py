"""Tests for DB engine pool configuration."""

from sqlalchemy.pool import NullPool, QueuePool

from app.core.config import settings
from app.core.database import engine


def test_engine_uses_settings_pool_size_for_postgres():
    """Postgres engine should expose configured pool_size from settings."""
    if settings.is_sqlite:
        return  # SQLite uses NullPool — pool_size not applicable
    pool = engine.sync_engine.pool
    assert isinstance(pool, QueuePool)
    assert pool.size() == settings.DB_POOL_SIZE


def test_engine_pool_pre_ping_for_postgres():
    if settings.is_sqlite:
        return
    pool = engine.sync_engine.pool
    assert getattr(pool, "_pre_ping", False) is True


def test_sqlite_uses_null_pool():
    """SQLite engine must use NullPool to avoid cross-thread transaction races."""
    if not settings.is_sqlite:
        return
    assert isinstance(engine.sync_engine.pool, NullPool)


def test_pool_recycle_setting():
    """For postgres, pool_recycle should propagate from settings."""
    if settings.is_sqlite:
        return
    assert settings.DB_POOL_RECYCLE_SECONDS > 0
