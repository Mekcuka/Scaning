"""Well trajectory BFF for pad infrastructure objects (oil_pad / gas_pad)."""

import base64
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map_deps import get_infra_object, require_infra_write
from app.core.database import get_db
from app.models import InfrastructureLayer, InfrastructureObject, User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import InfraObjectUpdate, ProjectJobCreateResponse
from app.services.infra_update import update_infra_object_record
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.project_access import resolve_project
from app.services.project_jobs import ActiveProjectJobError, JOB_TYPE_WELL_TRAJECTORY_COMPUTE, JOB_TYPE_WELL_TRAJECTORY_IMPORT
from app.services.well_trajectory.import_service import (
    ImportOptions,
    commit_import,
    import_async_threshold,
    preview_import,
)
from app.services.well_trajectory.import_witsml import WITSML_NOT_IMPLEMENTED_DETAIL
from app.services.well_trajectory.clearance_service import (
    CLEARANCE_SYNC_MAX_WELLS,
    count_valid_clearance_wells,
    fetch_project_pads,
    run_clearance_for_pad,
    run_clearance_for_project,
)
from app.services.well_trajectory.geojson import build_pad_geojson, build_project_geojson
from app.services.well_trajectory.schemas import (
    WellTrajectoryClearanceResponse,
    WellTrajectoryComputeResponse,
    WellTrajectoryDesignAllRequest,
    WellTrajectoryDesignAllResponse,
    WellTrajectoryDesignFromBottomholesRequest,
    WellTrajectoryDesignFromBottomholesResponse,
    WellTrajectoryDesignRequest,
    WellTrajectoryDesignResponse,
    WellTrajectoryGenerateResponse,
    WellTrajectoryGeoJsonResponse,
    WellTrajectoryImportCommitResponse,
    WellTrajectoryImportPreviewResponse,
    WellTrajectoryLastResponse,
    WellTrajectoryTargetsPatch,
    WellTrajectoryTargetsResponse,
    WellTrajectorySyncBottomholesResponse,
)
from app.services.well_trajectory.service import (
    assert_pad_object,
    build_last_response,
    compute_all_trajectories,
    design_all_from_targets,
    design_from_bottomholes,
    design_well_trajectory,
    generate_trajectories_from_layout,
    save_targets,
    sync_bottomholes_for_pad,
)
from app.services.well_trajectory.trajectory_store import (
    read_trajectories_json,
    store_clearance_results,
    store_computed_at,
    store_trajectories_json,
)
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES

well_trajectory_router = APIRouter(tags=["well-trajectory"])


def _planner_unavailable(exc: Exception) -> HTTPException:
    msg = str(exc).strip()
    if not msg or "Well trajectory disabled" in msg or "не установлен" in msg:
        msg = (
            "Модуль расчёта траекторий (well-trajectory-planner) не установлен. "
            "В backend venv: pip install -e ../../well-trajectory-planner "
            "или перезапустите run_local.py"
        )
    return HTTPException(status_code=503, detail=msg)


async def _maybe_enqueue_clearance_job(
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


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    return data


def _import_options(
    *,
    step_m: float | None,
    interpolate: bool,
) -> ImportOptions:
    return ImportOptions(
        step_m=step_m,
        interpolate=interpolate,
    )


async def _maybe_enqueue_import_job(
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


@well_trajectory_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/last",
    response_model=WellTrajectoryLastResponse,
)
async def get_well_trajectory_last(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return build_last_response(obj)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/generate-from-layout",
    response_model=WellTrajectoryGenerateResponse,
)
async def post_well_trajectory_generate_from_layout(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    try:
        response = generate_trajectories_from_layout(obj)
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    props = store_trajectories_json(obj.properties, response.trajectories)
    updated = await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    await db.refresh(updated)
    return response


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/design",
    response_model=WellTrajectoryDesignResponse,
)
async def post_well_trajectory_design(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    try:
        response = design_well_trajectory(obj, body)
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    trajectories = read_trajectories_json(obj.properties)
    trajectories[body.well_index] = response.trajectory
    props = store_trajectories_json(obj.properties, trajectories)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return response


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/compute",
    response_model=WellTrajectoryComputeResponse,
)
async def post_well_trajectory_compute(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    try:
        response = compute_all_trajectories(obj)
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    props = store_trajectories_json(obj.properties, response.trajectories)
    props = store_computed_at(props)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return response


@well_trajectory_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/geojson",
    response_model=WellTrajectoryGeoJsonResponse,
)
async def get_well_trajectory_geojson(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return build_pad_geojson(obj)


@well_trajectory_router.get(
    "/projects/{project_id}/well-trajectory/geojson",
    response_model=WellTrajectoryGeoJsonResponse,
)
async def get_project_well_trajectory_geojson(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype.in_(PAD_CLUSTER_SUBTYPES),
        )
    )
    pads = list(result.scalars().all())
    return build_project_geojson(pads)


@well_trajectory_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/targets",
    response_model=WellTrajectoryTargetsResponse,
)
async def patch_well_trajectory_targets(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryTargetsPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    response = save_targets(obj, body)
    props = store_trajectories_json(obj.properties, response.trajectories)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return response


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/design-all",
    response_model=WellTrajectoryDesignAllResponse,
)
async def post_well_trajectory_design_all(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignAllRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    try:
        response = design_all_from_targets(obj, body)
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    props = store_trajectories_json(obj.properties, response.trajectories)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return response


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/sync-bottomholes",
    response_model=WellTrajectorySyncBottomholesResponse,
)
async def post_well_trajectory_sync_bottomholes(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    response = await sync_bottomholes_for_pad(db, obj, project_id=project_id)
    props = store_trajectories_json(obj.properties, response.trajectories)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return response


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/design-from-bottomholes",
    response_model=WellTrajectoryDesignFromBottomholesResponse,
)
async def post_well_trajectory_design_from_bottomholes(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignFromBottomholesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    try:
        response = await design_from_bottomholes(db, obj, body, project_id=project_id)
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    props = store_trajectories_json(obj.properties, response.trajectories)
    await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props),
    )
    await db.commit()
    return response


