"""Infrastructure objects, batch delete, autoroad-connect."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import cast, delete, or_, select, String, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map_deps import (
    get_infra_object,
    get_layer,
    get_or_create_default_layer,
    get_poi,
    get_user_project,
    require_infra_write,
    require_project_write,
)
from app.core.database import get_db
from app.models import User

from app.geo.bbox_filter import infra_bbox_filter
from app.geo.constants import LINE_SUBTYPES, normalize_infra_subtype
from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage
from app.geo.validation import category_for_subtype, validate_general_infra_create, validate_subtype_change, validate_subtype_geometry
from app.models import (
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
    PointOfInterest,
    PoiInfrastructureAnalysis,
)
from app.schemas import (
    AutoroadConnectRequest,
    AutoroadConnectResponse,
    FacilityInfraObjectCreate,
    InfraObjectCreate,
    InfraObjectResponse,
    InfraObjectUpdate,
    MapBatchDeleteRequest,
    MapBatchDeleteResponse,
    ProjectJobCreateResponse,
)
from app.services.infra_create import create_infra_object_record
from app.services.infra_delete import delete_infra_objects_batch, delete_pois_batch
from app.services.line_endpoint_rules import LineEndpointRuleError, snap_line_endpoints_to_point_objects
from app.services.serializers import _infra_line_coordinates, infra_to_response

objects_router = APIRouter(tags=["map-objects"])

@objects_router.get("/projects/{project_id}/infrastructure/objects", response_model=list[InfraObjectResponse])
async def list_infra_objects(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    subtype: str | None = None,
    q: str | None = None,
    bbox: str | None = Query(None, description="minLon,minLat,maxLon,maxLat"),
    visible_layers_only: bool = True,
):
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
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bbox format")
    result = await db.execute(qry)
    return [infra_to_response(obj) for obj in result.scalars().all()]


@objects_router.post("/projects/{project_id}/infrastructure/clear")
async def clear_project_infrastructure(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove all infrastructure objects and graph data for the project (POIs are kept)."""
    await require_infra_write(project_id, user, db)
    layer_ids_sq = select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id)
    poi_ids_sq = select(PointOfInterest.id).where(PointOfInterest.project_id == project_id)
    network_ids_sq = select(InfrastructureNetwork.id).where(InfrastructureNetwork.project_id == project_id)

    n_objects = len(
        (
            await db.execute(
                select(InfrastructureObject.id).where(InfrastructureObject.layer_id.in_(layer_ids_sq))
            )
        ).all()
    )

    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.poi_id.in_(poi_ids_sq))
        .values(
            nearest_object_id=None,
            overridden_object_id=None,
            nearest_node_id=None,
        )
    )
    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(
            PoiInfrastructureAnalysis.poi_id.in_(poi_ids_sq),
            PoiInfrastructureAnalysis.param_type.in_(("external", "external_linear")),
            PoiInfrastructureAnalysis.distance_status != "not_required",
        )
        .values(
            distance_km=None,
            anchor_type=None,
            anchor_geometry=None,
            distance_status="construction_required",
            is_manually_overridden=False,
        )
    )

    edge_result = await db.execute(
        delete(InfrastructureEdge).where(InfrastructureEdge.network_id.in_(network_ids_sq))
    )
    node_result = await db.execute(
        delete(InfrastructureNode).where(InfrastructureNode.network_id.in_(network_ids_sq))
    )
    await db.execute(delete(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids_sq)))

    await db.commit()
    return {
        "deleted_objects": n_objects,
        "deleted_edges": edge_result.rowcount or 0,
        "deleted_nodes": node_result.rowcount or 0,
    }

