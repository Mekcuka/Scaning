"""Admin views over project background jobs and queue health."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Project, ProjectJob, User
from app.services.project_jobs import (
    ACTIVE_STATUSES,
    JOB_STATUS_CANCELLED,
    JOB_STATUS_COMPLETED,
    JOB_STATUS_FAILED,
    JOB_STATUS_PENDING,
    JOB_STATUS_RUNNING,
    expire_stale_job_if_needed,
    mark_job_cancelled,
)

TERMINAL_STATUSES = frozenset(
    {JOB_STATUS_COMPLETED, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}
)

ALL_STATUSES = frozenset(
    {
        JOB_STATUS_PENDING,
        JOB_STATUS_RUNNING,
        JOB_STATUS_COMPLETED,
        JOB_STATUS_FAILED,
        JOB_STATUS_CANCELLED,
    }
)


@dataclass
class ProjectJobAdminRow:
    job: ProjectJob
    user_email: str
    user_username: str
    project_name: str


@dataclass
class AdminJobsHealth:
    redis_ok: bool
    redis_error: str | None
    queue_name: str
    jobs_use_queue: bool
    jobs_by_status: dict[str, int]
    active_jobs: list[dict[str, Any]]


async def list_jobs_admin(
    db: AsyncSession,
    *,
    statuses: list[str] | None = None,
    job_type: str | None = None,
    project_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ProjectJobAdminRow], int]:
    base = (
        select(ProjectJob, User.email, User.username, Project.name)
        .join(User, ProjectJob.user_id == User.id)
        .join(Project, ProjectJob.project_id == Project.id)
    )
    count_stmt = (
        select(func.count())
        .select_from(ProjectJob)
        .join(User, ProjectJob.user_id == User.id)
        .join(Project, ProjectJob.project_id == Project.id)
    )

    if statuses:
        valid = [s for s in statuses if s in ALL_STATUSES]
        if valid:
            base = base.where(ProjectJob.status.in_(valid))
            count_stmt = count_stmt.where(ProjectJob.status.in_(valid))
    if job_type:
        base = base.where(ProjectJob.job_type == job_type)
        count_stmt = count_stmt.where(ProjectJob.job_type == job_type)
    if project_id is not None:
        base = base.where(ProjectJob.project_id == project_id)
        count_stmt = count_stmt.where(ProjectJob.project_id == project_id)

    total = int(await db.scalar(count_stmt) or 0)
    result = await db.execute(
        base.order_by(ProjectJob.created_at.desc()).limit(limit).offset(offset)
    )
    rows: list[ProjectJobAdminRow] = []
    for job, email, username, project_name in result.all():
        rows.append(
            ProjectJobAdminRow(
                job=job,
                user_email=email,
                user_username=username,
                project_name=project_name,
            )
        )
    return rows, total


async def reconcile_all_stale_active_jobs(db: AsyncSession) -> int:
    """Expire stale pending/running jobs. Returns count updated."""
    result = await db.execute(
        select(ProjectJob).where(ProjectJob.status.in_(ACTIVE_STATUSES))
    )
    expired = 0
    for job in result.scalars().all():
        if await expire_stale_job_if_needed(db, job):
            expired += 1
    if expired:
        await db.flush()
    return expired


async def get_job_admin_row(db: AsyncSession, job_id: UUID) -> ProjectJobAdminRow | None:
    result = await db.execute(
        select(ProjectJob, User.email, User.username, Project.name)
        .join(User, ProjectJob.user_id == User.id)
        .join(Project, ProjectJob.project_id == Project.id)
        .where(ProjectJob.id == job_id)
        .limit(1)
    )
    row = result.first()
    if not row:
        return None
    job, email, username, project_name = row
    return ProjectJobAdminRow(
        job=job,
        user_email=email,
        user_username=username,
        project_name=project_name,
    )


async def admin_cancel_job(db: AsyncSession, job_id: UUID) -> ProjectJob:
    """Idempotent admin cancel; returns current job if already terminal."""
    job = await db.get(ProjectJob, job_id)
    if not job:
        raise ValueError("Job not found")
    if job.status in TERMINAL_STATUSES:
        return job
    if job.status in ACTIVE_STATUSES:
        await mark_job_cancelled(db, job, "Отменено администратором")
    return job


async def fetch_admin_jobs_health(db: AsyncSession) -> AdminJobsHealth:
    await reconcile_all_stale_active_jobs(db)
    await db.commit()

    counts: dict[str, int] = {s: 0 for s in ALL_STATUSES}
    rows = await db.execute(
        select(ProjectJob.status, func.count()).group_by(ProjectJob.status)
    )
    for status, cnt in rows.all():
        counts[status] = int(cnt)

    active_result = await db.execute(
        select(ProjectJob, User.email, Project.name)
        .join(User, ProjectJob.user_id == User.id)
        .join(Project, ProjectJob.project_id == Project.id)
        .where(ProjectJob.status.in_(ACTIVE_STATUSES))
        .order_by(ProjectJob.created_at.desc())
        .limit(20)
    )
    active_jobs: list[dict[str, Any]] = []
    for job, email, project_name in active_result.all():
        active_jobs.append(
            {
                "id": str(job.id),
                "project_id": str(job.project_id),
                "project_name": project_name,
                "user_email": email,
                "job_type": job.job_type,
                "status": job.status,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
            }
        )

    redis_ok = False
    redis_error: str | None = None
    if settings.jobs_use_queue:
        try:
            import redis.asyncio as aioredis

            client = aioredis.from_url(settings.REDIS_URL)
            try:
                await client.ping()
                redis_ok = True
            finally:
                await client.aclose()
        except Exception as e:
            redis_error = str(e)[:500]
    else:
        redis_error = "REDIS_URL не задан (очередь отключена, JOBS_SYNC_FALLBACK)"

    return AdminJobsHealth(
        redis_ok=redis_ok,
        redis_error=redis_error,
        queue_name=settings.ARQ_QUEUE_NAME,
        jobs_use_queue=settings.jobs_use_queue,
        jobs_by_status=counts,
        active_jobs=active_jobs,
    )
