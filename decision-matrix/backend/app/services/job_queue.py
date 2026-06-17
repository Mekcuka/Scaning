"""Enqueue project jobs to ARQ or in-process fallback."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from app.core.config import settings
from app.core.database import async_session
from app.models import ProjectJob
from app.services.project_job_run import execute_project_job
from app.services.project_jobs import JOB_STATUS_PENDING

logger = logging.getLogger(__name__)

_arq_pool = None
_background_tasks: set[asyncio.Task[None]] = set()
ARQ_ENQUEUE_TIMEOUT_SECONDS = 5.0


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _track_background_task(task: asyncio.Task[None]) -> None:
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


def _fire_and_forget(coro) -> None:
    async def _wrapper() -> None:
        try:
            await coro
        except Exception:
            logger.exception("Background project job task failed")

    task = asyncio.create_task(_wrapper())
    _track_background_task(task)


async def _get_arq_pool():
    global _arq_pool
    if _arq_pool is not None:
        return _arq_pool
    from arq import create_pool
    from arq.connections import RedisSettings

    _arq_pool = await create_pool(
        RedisSettings.from_dsn(settings.REDIS_URL),
        default_queue_name=settings.ARQ_QUEUE_NAME,
    )
    return _arq_pool


async def _enqueue_to_arq(job_id: UUID) -> None:
    pool = await _get_arq_pool()
    await pool.enqueue_job(
        "execute_project_job_task",
        str(job_id),
        _queue_name=settings.ARQ_QUEUE_NAME,
    )


async def _run_pending_job_watchdog(job_id: UUID) -> None:
    """Backup if in-process task was lost and worker never picked up the job."""
    delay = max(5, settings.JOB_QUEUE_WATCHDOG_SECONDS)
    await asyncio.sleep(delay)
    async with async_session() as db:
        job = await db.get(ProjectJob, job_id)
        if not job or job.status != JOB_STATUS_PENDING:
            return
    logger.warning(
        "Job %s still pending %ss after enqueue; retrying in-process execution",
        job_id,
        delay,
    )
    await execute_project_job(job_id)


def _schedule_pending_job_watchdog(job_id: UUID) -> None:
    _fire_and_forget(_run_pending_job_watchdog(job_id))


def kick_stuck_pending_job(job: ProjectJob) -> bool:
    """If a job has been pending too long, schedule in-process execution."""
    if job.status != JOB_STATUS_PENDING:
        return False
    created = job.created_at
    if created is None:
        return False
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age = (_utcnow() - created).total_seconds()
    grace = min(5, settings.JOB_QUEUE_WATCHDOG_SECONDS)
    if age < grace:
        return False
    logger.warning("Kicking stuck pending job %s (age %.0fs)", job.id, age)
    _fire_and_forget(execute_project_job(job.id))
    return True


async def enqueue_project_job(job_id: UUID) -> None:
    """Enqueue to ARQ worker; in-process fallback only when configured."""
    if settings.jobs_use_queue:
        try:
            await asyncio.wait_for(
                _enqueue_to_arq(job_id),
                timeout=ARQ_ENQUEUE_TIMEOUT_SECONDS,
            )
            _schedule_pending_job_watchdog(job_id)
            return
        except Exception:
            logger.exception("ARQ enqueue failed for job %s", job_id)
            if settings.JOBS_SYNC_FALLBACK:
                _fire_and_forget(execute_project_job(job_id))
            return

    _fire_and_forget(execute_project_job(job_id))
