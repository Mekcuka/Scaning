"""ARQ enqueue must use the same queue name as the worker."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.config import settings


def test_enqueue_project_job_uses_worker_queue_name(monkeypatch):
    asyncio.run(_test_enqueue_project_job_uses_worker_queue_name(monkeypatch))


async def _test_enqueue_project_job_uses_worker_queue_name(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", False)
    monkeypatch.setattr(settings, "ARQ_QUEUE_NAME", "decision-matrix")

    import app.services.job_queue as job_queue

    job_queue._arq_pool = None

    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=None)

    async def fake_create_pool(redis_settings, *, default_queue_name):
        assert default_queue_name == "decision-matrix"
        return mock_pool

    with patch("arq.create_pool", side_effect=fake_create_pool):
        with patch("arq.connections.RedisSettings.from_dsn", return_value=MagicMock()):
            with patch.object(job_queue, "_schedule_pending_job_watchdog") as watchdog:
                with patch.object(job_queue, "_fire_and_forget") as fire:
                    await job_queue.enqueue_project_job(uuid4())
                    watchdog.assert_called_once()
                    fire.assert_not_called()

    mock_pool.enqueue_job.assert_awaited_once()
    call = mock_pool.enqueue_job.await_args
    assert call.args[0] == "execute_project_job_task"
    assert call.kwargs["_queue_name"] == "decision-matrix"

    job_queue._arq_pool = None


def test_enqueue_sync_fallback_when_no_redis(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", "")

    import app.services.job_queue as job_queue

    job_queue._arq_pool = None
    job_id = uuid4()
    with patch.object(job_queue, "_fire_and_forget") as fire:
        asyncio.run(job_queue.enqueue_project_job(job_id))
        fire.assert_called_once()
    job_queue._arq_pool = None


def test_enqueue_arq_schedules_watchdog_even_without_sync_fallback(monkeypatch):
    asyncio.run(_test_enqueue_arq_schedules_watchdog_even_without_sync_fallback(monkeypatch))


async def _test_enqueue_arq_schedules_watchdog_even_without_sync_fallback(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", False)
    monkeypatch.setattr(settings, "ARQ_QUEUE_NAME", "decision-matrix")

    import app.services.job_queue as job_queue

    job_queue._arq_pool = None

    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=None)

    async def fake_create_pool(redis_settings, *, default_queue_name):
        return mock_pool

    job_id = uuid4()
    with patch("arq.create_pool", side_effect=fake_create_pool):
        with patch("arq.connections.RedisSettings.from_dsn", return_value=MagicMock()):
            with patch.object(job_queue, "_schedule_pending_job_watchdog") as watchdog:
                with patch.object(job_queue, "_fire_and_forget") as fire:
                    await job_queue.enqueue_project_job(job_id)
                    watchdog.assert_called_once_with(job_id)
                    fire.assert_not_called()

    job_queue._arq_pool = None


def test_kick_stuck_pending_job(monkeypatch):
    from app.models import ProjectJob
    from app.services.job_queue import kick_stuck_pending_job

    monkeypatch.setattr(settings, "JOB_QUEUE_WATCHDOG_SECONDS", 10)
    job = ProjectJob(
        project_id=uuid4(),
        user_id=uuid4(),
        job_type="autoroad_connect",
        status="pending",
    )
    job.created_at = datetime.now(timezone.utc) - timedelta(seconds=30)

    import app.services.job_queue as job_queue

    with patch.object(job_queue, "_fire_and_forget") as fire:
        assert kick_stuck_pending_job(job) is True
        fire.assert_called_once()

    job.created_at = datetime.now(timezone.utc)
    assert kick_stuck_pending_job(job) is False
