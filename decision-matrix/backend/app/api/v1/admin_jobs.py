"""Admin API for background job journal."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_csrf
from app.api.rbac import require_admin
from app.core.database import get_db
from app.models import User
from app.schemas import (
    AdminJobsHealthResponse,
    ProjectJobAdminItem,
    ProjectJobAdminListResponse,
)
from app.services.admin_jobs import (
    admin_cancel_job,
    fetch_admin_jobs_health,
    get_job_admin_row,
    list_jobs_admin,
)
from app.services.project_jobs import ALLOWED_JOB_TYPES

admin_jobs_router = APIRouter(
    prefix="/admin/jobs",
    tags=["admin-jobs"],
    dependencies=[Depends(verify_csrf)],
)


def _to_admin_item(row) -> ProjectJobAdminItem:
    job = row.job
    return ProjectJobAdminItem(
        id=job.id,
        project_id=job.project_id,
        user_id=job.user_id,
        job_type=job.job_type,
        status=job.status,
        payload=job.payload or {},
        result=job.result,
        error_message=job.error_message,
        progress=job.progress,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        user_email=row.user_email,
        user_username=row.user_username,
        project_name=row.project_name,
    )


@admin_jobs_router.get("", response_model=ProjectJobAdminListResponse)
async def list_admin_jobs(
    status: list[str] | None = Query(default=None),
    job_type: str | None = None,
    project_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if job_type is not None and job_type not in ALLOWED_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown job_type: {job_type}")
    rows, total = await list_jobs_admin(
        db,
        statuses=status,
        job_type=job_type,
        project_id=project_id,
        limit=limit,
        offset=offset,
    )
    return ProjectJobAdminListResponse(
        items=[_to_admin_item(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@admin_jobs_router.get("/health", response_model=AdminJobsHealthResponse)
async def admin_jobs_health(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    health = await fetch_admin_jobs_health(db)
    return AdminJobsHealthResponse(
        redis_ok=health.redis_ok,
        redis_error=health.redis_error,
        queue_name=health.queue_name,
        jobs_use_queue=health.jobs_use_queue,
        jobs_by_status=health.jobs_by_status,
        active_jobs=health.active_jobs,
    )


@admin_jobs_router.post("/{job_id}/cancel", response_model=ProjectJobAdminItem)
async def admin_cancel_job_endpoint(
    job_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        await admin_cancel_job(db, job_id)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Job not found") from e
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    row = await get_job_admin_row(db, job_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return _to_admin_item(row)
