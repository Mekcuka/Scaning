"""Tests for job queue deduplication."""

import pytest

from app.core.config import settings
from app.services import job_queue


@pytest.mark.asyncio
async def test_enqueue_does_not_run_inprocess_when_arq_succeeds(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", "redis://localhost:6379")
    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", False)

    fired = {"inprocess": 0, "watchdog": 0}

    async def fake_enqueue(job_id):
        return None

    def fake_fire(coro):
        fired["inprocess"] += 1

    def fake_watchdog(job_id):
        fired["watchdog"] += 1

    monkeypatch.setattr(job_queue, "_enqueue_to_arq", fake_enqueue)
    monkeypatch.setattr(job_queue, "_fire_and_forget", fake_fire)
    monkeypatch.setattr(job_queue, "_schedule_pending_job_watchdog", fake_watchdog)

    import uuid

    await job_queue.enqueue_project_job(uuid.uuid4())

    assert fired["inprocess"] == 0
    assert fired["watchdog"] == 1


@pytest.mark.asyncio
async def test_enqueue_runs_inprocess_when_no_redis(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", "")

    fired = {"inprocess": 0}

    def fake_fire(coro):
        fired["inprocess"] += 1

    monkeypatch.setattr(job_queue, "_fire_and_forget", fake_fire)

    import uuid

    await job_queue.enqueue_project_job(uuid.uuid4())
    assert fired["inprocess"] == 1
