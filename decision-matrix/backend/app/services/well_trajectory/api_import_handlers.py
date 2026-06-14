"""Import HTTP handlers for well trajectory BFF."""

from __future__ import annotations

import base64
from typing import Any
from uuid import UUID

from fastapi import HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureObject, Project, User
from app.schemas import InfraObjectUpdate, ProjectJobCreateResponse
from app.services.infra_update import update_infra_object_record
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.project_jobs import ActiveProjectJobError, JOB_TYPE_WELL_TRAJECTORY_IMPORT
from app.services.well_trajectory.api_common import (
    import_options,
    read_pad_for_read,
    read_pad_for_write,
    run_planner,
)
from app.services.well_trajectory.import_service import (
    ImportOptions,
    commit_import,
    import_async_threshold,
    preview_import,
)
from app.services.well_trajectory.import_witsml import WITSML_NOT_IMPLEMENTED_DETAIL
from app.services.well_trajectory.schemas import (
    WellTrajectoryImportCommitResponse,
    WellTrajectoryImportPreviewResponse,
)
from app.services.well_trajectory.trajectory_store import (
    store_clearance_results,
    store_computed_at,
    store_trajectories_json,
)


async def read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    return data


async def maybe_enqueue_import_job(
    db: AsyncSession,
    *,
    project_id: UUID,
    user: User,
    pad_id: UUID,
    format: str,
    file_bytes: bytes,
    options: ImportOptions,
    force_async: bool,
    well_count: int,
) -> JSONResponse | None:
    if not force_async and well_count <= import_async_threshold():
        return None
    if not jobs_async_enabled():
        if well_count > import_async_threshold():
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Too many wells ({well_count}) for sync import; "
                    f"enable ARQ jobs or reduce file size"
                ),
            )
        return None
    try:
        job = await create_and_schedule_job(
            db,
            project_id=project_id,
            user_id=user.id,
            job_type=JOB_TYPE_WELL_TRAJECTORY_IMPORT,
            payload={
                "pad_id": str(pad_id),
                "format": format,
                "content_b64": base64.b64encode(file_bytes).decode("ascii"),
                "options": {
                    "step_m": options.step_m,
                    "interpolate": options.interpolate,
                    "match_mode": options.match_mode,
                },
            },
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


async def apply_import_commit(
    db: AsyncSession,
    *,
    project: Project,
    project_id: UUID,
    user: User,
    obj: InfrastructureObject,
    result: Any,
) -> WellTrajectoryImportCommitResponse:
    props = store_trajectories_json(obj.properties, result.trajectories)
    props = store_computed_at(props)
    props = store_clearance_results(props, pairs=[], computed_at=result.computed_at)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return WellTrajectoryImportCommitResponse(
        trajectories=result.trajectories,
        computed_at=result.computed_at,
        warnings=result.warnings,
        imported_count=result.imported_count,
    )


async def handle_import_preview(
    project_id: UUID,
    object_id: UUID,
    format: str,
    file: UploadFile,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryImportPreviewResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    file_bytes = await read_upload(file)
    preview = run_planner(
        preview_import,
        obj,
        format=format,  # type: ignore[arg-type]
        content=file_bytes.decode("utf-8", errors="replace") if format == "csv" else file_bytes,
    )
    return WellTrajectoryImportPreviewResponse(
        wells=[
            {
                "name": w.name,
                "station_count": w.station_count,
                "matched_index": w.matched_index,
                "warnings": w.warnings,
            }
            for w in preview.wells
        ],
        errors=preview.errors,
        well_count=preview.well_count,
        warnings=preview.warnings,
    )


async def _handle_import_file(
    *,
    project_id: UUID,
    object_id: UUID,
    file: UploadFile,
    format: str,
    async_mode: bool,
    step_m: float | None,
    interpolate: bool,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryImportCommitResponse | JSONResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    file_bytes = await read_upload(file)
    options = import_options(step_m=step_m, interpolate=interpolate)
    content: str | bytes = (
        file_bytes.decode("utf-8", errors="replace") if format == "csv" else file_bytes
    )
    preview = run_planner(preview_import, obj, format=format, content=content, options=options)
    queued = await maybe_enqueue_import_job(
        db,
        project_id=project_id,
        user=user,
        pad_id=object_id,
        format=format,
        file_bytes=file_bytes,
        options=options,
        force_async=async_mode,
        well_count=preview.well_count,
    )
    if queued is not None:
        return queued
    result = run_planner(commit_import, obj, format=format, content=content, options=options)
    return await apply_import_commit(
        db, project=project, project_id=project_id, user=user, obj=obj, result=result
    )


async def handle_import_csv(
    project_id: UUID,
    object_id: UUID,
    file: UploadFile,
    async_mode: bool,
    step_m: float | None,
    interpolate: bool,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryImportCommitResponse | JSONResponse:
    return await _handle_import_file(
        project_id=project_id,
        object_id=object_id,
        file=file,
        format="csv",
        async_mode=async_mode,
        step_m=step_m,
        interpolate=interpolate,
        user=user,
        db=db,
    )


async def handle_import_wbp(
    project_id: UUID,
    object_id: UUID,
    file: UploadFile,
    async_mode: bool,
    step_m: float | None,
    interpolate: bool,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryImportCommitResponse | JSONResponse:
    return await _handle_import_file(
        project_id=project_id,
        object_id=object_id,
        file=file,
        format="wbp",
        async_mode=async_mode,
        step_m=step_m,
        interpolate=interpolate,
        user=user,
        db=db,
    )


async def handle_import_witsml(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> None:
    await read_pad_for_write(project_id, object_id, user, db)
    raise HTTPException(status_code=501, detail=WITSML_NOT_IMPLEMENTED_DETAIL)
