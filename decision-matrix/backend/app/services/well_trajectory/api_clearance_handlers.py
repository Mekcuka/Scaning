"""Clearance HTTP handlers for well trajectory BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import require_infra_write
from app.models import User
from app.schemas import InfraObjectUpdate, ProjectJobCreateResponse
from app.services.infra_update import update_infra_object_record
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.project_jobs import ActiveProjectJobError, JOB_TYPE_WELL_TRAJECTORY_COMPUTE
from app.services.well_trajectory.api_common import planner_unavailable_http, read_pad_for_write
from app.services.well_trajectory.clearance_service import (
    CLEARANCE_SYNC_MAX_WELLS,
    count_valid_clearance_wells,
    fetch_project_pads,
    run_clearance_for_pad,
    run_clearance_for_project,
)
from app.services.well_trajectory.schemas import WellTrajectoryClearanceResponse


async def maybe_enqueue_clearance_job(
    db: AsyncSession,
    *,
    project_id: UUID,
    user: User,
    payload: dict,
    wells_count: int,
    force_async: bool,
) -> JSONResponse | None:
    if force_async or wells_count > CLEARANCE_SYNC_MAX_WELLS:
        if not jobs_async_enabled():
            if wells_count > CLEARANCE_SYNC_MAX_WELLS:
                raise HTTPException(
                    status_code=503,
                    detail=f"Too many wells ({wells_count}) for sync clearance; enable ARQ jobs",
                )
            return None
        try:
            job = await create_and_schedule_job(
                db,
                project_id=project_id,
                user_id=user.id,
                job_type=JOB_TYPE_WELL_TRAJECTORY_COMPUTE,
                payload=payload,
            )
            await commit_and_schedule(db, job)
        except ActiveProjectJobError as e:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Project already has an active job",
                    "active_job_id": str(e.active_job_id),
                },
            ) from e
        resp = ProjectJobCreateResponse(job_id=job.id, job_type=job.job_type, status=job.status)
        return JSONResponse(status_code=202, content=resp.model_dump(mode="json"))
    return None


async def handle_project_clearance(
    project_id: UUID,
    async_mode: bool,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryClearanceResponse | JSONResponse:
    project = await require_infra_write(project_id, user, db)
    pads = await fetch_project_pads(db, project_id)
    wells_count = count_valid_clearance_wells(pads)
    queued = await maybe_enqueue_clearance_job(
        db,
        project_id=project_id,
        user=user,
        payload={},
        wells_count=wells_count,
        force_async=async_mode,
    )
    if queued is not None:
        return queued
    try:
        response = await run_clearance_for_project(db, project_id)
    except RuntimeError as exc:
        raise planner_unavailable_http(exc) from exc
    for pad in pads:
        if pad.properties:
            await update_infra_object_record(
                db,
                project=project,
                project_id=project_id,
                user=user,
                obj=pad,
                data=InfraObjectUpdate(properties=pad.properties),
            )
    await db.commit()
    return response


async def handle_pad_clearance(
    project_id: UUID,
    object_id: UUID,
    async_mode: bool,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryClearanceResponse | JSONResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    wells_count = count_valid_clearance_wells([obj])
    queued = await maybe_enqueue_clearance_job(
        db,
        project_id=project_id,
        user=user,
        payload={"object_id": str(object_id)},
        wells_count=wells_count,
        force_async=async_mode,
    )
    if queued is not None:
        return queued
    try:
        response = await run_clearance_for_pad(db, project_id, object_id)
    except RuntimeError as exc:
        raise planner_unavailable_http(exc) from exc
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=obj.properties),
    )
    await db.commit()
    return response
