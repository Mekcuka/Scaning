"""ARQ enqueue must use the same queue name as the worker."""

import asyncio
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
            await job_queue.enqueue_project_job(uuid4())

    mock_pool.enqueue_job.assert_awaited_once()
    call = mock_pool.enqueue_job.await_args
    assert call.args[0] == "execute_project_job_task"
    assert call.kwargs["_queue_name"] == "decision-matrix"

    job_queue._arq_pool = None


def test_enqueue_sync_fallback_when_no_redis(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", True)

    import app.services.job_queue as job_queue

    job_queue._arq_pool = None
    job_id = uuid4()
    with patch.object(job_queue, "execute_project_job", new_callable=AsyncMock) as run:
        with patch("asyncio.create_task") as create_task:
            job_queue.schedule_project_job(job_id)
            create_task.assert_called_once()
    job_queue._arq_pool = None