@well_trajectory_router.post(
    "/projects/{project_id}/well-trajectory/clearance",
    response_model=WellTrajectoryClearanceResponse,
)
async def post_project_well_trajectory_clearance(
    project_id: UUID,
    async_mode: bool = Query(default=False, alias="async"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    pads = await fetch_project_pads(db, project_id)
    wells_count = count_valid_clearance_wells(pads)
    queued = await _maybe_enqueue_clearance_job(
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
        raise _planner_unavailable(exc) from exc
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


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/clearance",
    response_model=WellTrajectoryClearanceResponse,
)
async def post_pad_well_trajectory_clearance(
    project_id: UUID,
    object_id: UUID,
    async_mode: bool = Query(default=False, alias="async"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    wells_count = count_valid_clearance_wells([obj])
    queued = await _maybe_enqueue_clearance_job(
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
        raise _planner_unavailable(exc) from exc
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


async def _apply_import_commit(
    db: AsyncSession,
    *,
    project,
    project_id: UUID,
    user: User,
    obj: InfrastructureObject,
    result,
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


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/preview",
    response_model=WellTrajectoryImportPreviewResponse,
)
async def post_well_trajectory_import_preview(
    project_id: UUID,
    object_id: UUID,
    format: str = Query(..., pattern="^(csv|wbp)$"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    file_bytes = await _read_upload(file)
    try:
        preview = preview_import(
            obj,
            format=format,  # type: ignore[arg-type]
            content=file_bytes.decode("utf-8", errors="replace") if format == "csv" else file_bytes,
        )
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
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


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/csv",
    response_model=WellTrajectoryImportCommitResponse,
)
async def post_well_trajectory_import_csv(
    project_id: UUID,
    object_id: UUID,
    file: UploadFile = File(...),
    async_mode: bool = Query(default=False, alias="async"),
    step_m: float | None = Query(default=None, gt=0, le=500),
    interpolate: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    file_bytes = await _read_upload(file)
    options = _import_options(step_m=step_m, interpolate=interpolate)
    try:
        preview = preview_import(
            obj,
            format="csv",
            content=file_bytes.decode("utf-8", errors="replace"),
            options=options,
        )
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    queued = await _maybe_enqueue_import_job(
        db,
        project_id=project_id,
        user=user,
        pad_id=object_id,
        format="csv",
        file_bytes=file_bytes,
        options=options,
        force_async=async_mode,
        well_count=preview.well_count,
    )
    if queued is not None:
        return queued
    try:
        result = commit_import(
            obj,
            format="csv",
            content=file_bytes.decode("utf-8", errors="replace"),
            options=options,
        )
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    return await _apply_import_commit(
        db, project=project, project_id=project_id, user=user, obj=obj, result=result
    )


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/wbp",
    response_model=WellTrajectoryImportCommitResponse,
)
async def post_well_trajectory_import_wbp(
    project_id: UUID,
    object_id: UUID,
    file: UploadFile = File(...),
    async_mode: bool = Query(default=False, alias="async"),
    step_m: float | None = Query(default=None, gt=0, le=500),
    interpolate: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    file_bytes = await _read_upload(file)
    options = _import_options(step_m=step_m, interpolate=interpolate)
    try:
        preview = preview_import(obj, format="wbp", content=file_bytes, options=options)
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    queued = await _maybe_enqueue_import_job(
        db,
        project_id=project_id,
        user=user,
        pad_id=object_id,
        format="wbp",
        file_bytes=file_bytes,
        options=options,
        force_async=async_mode,
        well_count=preview.well_count,
    )
    if queued is not None:
        return queued
    try:
        result = commit_import(obj, format="wbp", content=file_bytes, options=options)
    except RuntimeError as exc:
        raise _planner_unavailable(exc) from exc
    return await _apply_import_commit(
        db, project=project, project_id=project_id, user=user, obj=obj, result=result
    )


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/witsml",
)
async def post_well_trajectory_import_witsml(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    raise HTTPException(status_code=501, detail=WITSML_NOT_IMPLEMENTED_DETAIL)
