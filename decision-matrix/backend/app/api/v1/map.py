"""Map module API: layers, infrastructure objects, import (FR-2.x)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import cast, delete, or_, select, String, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage, point_wkt
from app.geo.validation import category_for_subtype, validate_subtype_geometry
from app.models import (
    ImportLog,
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNode,
    InfrastructureObject,
    PointOfInterest,
    PoiInfrastructureAnalysis,
    Project,
    User,
)
from app.schemas import (
    AnalysisOverrideUpdate,
    CandidateResponse,
    ImportLogResponse,
    ImportPreviewResponse,
    InfraObjectCreate,
    InfraObjectResponse,
    InfraObjectUpdate,
    LayerCreate,
    LayerResponse,
    LayerUpdate,
    POIUpdate,
)
from app.services.analysis_override import parse_point_wkt, patch_analysis_subtype
from app.services.infrastructure_analysis import build_enriched_analysis_from_db
from app.services.graph_builder import build_network_from_lines
from app.services.import_service import (
    create_pending_import_log,
    parse_import_content,
    run_file_import,
    run_shapefile_import,
    schedule_async_import,
)
from app.services.serializers import _infra_line_coordinates, infra_to_response, load_infra_name, poi_to_response
from app.services.spatial import list_candidates_by_subtype

map_router = APIRouter()


@map_router.get("/projects/{project_id}/infrastructure/layers", response_model=list[LayerResponse])
async def list_layers(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    result = await db.execute(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
        .order_by(InfrastructureLayer.sort_order, InfrastructureLayer.name)
    )
    layers = result.scalars().all()
    return [
        LayerResponse(
            id=layer.id,
            project_id=layer.project_id,
            name=layer.name,
            layer_type=layer.layer_type,
            source_type=layer.source_type,
            is_visible=layer.is_visible,
            opacity=layer.opacity,
            sort_order=layer.sort_order,
            style_config=layer.style_config or {},
        )
        for layer in layers
    ]


@map_router.post("/projects/{project_id}/infrastructure/layers", response_model=LayerResponse, status_code=201)
async def create_layer(
    project_id: UUID,
    data: LayerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    layer = InfrastructureLayer(
        project_id=project_id,
        name=data.name,
        layer_type=data.layer_type,
        source_type=data.source_type,
        is_visible=data.is_visible,
        opacity=data.opacity,
        sort_order=data.sort_order,
        style_config=data.style_config,
    )
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return LayerResponse(
        id=layer.id,
        project_id=layer.project_id,
        name=layer.name,
        layer_type=layer.layer_type,
        source_type=layer.source_type,
        is_visible=layer.is_visible,
        opacity=layer.opacity,
        sort_order=layer.sort_order,
        style_config=layer.style_config or {},
    )


@map_router.patch("/projects/{project_id}/infrastructure/layers/{layer_id}", response_model=LayerResponse)
async def update_layer(
    project_id: UUID,
    layer_id: UUID,
    data: LayerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    layer = await _get_layer(layer_id, project_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(layer, field, value)
    await db.commit()
    await db.refresh(layer)
    return LayerResponse(
        id=layer.id,
        project_id=layer.project_id,
        name=layer.name,
        layer_type=layer.layer_type,
        source_type=layer.source_type,
        is_visible=layer.is_visible,
        opacity=layer.opacity,
        sort_order=layer.sort_order,
        style_config=layer.style_config or {},
    )


@map_router.delete("/projects/{project_id}/infrastructure/layers/{layer_id}", status_code=204)
async def delete_layer(
    project_id: UUID,
    layer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    layer = await _get_layer(layer_id, project_id, db)
    await db.delete(layer)
    await db.commit()


@map_router.get("/projects/{project_id}/infrastructure/objects", response_model=list[InfraObjectResponse])
async def list_infra_objects(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    subtype: str | None = None,
    q: str | None = None,
    bbox: str | None = Query(None, description="minLon,minLat,maxLon,maxLat"),
    visible_layers_only: bool = True,
):
    await _get_user_project(project_id, user, db)
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
            qry = qry.where(
                InfrastructureObject.longitude >= min_lon,
                InfrastructureObject.longitude <= max_lon,
                InfrastructureObject.latitude >= min_lat,
                InfrastructureObject.latitude <= max_lat,
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bbox format")
    result = await db.execute(qry)
    return [infra_to_response(obj) for obj in result.scalars().all()]


@map_router.post("/projects/{project_id}/infrastructure/objects", response_model=InfraObjectResponse, status_code=201)
async def create_infra_object(
    project_id: UUID,
    data: InfraObjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    subtype = data.subtype.lower().strip()
    has_line = data.end_lon is not None or (data.coordinates and len(data.coordinates) >= 2)
    validate_subtype_geometry(subtype, has_line_endpoints=has_line, coordinate_count=len(data.coordinates or [1]))
    try:
        geom = build_infra_geometry(
            subtype,
            data.lon,
            data.lat,
            end_lon=data.end_lon,
            end_lat=data.end_lat,
            coordinates=data.coordinates,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if data.layer_id:
        layer = await _get_layer(data.layer_id, project_id, db)
    else:
        layer = await _get_or_create_default_layer(project_id, db, source_type="manual")

    props = dict(data.properties)
    if data.description:
        props["description"] = data.description

    end_lon, end_lat = data.end_lon, data.end_lat
    if data.coordinates and len(data.coordinates) >= 2:
        end_lon = data.coordinates[-1][0]
        end_lat = data.coordinates[-1][1]
    line_coords = line_coordinates_for_storage(
        lon=data.lon,
        lat=data.lat,
        end_lon=end_lon,
        end_lat=end_lat,
        coordinates=data.coordinates,
    )
    if line_coords:
        props["coordinates"] = line_coords

    obj = InfrastructureObject(
        layer_id=layer.id,
        name=data.name,
        subtype=subtype,
        category=category_for_subtype(subtype),
        geometry=geom,
        longitude=data.lon,
        latitude=data.lat,
        end_longitude=end_lon,
        end_latitude=end_lat,
        properties=props,
    )
    db.add(obj)
    await db.flush()
    if obj.end_longitude is not None:
        await build_network_from_lines(db, project_id)
    await db.commit()
    await db.refresh(obj)
    return infra_to_response(obj)


@map_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}", response_model=InfraObjectResponse
)
async def update_infra_object(
    project_id: UUID,
    object_id: UUID,
    data: InfraObjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    obj = await _get_infra_object(object_id, project_id, db)
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
    subtype = payload.get("subtype", obj.subtype).lower()

    if any(k in payload for k in ("lon", "lat", "end_lon", "end_lat", "coordinates", "subtype")):
        has_line = end_lon is not None or (coords and len(coords) >= 2)
        validate_subtype_geometry(subtype, has_line_endpoints=has_line)
        try:
            obj.geometry = build_infra_geometry(
                subtype, lon, lat, end_lon=end_lon, end_lat=end_lat, coordinates=coords
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        if coords and len(coords) >= 2:
            lon, lat = coords[0][0], coords[0][1]
            end_lon, end_lat = coords[-1][0], coords[-1][1]
        obj.longitude, obj.latitude = lon, lat
        obj.end_longitude, obj.end_latitude = end_lon, end_lat
        obj.subtype = subtype
        obj.category = category_for_subtype(subtype)
        line_coords = line_coordinates_for_storage(
            lon=lon, lat=lat, end_lon=end_lon, end_lat=end_lat, coordinates=coords
        )
        if line_coords:
            props = dict(obj.properties or {})
            props["coordinates"] = line_coords
            obj.properties = props

    if "name" in payload:
        obj.name = payload["name"]
    if "layer_id" in payload:
        await _get_layer(payload["layer_id"], project_id, db)
        obj.layer_id = payload["layer_id"]
    if "properties" in payload:
        merged_props = dict(obj.properties or {})
        merged_props.update(payload["properties"])
        obj.properties = merged_props
    if "description" in payload:
        props = dict(obj.properties or {})
        props["description"] = payload["description"]
        obj.properties = props

    await db.commit()
    await db.refresh(obj)
    return infra_to_response(obj)


@map_router.delete("/projects/{project_id}/infrastructure/objects/{object_id}", status_code=204)
async def delete_infra_object(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    obj = await _get_infra_object(object_id, project_id, db)
    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.nearest_object_id == object_id)
        .values(nearest_object_id=None)
    )
    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.overridden_object_id == object_id)
        .values(overridden_object_id=None)
    )
    await db.execute(
        delete(InfrastructureEdge).where(InfrastructureEdge.infrastructure_object_id == object_id)
    )
    await db.execute(
        delete(InfrastructureNode).where(InfrastructureNode.infrastructure_object_id == object_id)
    )
    await db.delete(obj)
    await db.commit()


@map_router.patch("/projects/{project_id}/pois/{poi_id}", response_model=dict)
async def update_poi(
    project_id: UUID,
    poi_id: UUID,
    data: POIUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    poi = await _get_poi(poi_id, project_id, db)
    payload = data.model_dump(exclude_unset=True)
    if "lon" in payload or "lat" in payload:
        lon = payload.get("lon", poi.longitude)
        lat = payload.get("lat", poi.latitude)
        poi.longitude = lon
        poi.latitude = lat
        poi.geometry = point_wkt(lon, lat)
        payload.pop("lon", None)
        payload.pop("lat", None)
    for field, value in payload.items():
        setattr(poi, field, value)
    await db.commit()
    await db.refresh(poi)
    return poi_to_response(poi).model_dump()


@map_router.delete("/projects/{project_id}/pois/{poi_id}", status_code=204)
async def delete_poi(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    poi = await _get_poi(poi_id, project_id, db)
    await db.delete(poi)
    await db.commit()


@map_router.get("/projects/{project_id}/pois/{poi_id}/analysis")
async def get_poi_analysis(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    poi = await _get_poi(poi_id, project_id, db)
    row_count = await db.scalar(
        select(PoiInfrastructureAnalysis.id)
        .where(PoiInfrastructureAnalysis.poi_id == poi.id)
        .limit(1)
    )
    if not row_count:
        raise HTTPException(status_code=404, detail="No analysis found. Run POST .../analyze first.")
    return await build_enriched_analysis_from_db(db, project_id, poi)


@map_router.get("/projects/{project_id}/pois/{poi_id}/candidates", response_model=list[CandidateResponse])
async def get_candidates(
    project_id: UUID,
    poi_id: UUID,
    subtype: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    nearest_policy: str = Query("point_on_line", description="point_on_line | network_node"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    poi = await _get_poi(poi_id, project_id, db)
    candidates = await list_candidates_by_subtype(
        db, project_id, poi, subtype.lower(), limit, nearest_policy=nearest_policy
    )
    return [
        CandidateResponse(
            object_id=c.object_id,
            nearest_node_id=c.nearest_node_id,
            name=c.name,
            distance_km=round(c.distance_km, 2),
            anchor_lon=c.anchor_lon,
            anchor_lat=c.anchor_lat,
            anchor_type=c.anchor_type,
        )
        for c in candidates
    ]


@map_router.patch("/projects/{project_id}/pois/{poi_id}/analysis/{subtype}")
async def patch_analysis_override(
    project_id: UUID,
    poi_id: UUID,
    subtype: str,
    data: AnalysisOverrideUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    poi = await _get_poi(poi_id, project_id, db)
    if data.force_construction is None and not data.nearest_object_id and not data.nearest_node_id:
        raise HTTPException(
            status_code=400,
            detail="Provide nearest_object_id, nearest_node_id, or force_construction",
        )
    try:
        await patch_analysis_subtype(
            db,
            project_id,
            poi,
            subtype,
            nearest_object_id=data.nearest_object_id,
            nearest_node_id=data.nearest_node_id,
            force_construction=data.force_construction,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return await build_enriched_analysis_from_db(db, project_id, poi)


@map_router.get("/import/logs/{log_id}", response_model=ImportLogResponse)
async def get_import_log(
    log_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log = await db.get(ImportLog, log_id)
    if not log or log.user_id != user.id:
        raise HTTPException(status_code=404, detail="Import log not found")
    return log


@map_router.post("/projects/{project_id}/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    format: str = Query("csv", pattern="^(csv|geojson|kml)$"),
):
    await _get_user_project(project_id, user, db)
    raw = await file.read()
    name = (file.filename or "").lower()
    if format == "kml" or name.endswith((".kml", ".kmz")):
        if name.endswith(".kmz"):
            import io
            import zipfile

            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
                content = zf.read(kml_names[0]).decode("utf-8", errors="replace") if kml_names else ""
            fmt = "kml"
        else:
            content = raw.decode("utf-8", errors="replace")
            fmt = "kml"
    elif format == "geojson" or name.endswith((".geojson", ".json")):
        content = raw.decode("utf-8", errors="replace")
        fmt = "geojson"
    else:
        content = raw.decode("utf-8-sig")
        fmt = "csv"
    rows, errors = parse_import_content(content, fmt)
    preview = [
        {
            "name": r["name"],
            "subtype": r["subtype"],
            "lon": r["lon"],
            "lat": r["lat"],
            "end_lon": r.get("end_lon"),
            "end_lat": r.get("end_lat"),
        }
        for r in rows[:50]
    ]
    return ImportPreviewResponse(rows=preview, errors=errors, records_total=len(rows))


@map_router.post("/projects/{project_id}/import/csv", response_model=ImportLogResponse)
async def import_csv(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await _get_user_project(project_id, user, db)
    content = (await file.read()).decode("utf-8-sig")
    layer = await _get_or_create_default_layer(project_id, db, source_type="csv_import", name="Импорт CSV")
    log = await run_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        source_type="csv_import",
        file_name=file.filename or "import.csv",
        content=content,
        format="csv",
    )
    await db.commit()
    await db.refresh(log)
    return log


@map_router.post("/projects/{project_id}/import/csv/async", response_model=ImportLogResponse, status_code=202)
async def import_csv_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await _get_user_project(project_id, user, db)
    content = (await file.read()).decode("utf-8-sig")
    layer = await _get_or_create_default_layer(project_id, db, source_type="csv_import", name="Импорт CSV")
    log = await create_pending_import_log(
        db,
        user_id=user.id,
        project_id=project_id,
        source_type="csv_import",
        file_name=file.filename or "import.csv",
    )
    await db.commit()
    await db.refresh(log)
    schedule_async_import(log.id, layer_id=layer.id, content=content, format="csv")
    return log


@map_router.post("/projects/{project_id}/import/kml", response_model=ImportLogResponse)
async def import_kml(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await _get_user_project(project_id, user, db)
    raw = await file.read()
    name = (file.filename or "import.kml").lower()
    if name.endswith(".kmz"):
        import zipfile
        import io

        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            if not kml_names:
                raise HTTPException(status_code=400, detail="KMZ contains no KML")
            content = zf.read(kml_names[0]).decode("utf-8", errors="replace")
    else:
        content = raw.decode("utf-8", errors="replace")
    layer = await _get_or_create_default_layer(project_id, db, source_type="kml_import", name="Импорт KML")
    log = await run_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        source_type="kml_import",
        file_name=file.filename or "import.kml",
        content=content,
        format="kml",
    )
    await db.commit()
    await db.refresh(log)
    return log


@map_router.post("/projects/{project_id}/import/shapefile", response_model=ImportLogResponse)
async def import_shapefile(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await _get_user_project(project_id, user, db)
    data = await file.read()
    layer = await _get_or_create_default_layer(project_id, db, source_type="shapefile_import", name="Импорт SHP")
    log = await run_shapefile_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        file_name=file.filename or "import.zip",
        zip_bytes=data,
    )
    await db.commit()
    await db.refresh(log)
    return log


@map_router.post("/projects/{project_id}/import/geojson", response_model=ImportLogResponse)
async def import_geojson(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await _get_user_project(project_id, user, db)
    content = (await file.read()).decode("utf-8")
    layer = await _get_or_create_default_layer(project_id, db, source_type="geojson_import", name="Импорт GeoJSON")
    log = await run_file_import(
        db,
        user_id=user.id,
        project_id=project_id,
        layer=layer,
        source_type="geojson_import",
        file_name=file.filename or "import.geojson",
        content=content,
        format="geojson",
    )
    await db.commit()
    await db.refresh(log)
    return log


@map_router.post("/projects/{project_id}/import/geojson/async", response_model=ImportLogResponse, status_code=202)
async def import_geojson_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await _get_user_project(project_id, user, db)
    content = (await file.read()).decode("utf-8")
    layer = await _get_or_create_default_layer(project_id, db, source_type="geojson_import", name="Импорт GeoJSON")
    log = await create_pending_import_log(
        db,
        user_id=user.id,
        project_id=project_id,
        source_type="geojson_import",
        file_name=file.filename or "import.geojson",
    )
    await db.commit()
    await db.refresh(log)
    schedule_async_import(log.id, layer_id=layer.id, content=content, format="geojson")
    return log


@map_router.post("/projects/{project_id}/import/kml/async", response_model=ImportLogResponse, status_code=202)
async def import_kml_async(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    await _get_user_project(project_id, user, db)
    raw = await file.read()
    name = (file.filename or "import.kml").lower()
    if name.endswith(".kmz"):
        import io
        import zipfile

        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            content = zf.read(kml_names[0]).decode("utf-8", errors="replace") if kml_names else ""
    else:
        content = raw.decode("utf-8", errors="replace")
    layer = await _get_or_create_default_layer(project_id, db, source_type="kml_import", name="Импорт KML")
    log = await create_pending_import_log(
        db,
        user_id=user.id,
        project_id=project_id,
        source_type="kml_import",
        file_name=file.filename or "import.kml",
    )
    await db.commit()
    await db.refresh(log)
    schedule_async_import(log.id, layer_id=layer.id, content=content, format="kml")
    return log


@map_router.get("/import/logs", response_model=list[ImportLogResponse])
async def import_logs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
):
    q = select(ImportLog).where(ImportLog.user_id == user.id)
    if project_id:
        q = q.where(ImportLog.project_id == project_id)
    result = await db.execute(q.order_by(ImportLog.created_at.desc()).limit(20))
    return result.scalars().all()


async def _get_user_project(project_id: UUID, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_poi(poi_id: UUID, project_id: UUID, db: AsyncSession) -> PointOfInterest:
    result = await db.execute(
        select(PointOfInterest).where(PointOfInterest.id == poi_id, PointOfInterest.project_id == project_id)
    )
    poi = result.scalar_one_or_none()
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    return poi


async def _get_layer(layer_id: UUID, project_id: UUID, db: AsyncSession) -> InfrastructureLayer:
    result = await db.execute(
        select(InfrastructureLayer).where(
            InfrastructureLayer.id == layer_id, InfrastructureLayer.project_id == project_id
        )
    )
    layer = result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer


async def _get_infra_object(object_id: UUID, project_id: UUID, db: AsyncSession) -> InfrastructureObject:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(InfrastructureObject.id == object_id, InfrastructureLayer.project_id == project_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Infrastructure object not found")
    return obj


async def _get_or_create_default_layer(
    project_id: UUID,
    db: AsyncSession,
    source_type: str = "manual",
    name: str = "Инфраструктура",
) -> InfrastructureLayer:
    result = await db.execute(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id, InfrastructureLayer.source_type == source_type)
        .limit(1)
    )
    layer = result.scalar_one_or_none()
    if layer:
        return layer
    layer = InfrastructureLayer(
        project_id=project_id, name=name, layer_type="vector", source_type=source_type
    )
    db.add(layer)
    await db.flush()
    return layer
