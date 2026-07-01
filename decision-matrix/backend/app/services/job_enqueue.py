"""Helpers to create and schedule project jobs from API handlers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import ProjectJob
from app.services.job_queue import enqueue_project_job
from app.services.project_jobs import (
    create_project_job,
    mark_job_completed,
    mark_job_failed,
    mark_job_running,
)

T = TypeVar("T")


def jobs_async_enabled() -> bool:
    """SQLite runs jobs in-request — no background queue (avoids database is locked)."""
    if settings.is_sqlite:
        return False
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
    await enqueue_project_job(job.id)


def _result_to_job_payload(result: Any) -> dict[str, Any]:
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")
    if isinstance(result, dict):
        return result
    return {"value": result}


def _http_exception_message(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, str):
        return detail
    return str(detail)


async def run_project_job_inline(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    job_type: str,
    payload: dict[str, Any],
    runner: Callable[[], Awaitable[T]],
) -> T:
    """Create a ProjectJob, run synchronously, and persist terminal status (SQLite / sync)."""
    job = await create_project_job(
        db,
        project_id=project_id,
        user_id=user_id,
        job_type=job_type,
        payload=payload,
    )
    await mark_job_running(db, job)
    try:
        result = await runner()
        await mark_job_completed(db, job, _result_to_job_payload(result))
        await db.commit()
        return result
    except HTTPException as exc:
        await mark_job_failed(db, job, _http_exception_message(exc))
        await db.commit()
        raise
    except Exception as exc:
        await mark_job_failed(db, job, str(exc))
        await db.commit()
        raise
