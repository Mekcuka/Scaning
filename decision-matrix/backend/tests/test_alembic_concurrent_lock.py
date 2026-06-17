"""Tests for distributed alembic migration lock."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.main import ALEMBIC_LOCK_KEY, run_alembic_upgrade_async


@pytest.mark.asyncio
async def test_non_production_runs_subprocess_directly(monkeypatch):
    """Non-prod bypasses advisory lock and runs subprocess unconditionally."""
    monkeypatch.setattr("app.main.settings.ENVIRONMENT", "development")
    called = {"count": 0}

    def fake_subprocess():
        called["count"] += 1

    with patch("app.main._run_alembic_subprocess", side_effect=fake_subprocess):
        await run_alembic_upgrade_async()

    assert called["count"] == 1


@pytest.mark.asyncio
async def test_production_acquires_and_releases_lock(monkeypatch):
    """In production, advisory lock is acquired before subprocess and released after."""
    monkeypatch.setattr("app.main.settings.ENVIRONMENT", "production")
    monkeypatch.setattr(
        "app.main.settings.DATABASE_URL", "postgresql+asyncpg://x:x@db:5432/sppr"
    )

    lock_events = []

    class FakeResult:
        def __init__(self, value):
            self._value = value

        def scalar(self):
            return self._value

    class FakeConn:
        async def execute(self, query):
            sql = str(query)
            if "pg_try_advisory_lock" in sql:
                lock_events.append("try")
                return FakeResult(True)
            if "pg_advisory_unlock" in sql:
                lock_events.append("unlock")
                return FakeResult(True)
            return FakeResult(None)

    class FakeTxn:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, *args):
            return None

    fake_engine = MagicMock()
    fake_engine.begin = MagicMock(return_value=FakeTxn())
    monkeypatch.setattr("app.main.engine", fake_engine)

    subprocess_calls = {"count": 0}

    def fake_subprocess():
        subprocess_calls["count"] += 1

    with patch("app.main._run_alembic_subprocess", side_effect=fake_subprocess):
        await run_alembic_upgrade_async()

    assert subprocess_calls["count"] == 1
    assert lock_events == ["try", "unlock"]


@pytest.mark.asyncio
async def test_production_waits_for_lock_then_acquires(monkeypatch):
    """When lock is held by another worker, this one waits and retries."""
    monkeypatch.setattr("app.main.settings.ENVIRONMENT", "production")
    monkeypatch.setattr(
        "app.main.settings.DATABASE_URL", "postgresql+asyncpg://x:x@db:5432/sppr"
    )
    monkeypatch.setattr("app.main.ALEMBIC_LOCK_POLL_INTERVAL", 0.001)

    attempts = {"n": 0}

    class FakeResult:
        def __init__(self, value):
            self._value = value

        def scalar(self):
            return self._value

    class FakeConn:
        async def execute(self, query):
            sql = str(query)
            if "pg_try_advisory_lock" in sql:
                attempts["n"] += 1
                # First two attempts fail (locked by other worker), third succeeds.
                return FakeResult(attempts["n"] >= 3)
            if "pg_advisory_unlock" in sql:
                return FakeResult(True)
            return FakeResult(None)

    class FakeTxn:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, *args):
            return None

    fake_engine = MagicMock()
    fake_engine.begin = MagicMock(return_value=FakeTxn())
    monkeypatch.setattr("app.main.engine", fake_engine)

    with patch("app.main._run_alembic_subprocess"):
        await run_alembic_upgrade_async()

    assert attempts["n"] == 3  # waited + retried
