"""Pad earthwork BFF for oil_pad / gas_pad objects."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map_deps import get_infra_object, require_infra_write
from app.core.database import get_db
from app.models import User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import InfraObjectResponse, InfraObjectUpdate, ProjectJobCreateResponse
from app.services.infra_update import update_infra_object_record
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.pad_earthwork.earthwork_store import build_last_response, pad_params_patch_delta
from app.services.pad_earthwork.schemas import (
    PadDemFetchResponseOut,
    PadDemPreviewRequest,
    PadDemPreviewResponseOut,
    PadDemProfileSampleRequest,
    PadDemProfileSampleResponse,
    PadEarthworkComputeRequest,
    PadEarthworkComputeResponse,
    PadEarthworkLastResponse,
    PadEarthworkParamsPatch,
    PadEarthworkProfileSaveRequest,
    PadEarthworkSketchSaveRequest,
    SketchPreviewRequestIn,
    SketchPreviewResponseOut,
    WellLayoutGenerateRequestIn,
    WellLayoutGenerateResponseOut,
)
from app.services.pad_earthwork.service import (
    assert_pad_object,
    compute_pad_earthwork_for_object,
    fetch_dem_for_object,
    generate_pad_sketch_from_wells,
    persist_dem_properties_for_compute,
    preview_pad_sketch,
    save_pad_profile_for_object,
    save_pad_sketch_for_object,
)
from app.services.pad_earthwork.dem_preview import build_dem_preview_for_object
from app.services.pad_earthwork.dem_profile_sample import build_dem_profile_sample_for_object
from app.services.project_access import resolve_project
from app.services.project_jobs import JOB_TYPE_PAD_EARTHWORK_COMPUTE, ActiveProjectJobError
from app.services.serializers import infra_to_response

pad_earthwork_router = APIRouter(tags=["pad-earthwork"])


@pad_earthwork_router.post(
    "/projects/{project_id}/pad-earthwork/sketch/preview",
    response_model=SketchPreviewResponseOut,
)
async def post_pad_earthwork_sketch_preview(
    project_id: UUID,
    body: SketchPreviewRequestIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    return preview_pad_sketch(body)


@pad_earthwork_router.post("/projects/{project_id}/pad-earthwork/dem")
async def post_pad_earthwork_dem_upload(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manual GeoTIFF upload — not implemented; use object dem/fetch."""
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    raise HTTPException(status_code=501, detail="dem_upload_not_supported_use_fetch")


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/dem/fetch",
    response_model=PadDemFetchResponseOut,
)
async def post_pad_earthwork_dem_fetch(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkComputeRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    result, props_updates = await fetch_dem_for_object(project_id, obj, body)
    if props_updates:
        props = dict(obj.properties or {})
        props.update(props_updates)
        obj.properties = props
        await db.commit()
        await db.refresh(obj)
    return result


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/dem/preview",
    response_model=PadDemPreviewResponseOut,
)
async def post_pad_earthwork_dem_preview(
    project_id: UUID,
    object_id: UUID,
    body: PadDemPreviewRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    compute_body = (
        PadEarthworkComputeRequest.model_validate(body.model_dump())
        if body is not None
        else None
    )
    return build_dem_preview_for_object(project_id, obj, compute_body)


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/dem/profile/sample",
    response_model=PadDemProfileSampleResponse,
)
async def post_pad_earthwork_dem_profile_sample(
    project_id: UUID,
    object_id: UUID,
    body: PadDemProfileSampleRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return build_dem_profile_sample_for_object(project_id, obj, body)


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/compute",
    response_model=PadEarthworkComputeResponse,
)
async def post_pad_earthwork_compute(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkComputeRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)

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

    dem_patch = await persist_dem_properties_for_compute(project_id, obj, body)
    if dem_patch:
        props = dict(obj.properties or {})
        props.update(dem_patch)
        obj.properties = props
        await db.commit()
        await db.refresh(obj)

    result, props = await compute_pad_earthwork_for_object(obj, body, project_id=project_id)
    obj.properties = props
    await db.commit()
    await db.refresh(obj)
    return result


@pad_earthwork_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/last",
    response_model=PadEarthworkLastResponse,
)
async def get_pad_earthwork_last(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return build_last_response(obj.properties)


@pad_earthwork_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/params",
    response_model=InfraObjectResponse,
)
async def patch_pad_earthwork_params(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkParamsPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
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
    return infra_to_response(updated)


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/sketch/generate",
    response_model=WellLayoutGenerateResponseOut,
)
async def post_pad_earthwork_sketch_generate(
    project_id: UUID,
    object_id: UUID,
    body: WellLayoutGenerateRequestIn | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    return generate_pad_sketch_from_wells(obj, body)


@pad_earthwork_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/sketch",
    response_model=InfraObjectResponse,
)
async def patch_pad_earthwork_sketch(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkSketchSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
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
    return infra_to_response(updated)


@pad_earthwork_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/profile",
    response_model=InfraObjectResponse,
)
async def patch_pad_earthwork_profile(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkProfileSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    assert_pad_object(obj)
    props = save_pad_profile_for_object(obj, body)
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
    return infra_to_response(updated)
