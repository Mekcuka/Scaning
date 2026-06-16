"""Job enqueue guards."""

from app.core.config import settings
from app.services.job_enqueue import jobs_async_enabled


def test_jobs_async_disabled_on_sqlite(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite+aiosqlite:///./data/test.db")
    monkeypatch.setattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", True)
    assert settings.is_sqlite
    assert jobs_async_enabled() is False


def test_jobs_async_enabled_with_redis_on_postgres(monkeypatch):
    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+asyncpg://sppr:secret@localhost:5432/sppr",
    )
    monkeypatch.setattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", False)
    assert not settings.is_sqlite
    assert jobs_async_enabled() is True


def test_jobs_async_sync_fallback_without_redis(monkeypatch):
    monkeypatch.setattr(
        settings,
        "DATABASE_URL",
        "postgresql+asyncpg://sppr:secret@localhost:5432/sppr",
    )
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", True)
    assert jobs_async_enabled() is True