@objects_router.post("/projects/{project_id}/infrastructure/objects", response_model=InfraObjectResponse, status_code=201)
async def create_infra_object(
    project_id: UUID,
    data: InfraObjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    return infra_to_response(obj)


@objects_router.post(
    "/projects/{project_id}/infrastructure/facility-objects",
    response_model=InfraObjectResponse,
    status_code=201,
)
async def create_facility_infra_object(
    project_id: UUID,
    data: FacilityInfraObjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать НПЗ или НПС — в теле обязательно поле subtype."""
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
    return infra_to_response(obj)


@objects_router.post("/projects/{project_id}/infrastructure/autoroad-connect")
async def autoroad_connect_objects(
    project_id: UUID,
    data: AutoroadConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Соединить выбранные точечные объекты по сети автодорог (deprecated — use autoroad-network)."""
    await require_infra_write(project_id, user, db)
    from app.services.autoroad_connect import run_autoroad_connect
    from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
    from app.services.project_jobs import JOB_TYPE_AUTOROAD_CONNECT, ActiveProjectJobError

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


@objects_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}", response_model=InfraObjectResponse
)
async def update_infra_object(
    project_id: UUID,
    object_id: UUID,
    data: InfraObjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await require_infra_write(project_id, user, db)
    obj = await get_infra_object(object_id, project_id, db)
    payload = data.model_dump(exclude_unset=True)
    lon = payload.get("lon", obj.longitude)
    lat = payload.get("lat", obj.latitude)
    end_lon = payload.get("end_lon", obj.end_longitude)
    end_lat = payload.get("end_lat", obj.end_latitude)
    coords = payload.get("coordinates")
    if coords is None and any(
        k in payload for k in ("lon", "lat", "end_lon", "end_lat", "coordinates", "subtype")
    ):
        coords = _infra_line_coordinates(obj)
    from app.geo.constants import normalize_infra_subtype

    subtype = normalize_infra_subtype(payload.get("subtype", obj.subtype))

    if any(k in payload for k in ("lon", "lat", "end_lon", "end_lat", "coordinates", "subtype")):
        if "subtype" in payload:
            try:
                validate_subtype_change(normalize_infra_subtype(obj.subtype), subtype)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        has_line = end_lon is not None or (coords and len(coords) >= 2)
        validate_subtype_geometry(subtype, has_line_endpoints=has_line)
        if coords and len(coords) >= 2:
            lon, lat = coords[0][0], coords[0][1]
            end_lon, end_lat = coords[-1][0], coords[-1][1]
        line_coords = line_coordinates_for_storage(
            lon=lon, lat=lat, end_lon=end_lon, end_lat=end_lat, coordinates=coords
        )
        if subtype in LINE_SUBTYPES:
            try:
                lon, lat, end_lon, end_lat, line_coords = await snap_line_endpoints_to_point_objects(
                    db,
                    project_id=project_id,
                    line_subtype=subtype,
                    lon=lon,
                    lat=lat,
                    end_lon=end_lon,
                    end_lat=end_lat,
                    coordinates=line_coords,
                    exclude_object_id=obj.id,
                )
            except LineEndpointRuleError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        try:
            obj.geometry = build_infra_geometry(
                subtype, lon, lat, end_lon=end_lon, end_lat=end_lat, coordinates=line_coords
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        obj.longitude, obj.latitude = lon, lat
        obj.end_longitude, obj.end_latitude = end_lon, end_lat
        obj.subtype = subtype
        obj.category = category_for_subtype(subtype)
        if line_coords:
            props = dict(obj.properties or {})
            props["coordinates"] = line_coords
            obj.properties = props

    if "name" in payload:
        obj.name = payload["name"]
    if "layer_id" in payload:
        await get_layer(payload["layer_id"], project_id, db)
        obj.layer_id = payload["layer_id"]
    if "properties" in payload:
        from app.geo.render_3d_properties import apply_default_render_3d, merge_infra_properties_patch
        from app.services.map3d_custom_models import assert_can_set_custom_model_id_async

        await assert_can_set_custom_model_id_async(
            db, user, project, project_id, subtype, payload["properties"]
        )
        merged_props = merge_infra_properties_patch(obj.properties, payload["properties"])
        await assert_can_set_custom_model_id_async(
            db, user, project, project_id, subtype, merged_props
        )
        obj.properties = apply_default_render_3d(subtype, merged_props)
    if "description" in payload:
        props = dict(obj.properties or {})
        props["description"] = payload["description"]
        obj.properties = props

    await db.commit()
    await db.refresh(obj)
    return infra_to_response(obj)


@objects_router.post(
    "/projects/{project_id}/map/batch-delete",
    response_model=MapBatchDeleteResponse,
)
async def batch_delete_map_objects(
    project_id: UUID,
    data: MapBatchDeleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete many infra objects and/or POIs in one transaction (avoids parallel DELETE races)."""
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


@objects_router.delete("/projects/{project_id}/infrastructure/objects/{object_id}", status_code=204)
async def delete_infra_object(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_infra_write(project_id, user, db)
    await get_infra_object(object_id, project_id, db)
    await delete_infra_objects_batch(db, project_id, {object_id})
    await db.commit()
