"""Helpers to create and schedule project jobs from API handlers."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import ProjectJob
from app.services.job_queue import schedule_project_job
from app.services.project_jobs import ActiveProjectJobError, create_project_job


def jobs_async_enabled() -> bool:
    return settings.jobs_use_queue or settings.JOBS_SYNC_FALLBACK


async def create_and_schedule_job(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    job_type: str,
    payload: dict[str, Any],
) -> ProjectJob:
    job = await create_project_job(
        db,
        project_id=project_id,
        user_id=user_id,
        job_type=job_type,
        payload=payload,
    )
    await db.flush()
    return job


async def commit_and_schedule(db: AsyncSession, job: ProjectJob) -> None:
    await db.commit()
    await db.refresh(job)
    schedule_project_job(job.id)
