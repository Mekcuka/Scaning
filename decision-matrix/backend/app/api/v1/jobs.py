"""Project background jobs API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import ProjectJob, User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import (
    ProjectJobCreateRequest,
    ProjectJobCreateResponse,
    ProjectJobListResponse,
    ProjectJobResponse,
)
from app.services.job_queue import schedule_project_job
from app.services.project_jobs import (
    ALLOWED_JOB_TYPES,
    ActiveProjectJobError,
    cancel_active_job,
    create_project_job,
    expire_stale_job_if_needed,
    get_active_job_for_project,
    list_recent_jobs,
    reconcile_stale_active_job,
)
from app.services.project_access import resolve_project

jobs_router = APIRouter()


def _job_response(job: ProjectJob) -> ProjectJobResponse:
    return ProjectJobResponse.model_validate(job)


@jobs_router.post(
    "/projects/{project_id}/jobs",
    response_model=ProjectJobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_project_job_endpoint(
    project_id: UUID,
    data: ProjectJobCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    if data.job_type not in ALLOWED_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown job_type: {data.job_type}")
    try:
        job = await create_project_job(
            db,
            project_id=project_id,
            user_id=user.id,
            job_type=data.job_type,
            payload=data.payload,
        )
    except ActiveProjectJobError as e:
        raise HTTPException(
            status_code=409,
            detail={"message": "Project already has an active job", "active_job_id": str(e.active_job_id)},
        ) from e
    await db.commit()
    await db.refresh(job)
    schedule_project_job(job.id)
    return ProjectJobCreateResponse(
        job_id=job.id,
        job_type=job.job_type,
        status=job.status,
    )


@jobs_router.get("/projects/{project_id}/jobs", response_model=ProjectJobListResponse)
async def list_project_jobs(
    project_id: UUID,
    limit: int = Query(30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    rows, total = await list_recent_jobs(db, project_id, limit=limit)
    return ProjectJobListResponse(
        items=[_job_response(j) for j in rows],
        total=total,
        limit=limit,
    )


@jobs_router.get("/projects/{project_id}/jobs/active", response_model=ProjectJobResponse | None)
async def get_active_project_job(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    await reconcile_stale_active_job(db, project_id)
    await db.commit()
    job = await get_active_job_for_project(db, project_id)
    if not job:
        return None
    return _job_response(job)


@jobs_router.post("/projects/{project_id}/jobs/{job_id}/cancel", response_model=ProjectJobResponse)
async def cancel_project_job(
    project_id: UUID,
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    job = await db.get(ProjectJob, job_id)
    if not job or job.project_id != project_id:
        raise HTTPException(status_code=404, detail="Job not found")
    if await expire_stale_job_if_needed(db, job):
        await db.commit()
        await db.refresh(job)
        return _job_response(job)
    try:
        job = await cancel_active_job(db, project_id=project_id, job_id=job_id)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=409, detail=msg) from e
    await db.commit()
    await db.refresh(job)
    return _job_response(job)


@jobs_router.get("/projects/{project_id}/jobs/{job_id}", response_model=ProjectJobResponse)
async def get_project_job(
    project_id: UUID,
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    job = await db.get(ProjectJob, job_id)
    if not job or job.project_id != project_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_response(job)
