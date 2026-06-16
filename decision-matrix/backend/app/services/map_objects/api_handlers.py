"""HTTP orchestration for infrastructure objects BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import cast, or_, select, String
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import (
    get_infra_object,
    get_user_project,
    require_infra_write,
    require_project_write,
)
from app.geo.bbox_filter import infra_bbox_filter
from app.geo.validation import validate_general_infra_create
from app.models import InfrastructureLayer, InfrastructureObject, User
from app.schemas import (
    AutoroadConnectRequest,
    AutoroadConnectResponse,
    FacilityInfraObjectCreate,
    InfraObjectCreate,
    InfraObjectUpdate,
    MapBatchDeleteRequest,
    MapBatchDeleteResponse,
    MapBatchPasteRequest,
    MapBatchPasteResponse,
    ProjectJobCreateResponse,
)
from app.services.infra_create import create_infra_object_record
from app.services.infra_delete import (
    clear_project_infrastructure,
    delete_infra_objects_batch,
    delete_pois_batch,
)
from app.services.infra_update import update_infra_object_record
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.line_endpoint_rules import LineEndpointRuleError
from app.services.map_batch_paste import apply_map_batch_paste
from app.services.project_jobs import JOB_TYPE_AUTOROAD_CONNECT, ActiveProjectJobError
from app.services.serializers import infra_to_public_json


async def handle_list_infra_objects(
    project_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    subtype: str | None = None,
    q: str | None = None,
    bbox: str | None = None,
    visible_layers_only: bool = True,
) -> list[dict]:
    await get_user_project(project_id, user, db)
    qry = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
    )
    if visible_layers_only:
        qry = qry.where(InfrastructureLayer.is_visible.is_(True))
    if subtype:
        qry = qry.where(InfrastructureObject.subtype == subtype)
    if q:
        qry = qry.where(
            or_(
                InfrastructureObject.name.ilike(f"%{q}%"),
                cast(InfrastructureObject.properties, String).ilike(f"%{q}%"),
            )
        )
    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x) for x in bbox.split(",")]
            qry = qry.where(infra_bbox_filter(min_lon, min_lat, max_lon, max_lat))
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid bbox format") from e
    result = await db.execute(qry)
    return [infra_to_public_json(obj) for obj in result.scalars().all()]


async def handle_clear_project_infrastructure(
    project_id: UUID,
    user: User,
    db: AsyncSession,
):
    await require_infra_write(project_id, user, db)
    result = await clear_project_infrastructure(db, project_id)
    await db.commit()
    return result


async def handle_create_infra_object(
    project_id: UUID,
    data: InfraObjectCreate,
    user: User,
    db: AsyncSession,
) -> dict:
    await require_infra_write(project_id, user, db)
    subtype = data.subtype.lower().strip()
    try:
        validate_general_infra_create(subtype)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        obj = await create_infra_object_record(db, project_id=project_id, data=data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LineEndpointRuleError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    await db.refresh(obj)
    return infra_to_public_json(obj)


async def handle_create_facility_infra_object(
    project_id: UUID,
    data: FacilityInfraObjectCreate,
    user: User,
    db: AsyncSession,
) -> dict:
    await require_infra_write(project_id, user, db)
    payload = InfraObjectCreate(
        name=data.name,
        subtype=data.subtype,
        lon=data.lon,
        lat=data.lat,
        layer_id=data.layer_id,
        properties=data.properties,
        description=data.description,
    )
    try:
        obj = await create_infra_object_record(db, project_id=project_id, data=payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    await db.refresh(obj)
    return infra_to_public_json(obj)


async def handle_autoroad_connect(
    project_id: UUID,
    data: AutoroadConnectRequest,
    user: User,
    db: AsyncSession,
) -> AutoroadConnectResponse | JSONResponse:
    from app.services.autoroad_connect import run_autoroad_connect

    await require_infra_write(project_id, user, db)
    try:
        if data.dry_run:
            result = await run_autoroad_connect(
                db,
                project_id,
                data.object_ids,
                dry_run=True,
            )
            return AutoroadConnectResponse(**result)

        if jobs_async_enabled():
            try:
                job = await create_and_schedule_job(
                    db,
                    project_id=project_id,
                    user_id=user.id,
                    job_type=JOB_TYPE_AUTOROAD_CONNECT,
                    payload={"object_ids": [str(i) for i in data.object_ids]},
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
            body = ProjectJobCreateResponse(
                job_id=job.id,
                job_type=job.job_type,
                status=job.status,
            )
            return JSONResponse(status_code=202, content=body.model_dump(mode="json"))

        result = await run_autoroad_connect(
            db,
            project_id,
            data.object_ids,
            dry_run=False,
        )
        await db.commit()
        return AutoroadConnectResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_update_infra_object(
    project_id: UUID,
    object_id: UUID,
    data: InfraObjectUpdate,
    user: User,
    db: AsyncSession,
) -> dict:
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    try:
        obj = await update_infra_object_record(
            db,
            project=project,
            project_id=project_id,
            user=user,
            obj=obj,
            data=data,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.commit()
    await db.refresh(obj)
    return infra_to_public_json(obj)


async def handle_batch_delete(
    project_id: UUID,
    data: MapBatchDeleteRequest,
    user: User,
    db: AsyncSession,
) -> MapBatchDeleteResponse:
    if data.object_ids:
        await require_infra_write(project_id, user, db)
    if data.poi_ids:
        await require_project_write(project_id, user, db)
    if not data.object_ids and not data.poi_ids:
        return MapBatchDeleteResponse(deleted_objects=0, deleted_pois=0, network_rebuilt=False)

    object_ids = set(data.object_ids)
    poi_ids = set(data.poi_ids)

    if object_ids:
        for oid in object_ids:
            await get_infra_object(oid, project_id, db)

    deleted_objects, network_rebuilt = await delete_infra_objects_batch(db, project_id, object_ids)
    deleted_pois = await delete_pois_batch(db, project_id, poi_ids)
    await db.commit()
    return MapBatchDeleteResponse(
        deleted_objects=deleted_objects,
        deleted_pois=deleted_pois,
        network_rebuilt=network_rebuilt,
    )


async def handle_batch_paste(
    project_id: UUID,
    data: MapBatchPasteRequest,
    user: User,
    db: AsyncSession,
) -> MapBatchPasteResponse:
    if not data.pois and not data.infra_points and not data.infra_lines:
        return MapBatchPasteResponse()

    project = await get_user_project(project_id, user, db)
    if data.pois:
        await require_project_write(project_id, user, db)
    if data.infra_points or data.infra_lines:
        project = await require_infra_write(project_id, user, db)

    try:
        result = await apply_map_batch_paste(
            db,
            project=project,
            project_id=project_id,
            user=user,
            data=data,
        )
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LineEndpointRuleError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    except HTTPException:
        await db.rollback()
        raise

    try:
        await db.commit()
    except SQLAlchemyError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Database error during batch paste") from e

    return result


async def handle_delete_infra_object(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> None:
    await require_infra_write(project_id, user, db)
    await get_infra_object(object_id, project_id, db)
    await delete_infra_objects_batch(db, project_id, {object_id})
    await db.commit()
