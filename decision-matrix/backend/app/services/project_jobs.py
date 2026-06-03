"""Project background jobs — persistence and enqueue guards."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProjectJob

JOB_STATUS_PENDING = "pending"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"

ACTIVE_STATUSES = (JOB_STATUS_PENDING, JOB_STATUS_RUNNING)

JOB_TYPE_AUTOROAD_CONNECT = "autoroad_connect"
JOB_TYPE_IMPORT_FILE = "import_file"
JOB_TYPE_SAND_LOGISTICS_ANALYZE = "sand_logistics_analyze"
JOB_TYPE_POI_ANALYZE_ALL = "poi_analyze_all"

ALLOWED_JOB_TYPES = frozenset(
    {
        JOB_TYPE_AUTOROAD_CONNECT,
        JOB_TYPE_IMPORT_FILE,
        JOB_TYPE_SAND_LOGISTICS_ANALYZE,
        JOB_TYPE_POI_ANALYZE_ALL,
    }
)


class ActiveProjectJobError(Exception):
    """Another job is already pending or running for this project."""

    def __init__(self, active_job_id: UUID) -> None:
        self.active_job_id = active_job_id
        super().__init__(f"Project already has active job {active_job_id}")


async def get_active_job_for_project(db: AsyncSession, project_id: UUID) -> ProjectJob | None:
    row = await db.scalar(
        select(ProjectJob)
        .where(
            ProjectJob.project_id == project_id,
            ProjectJob.status.in_(ACTIVE_STATUSES),
        )
        .order_by(ProjectJob.created_at.desc())
        .limit(1)
    )
    return row


async def create_project_job(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    job_type: str,
    payload: dict[str, Any],
) -> ProjectJob:
    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unknown job_type: {job_type}")
    active = await get_active_job_for_project(db, project_id)
    if active is not None:
        raise ActiveProjectJobError(active.id)
    job = ProjectJob(
        project_id=project_id,
        user_id=user_id,
        job_type=job_type,
        status=JOB_STATUS_PENDING,
        payload=payload,
    )
    db.add(job)
    try:
        await db.flush()
    except IntegrityError as e:
        active = await get_active_job_for_project(db, project_id)
        if active is not None:
            raise ActiveProjectJobError(active.id) from e
        raise
    return job


async def mark_job_running(db: AsyncSession, job: ProjectJob) -> None:
    job.status = JOB_STATUS_RUNNING
    job.started_at = datetime.now(timezone.utc)
    await db.flush()


async def mark_job_completed(db: AsyncSession, job: ProjectJob, result: dict[str, Any]) -> None:
    job.status = JOB_STATUS_COMPLETED
    job.result = result
    job.error_message = None
    job.finished_at = datetime.now(timezone.utc)
    await db.flush()


async def mark_job_failed(db: AsyncSession, job: ProjectJob, message: str) -> None:
    job.status = JOB_STATUS_FAILED
    job.error_message = message[:4000]
    job.finished_at = datetime.now(timezone.utc)
    await db.flush()


def job_to_dict(job: ProjectJob) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "project_id": str(job.project_id),
        "user_id": str(job.user_id),
        "job_type": job.job_type,
        "status": job.status,
        "payload": job.payload or {},
        "result": job.result,
        "error_message": job.error_message,
        "progress": job.progress,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }
