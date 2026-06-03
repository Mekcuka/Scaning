"""Enqueue project jobs to ARQ or in-process fallback."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.core.config import settings
from app.services.project_job_run import execute_project_job

logger = logging.getLogger(__name__)

_arq_pool = None


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


async def enqueue_project_job(job_id: UUID) -> None:
    if settings.jobs_use_queue:
        try:
            pool = await _get_arq_pool()
            await pool.enqueue_job(
                "execute_project_job_task",
                str(job_id),
                _queue_name=settings.ARQ_QUEUE_NAME,
            )
            return
        except Exception:
            logger.exception("ARQ enqueue failed for job %s, using in-process fallback", job_id)
    if settings.JOBS_SYNC_FALLBACK:
        asyncio.create_task(execute_project_job(job_id))
        return
    raise RuntimeError("Job queue unavailable: set REDIS_URL or enable JOBS_SYNC_FALLBACK")


def schedule_project_job(job_id: UUID) -> None:
    """Fire-and-forget enqueue from sync context (import endpoints after commit)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(enqueue_project_job(job_id))
        return
    loop.create_task(enqueue_project_job(job_id))
