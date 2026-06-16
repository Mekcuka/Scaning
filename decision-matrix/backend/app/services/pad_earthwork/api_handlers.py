"""HTTP orchestration for pad earthwork BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_infra_object, require_infra_write
from app.models import InfrastructureObject, Project, User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import InfraObjectUpdate, ProjectJobCreateResponse
from app.services.infra_update import update_infra_object_record
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.pad_earthwork.dem_preview import build_dem_preview_for_object
from app.services.pad_earthwork.earthwork_store import build_last_response, pad_params_patch_delta
from app.services.pad_earthwork.schemas import (
    PadDemFetchResponseOut,
    PadDemPreviewRequest,
    PadDemPreviewResponseOut,
    PadEarthworkComputeRequest,
    PadEarthworkComputeResponse,
    PadEarthworkLastResponse,
    PadEarthworkParamsPatch,
    PadEarthworkSketchSaveRequest,
    SketchPreviewRequestIn,
    SketchPreviewResponseOut,
    WellLayoutGenerateRequestIn,
    WellLayoutGenerateResponseOut,
)
from app.services.pad_earthwork.service import (
    assert_earthwork_object,
    assert_pad_object,
    compute_pad_earthwork_for_object,
    fetch_dem_for_object,
    generate_pad_sketch_from_wells,
    persist_dem_properties_for_compute,
    preview_pad_sketch,
    save_pad_sketch_for_object,
)
from app.services.project_access import resolve_project
from app.services.project_jobs import JOB_TYPE_PAD_EARTHWORK_COMPUTE, ActiveProjectJobError
from app.services.serializers import infra_to_public_json


async def read_earthwork_for_read(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> InfrastructureObject:
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_earthwork_object(obj)
    return obj


async def read_earthwork_for_write(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> tuple[Project, InfrastructureObject]:
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_earthwork_object(obj)
    return project, obj


async def read_pad_for_read(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> InfrastructureObject:
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return obj


async def handle_sketch_preview(
    project_id: UUID,
    body: SketchPreviewRequestIn,
    user: User,
    db: AsyncSession,
) -> SketchPreviewResponseOut:
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    return preview_pad_sketch(body)


async def handle_dem_upload_not_supported(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> None:
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    raise HTTPException(status_code=501, detail="dem_upload_not_supported_use_fetch")


async def handle_dem_fetch(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkComputeRequest | None,
    user: User,
    db: AsyncSession,
) -> PadDemFetchResponseOut:
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_earthwork_object(obj)
    result, props_updates = await fetch_dem_for_object(db, project_id, obj, body)
    if props_updates:
        props = dict(obj.properties or {})
        props.update(props_updates)
        obj.properties = props
        await db.commit()
        await db.refresh(obj)
    return result


async def handle_dem_preview(
    project_id: UUID,
    object_id: UUID,
    body: PadDemPreviewRequest | None,
    user: User,
    db: AsyncSession,
) -> PadDemPreviewResponseOut:
    obj = await read_earthwork_for_read(project_id, object_id, user, db)
    compute_body = (
        PadEarthworkComputeRequest.model_validate(body.model_dump()) if body is not None else None
    )
    return await build_dem_preview_for_object(db, project_id, obj, compute_body)


async def handle_compute(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkComputeRequest | None,
    user: User,
    db: AsyncSession,
) -> PadEarthworkComputeResponse | JSONResponse:
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_earthwork_object(obj)

    terrain_mode = body.terrain.mode if body and body.terrain else "flat"
    if terrain_mode == "dem" and jobs_async_enabled():
        try:
            job = await create_and_schedule_job(
                db,
                project_id=project_id,
                user_id=user.id,
                job_type=JOB_TYPE_PAD_EARTHWORK_COMPUTE,
                payload={
                    "object_id": str(object_id),
                    **(body.model_dump(mode="json") if body else {}),
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

    dem_patch = await persist_dem_properties_for_compute(db, project_id, obj, body)
    if dem_patch:
        props = dict(obj.properties or {})
        props.update(dem_patch)
        obj.properties = props
        await db.commit()
        await db.refresh(obj)

    result, props = await compute_pad_earthwork_for_object(db, obj, body, project_id=project_id)
    obj.properties = props
    await db.commit()
    await db.refresh(obj)
    return result


async def handle_get_last(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> PadEarthworkLastResponse:
    obj = await read_earthwork_for_read(project_id, object_id, user, db)
    return build_last_response(obj.properties)


async def handle_patch_params(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkParamsPatch,
    user: User,
    db: AsyncSession,
):
    project, obj = await read_earthwork_for_write(project_id, object_id, user, db)
    props_patch = pad_params_patch_delta(body)
    if not props_patch:
        raise HTTPException(status_code=400, detail="No pad params provided")
    updated = await update_infra_object_record(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        data=InfraObjectUpdate(properties=props_patch),
    )
    await db.commit()
    await db.refresh(updated)
    return infra_to_public_json(updated)


async def handle_sketch_generate(
    project_id: UUID,
    object_id: UUID,
    body: WellLayoutGenerateRequestIn | None,
    user: User,
    db: AsyncSession,
) -> WellLayoutGenerateResponseOut:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    return generate_pad_sketch_from_wells(obj, body)


async def handle_patch_sketch(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkSketchSaveRequest,
    user: User,
    db: AsyncSession,
):
    project, obj = await read_earthwork_for_write(project_id, object_id, user, db)
    props = save_pad_sketch_for_object(obj, body)
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
    return infra_to_public_json(updated)
