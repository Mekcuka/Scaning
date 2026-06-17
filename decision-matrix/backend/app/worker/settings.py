"""ARQ worker configuration."""

from __future__ import annotations

import logging
import time
from typing import Any

from arq.connections import RedisSettings

from app.core.config import settings
from app.services.project_job_run import execute_project_job

logger = logging.getLogger(__name__)


async def execute_project_job_task(ctx: dict, job_id: str) -> None:
    from uuid import UUID

    await execute_project_job(UUID(job_id))


async def on_startup(ctx: dict) -> None:
    from app.main import configure_logging

    configure_logging()
    logger.info("ARQ worker started queue=%s max_jobs=%s", settings.ARQ_QUEUE_NAME, settings.ARQ_MAX_JOBS)


async def on_job_start(ctx: dict, job_id: str) -> None:
    ctx["job_started_at"] = time.monotonic()
    logger.info('{"event":"job_start","job_id":"%s"}', job_id)


async def on_job_end(ctx: dict, job_id: str, result: Any) -> None:
    started = ctx.pop("job_started_at", None)
    duration_ms = int((time.monotonic() - started) * 1000) if started is not None else None
    logger.info(
        '{"event":"job_end","job_id":"%s","duration_ms":%s,"status":"completed"}',
        job_id,
        duration_ms,
    )


class WorkerSettings:
    functions = [execute_project_job_task]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL or "redis://localhost:6379")
    queue_name = settings.ARQ_QUEUE_NAME
    max_jobs = settings.ARQ_MAX_JOBS
    job_timeout = 600
    keep_result = 3600
    max_tries = 1
    on_startup = on_startup
    on_job_start = on_job_start
    on_job_end = on_job_end
