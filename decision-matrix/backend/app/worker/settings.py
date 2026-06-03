"""ARQ worker configuration."""

from __future__ import annotations

from arq.connections import RedisSettings
from app.core.config import settings
from app.services.project_job_run import execute_project_job


async def execute_project_job_task(ctx: dict, job_id: str) -> None:
    from uuid import UUID

    await execute_project_job(UUID(job_id))


class WorkerSettings:
    functions = [execute_project_job_task]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL or "redis://localhost:6379")
    queue_name = settings.ARQ_QUEUE_NAME
    max_jobs = 4
    job_timeout = 600
    keep_result = 3600
