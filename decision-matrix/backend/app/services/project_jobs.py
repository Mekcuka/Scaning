"""Project background jobs — persistence and enqueue guards."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_job_stale(job: ProjectJob, *, now: datetime | None = None) -> bool:
    """True if pending/running job is older than configured thresholds."""
    now = now or _utcnow()
    if job.status == JOB_STATUS_PENDING:
        created = job.created_at
        if created is None:
            return False
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (now - created).total_seconds() > settings.JOB_STALE_PENDING_SECONDS
    if job.status == JOB_STATUS_RUNNING:
        anchor = job.started_at or job.created_at
        if anchor is None:
            return False
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=timezone.utc)
        return (now - anchor).total_seconds() > settings.JOB_STALE_RUNNING_SECONDS
    return False


async def expire_stale_job_if_needed(db: AsyncSession, job: ProjectJob) -> bool:
    """Mark a stale active job as failed. Returns True if the job was expired."""
    if job.status not in ACTIVE_STATUSES or not is_job_stale(job):
        return False
    await mark_job_failed(
        db,
        job,
        "Задача зависла (истёк таймаут ожидания). Повторите расчёт.",
    )
    return True


async def reconcile_stale_active_job(db: AsyncSession, project_id: UUID) -> None:
    """Clear a stuck pending/running job before creating a new one."""
    active = await get_active_job_for_project(db, project_id)
    if active is not None:
        await expire_stale_job_if_needed(db, active)


async def list_recent_jobs(
    db: AsyncSession,
    project_id: UUID,
    *,
    limit: int = 30,
) -> tuple[list[ProjectJob], int]:
    """Recent jobs for a project, newest first."""
    limit = max(1, min(limit, 100))
    total = int(
        await db.scalar(
            select(func.count()).select_from(ProjectJob).where(ProjectJob.project_id == project_id)
        )
        or 0
    )
    rows = (
        await db.execute(
            select(ProjectJob)
            .where(ProjectJob.project_id == project_id)
            .order_by(ProjectJob.created_at.desc(), ProjectJob.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    return list(rows), total


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
    await reconcile_stale_active_job(db, project_id)
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
    job.finished_at = _utcnow()
    await db.flush()


async def mark_job_cancelled(db: AsyncSession, job: ProjectJob, message: str = "Отменено пользователем") -> None:
    job.status = JOB_STATUS_CANCELLED
    job.error_message = message[:4000]
    job.finished_at = _utcnow()
    await db.flush()


async def cancel_active_job(
    db: AsyncSession,
    *,
    project_id: UUID,
    job_id: UUID,
) -> ProjectJob:
    """Cancel pending job or force-cancel stale running job."""
    job = await db.get(ProjectJob, job_id)
    if not job or job.project_id != project_id:
        raise ValueError("Job not found")
    if job.status not in ACTIVE_STATUSES:
        raise ValueError("Job is not active")
    if job.status == JOB_STATUS_RUNNING and not is_job_stale(job):
        raise ValueError("Running job is not stale; wait for completion or worker timeout")
    await mark_job_cancelled(db, job)
    return job


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
