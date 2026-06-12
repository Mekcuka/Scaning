"""Orchestration for pad earthwork BFF."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.dem_store import (
    compute_dem_bbox,
    ensure_dem_for_object,
)
from app.services.pad_earthwork.earthwork_adapter import get_pad_earthwork_adapter
from app.services.pad_earthwork.earthwork_store import (
    merge_pad_params_patch,
    planner_response_to_bff,
    read_nds_deg,
    read_pad_params,
    read_sketch,
    store_compute_result,
    store_envelope,
    store_sketch,
    store_wells_local,
)
from app.services.pad_earthwork.planner_bridge import (
    dem_not_supported_error,
    planner_schemas,
    preview_sketch_request,
)
from app.services.pad_earthwork.properties import (
    PAD_DEM_FETCHED_AT,
    PAD_DEM_SOURCE,
    PAD_EARTHWORK_SKETCH_SAVED_AT,
    PAD_HEIGHT_M,
    PAD_LENGTH_M,
    PAD_REFERENCE_ELEVATION_M,
    PAD_ROTATION_DEG,
    PAD_WIDTH_M,
)
from app.services.pad_earthwork.pad_layout_store import resolve_well_layout_request
from app.services.pad_earthwork.schemas import (
    EnvelopeWrapIn,
    PadDemFetchResponseOut,
    PadEarthworkComputeRequest,
    PadEarthworkComputeResponse,
    PadEarthworkParamsPatch,
    PadEarthworkSketchSaveRequest,
    PadHeightReferenceIn,
    PadParamsIn,
    PlanPolygonSketchIn,
    PlanRectangleSketchIn,
    SketchPreviewRequestIn,
    SketchPreviewResponseOut,
    TerrainDemIn,
    WellLayoutGenerateRequestIn,
    WellLayoutGenerateResponseOut,
)
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES


def assert_pad_object(obj: InfrastructureObject) -> None:
    if obj.subtype not in PAD_CLUSTER_SUBTYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Pad earthwork is only available for subtypes: {sorted(PAD_CLUSTER_SUBTYPES)}",
        )


def _sketch_to_planner(sketch: PlanRectangleSketchIn | PlanPolygonSketchIn) -> Any:
    schemas = planner_schemas()
    if isinstance(sketch, PlanRectangleSketchIn):
        return schemas.PlanRectangleSketch.model_validate(sketch.model_dump())
    return schemas.PlanPolygonSketch.model_validate(sketch.model_dump())


def _params_to_planner(params: PadParamsIn) -> Any:
    schemas = planner_schemas()
    return schemas.PadParams(
        length_m=params.length_m,
        width_m=params.width_m,
        height_m=params.height_m,
        rotation_deg=params.rotation_deg,
        reference_elevation_m=params.reference_elevation_m,
    )


def _height_ref_to_planner(params: PadHeightReferenceIn) -> Any:
    schemas = planner_schemas()
    return schemas.PadHeightReference(
        height_m=params.height_m,
        reference_elevation_m=params.reference_elevation_m,
    )


def _terrain_from_request(
    body: PadEarthworkComputeRequest | None,
    *,
    dem_asset_id: str | None = None,
    dem_file_path: str | None = None,
) -> Any:
    schemas = planner_schemas()
    if body is None or body.terrain is None:
        return schemas.TerrainFlat()
    if isinstance(body.terrain, TerrainDemIn):
        return schemas.TerrainDem(
            mode="dem",
            dem_asset_id=dem_asset_id or body.terrain.dem_asset_id,
            dem_file_path=dem_file_path,
        )
    return schemas.TerrainFlat()


def _is_dem_mode(body: PadEarthworkComputeRequest | None) -> bool:
    return bool(body and body.terrain and isinstance(body.terrain, TerrainDemIn))


def _footprint_corners_lonlat_for_compute(
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
    params_in: PadParamsIn,
) -> list[tuple[float, float]]:
    from pad_earthwork.footprint import footprint_corners_lonlat, footprint_polygon_lonlat
    from pad_earthwork.volume_plan import polygon_vertices_local_m

    lon = float(obj.longitude)
    lat = float(obj.latitude)
    sketch = body.sketch if body and body.sketch is not None else read_sketch(obj.properties)
    if isinstance(sketch, PlanPolygonSketchIn):
        verts = [(v.east_m, v.north_m) for v in sketch.vertices]
        return footprint_polygon_lonlat(lon, lat, verts)
    if isinstance(sketch, PlanRectangleSketchIn):
        return footprint_corners_lonlat(
            lon,
            lat,
            sketch.length_m,
            sketch.width_m,
            sketch.rotation_deg,
        )
    return footprint_corners_lonlat(
        lon,
        lat,
        params_in.length_m,
        params_in.width_m,
        params_in.rotation_deg,
    )


def _prepare_dem_terrain(
    project_id: UUID,
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
    params_in: PadParamsIn,
) -> tuple[Any, dict[str, Any]]:
    corners = _footprint_corners_lonlat_for_compute(obj, body, params_in)
    asset_id, path, updates = ensure_dem_for_object(project_id, obj, corners)
    terrain = _terrain_from_request(
        body,
        dem_asset_id=asset_id,
        dem_file_path=str(path),
    )
    return terrain, updates


def _params_from_sketch_and_body(
    sketch: PlanRectangleSketchIn | PlanPolygonSketchIn,
    body: PadEarthworkComputeRequest | None,
    obj: InfrastructureObject,
) -> PadParamsIn:
    height: float | None = None
    reference: float | None = None
    if body and body.params is not None:
        if isinstance(body.params, PadHeightReferenceIn):
            height = body.params.height_m
            reference = body.params.reference_elevation_m
        elif isinstance(body.params, PadParamsIn):
            height = body.params.height_m
            reference = body.params.reference_elevation_m
    if height is None or reference is None:
        existing = read_pad_params(obj.properties)
        if existing is None:
            raise HTTPException(
                status_code=400,
                detail="height_m and reference_elevation_m required with plan sketch",
            )
        height = existing.height_m
        reference = existing.reference_elevation_m
    if isinstance(sketch, PlanPolygonSketchIn):
        easts = [v.east_m for v in sketch.vertices]
        norths = [v.north_m for v in sketch.vertices]
        length_m = max(1.0, min(500.0, max(easts) - min(easts)))
        width_m = max(1.0, min(500.0, max(norths) - min(norths)))
        return PadParamsIn(
            length_m=length_m,
            width_m=width_m,
            height_m=height,
            rotation_deg=read_nds_deg(obj.properties),
            reference_elevation_m=reference,
        )
    return PadParamsIn(
        length_m=sketch.length_m,
        width_m=sketch.width_m,
        height_m=height,
        rotation_deg=sketch.rotation_deg,
        reference_elevation_m=reference,
    )


def resolve_compute_params(
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
) -> PadParamsIn:
    if body and body.sketch is not None:
        return _params_from_sketch_and_body(body.sketch, body, obj)
    if body and body.params is not None and isinstance(body.params, PadParamsIn):
        return body.params
    existing = read_pad_params(obj.properties)
    if existing is None:
        raise HTTPException(
            status_code=400,
            detail="Pad dimensions required: provide params or save pad_length_m, pad_width_m, pad_height_m",
        )
    return existing


def _planner_params_arg(
    body: PadEarthworkComputeRequest | None,
    params_in: PadParamsIn,
) -> Any:
    if body and body.sketch is not None:
        if body.params is not None:
            if isinstance(body.params, PadHeightReferenceIn):
                return _height_ref_to_planner(body.params)
            return _params_to_planner(body.params)
        return planner_schemas().PadHeightReference(
            height_m=params_in.height_m,
            reference_elevation_m=params_in.reference_elevation_m,
        )
    return _params_to_planner(params_in)


async def fetch_dem_for_object(
    project_id: UUID,
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None = None,
) -> tuple[PadDemFetchResponseOut, dict[str, Any]]:
    assert_pad_object(obj)
    params_in = resolve_compute_params(obj, body)
    corners = _footprint_corners_lonlat_for_compute(obj, body, params_in)
    asset_id, path, updates = ensure_dem_for_object(project_id, obj, corners)
    from app.services.pad_earthwork.dem_elevation_sample import infer_reference_elevation_from_dem
    from app.core.config import settings
    from app.services.pad_earthwork.dem_store import dem_source_label

    reference_elevation_m = infer_reference_elevation_from_dem(
        path,
        float(obj.longitude),
        float(obj.latitude),
        corners,
    )
    updates = {
        **updates,
        PAD_LENGTH_M: params_in.length_m,
        PAD_WIDTH_M: params_in.width_m,
        PAD_HEIGHT_M: params_in.height_m,
        PAD_ROTATION_DEG: params_in.rotation_deg,
        PAD_REFERENCE_ELEVATION_M: reference_elevation_m,
    }

    padding = float(settings.PAD_DEM_BBOX_PADDING_M)
    bbox = compute_dem_bbox(corners, padding_m=padding, lat_deg=float(obj.latitude))
    props = dict(obj.properties or {})
    fetched_raw = updates.get(PAD_DEM_FETCHED_AT) or props.get(PAD_DEM_FETCHED_AT)
    if isinstance(fetched_raw, str):
        fetched_at = datetime.fromisoformat(fetched_raw.replace("Z", "+00:00"))
    else:
        fetched_at = datetime.now(UTC)
    source = updates.get(PAD_DEM_SOURCE) or props.get(PAD_DEM_SOURCE)
    if not isinstance(source, str):
        source = dem_source_label()
    return (
        PadDemFetchResponseOut(
            dem_asset_id=asset_id,
            source=source,
            fetched_at=fetched_at,
            bbox=[bbox[0], bbox[1], bbox[2], bbox[3]],
            reference_elevation_m=reference_elevation_m,
        ),
        updates,
    )


async def persist_dem_properties_for_compute(
    project_id: UUID,
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
) -> dict[str, Any]:
    """Fetch/cache DEM and return property updates (empty when cache hit with props already set)."""
    if not _is_dem_mode(body):
        return {}
    _result, updates = await fetch_dem_for_object(project_id, obj, body)
    return updates


async def compute_pad_earthwork_for_object(
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
    *,
    project_id: UUID | None = None,
) -> tuple[PadEarthworkComputeResponse, dict[str, Any]]:
    assert_pad_object(obj)
    params_in = resolve_compute_params(obj, body)
    schemas = planner_schemas()
    sketch_arg = _sketch_to_planner(body.sketch) if body and body.sketch else None
    if sketch_arg is None:
        stored_sketch = read_sketch(obj.properties)
        if stored_sketch is not None:
            sketch_arg = _sketch_to_planner(stored_sketch)
    envelope_arg = None
    if body and body.envelope is not None and body.envelope.enabled:
        envelope_arg = schemas.EnvelopeWrap.model_validate(body.envelope.model_dump())

    dem_updates: dict[str, Any] = {}
    if _is_dem_mode(body):
        if project_id is None:
            raise HTTPException(status_code=500, detail="project_id required for dem compute")
        terrain, dem_updates = _prepare_dem_terrain(project_id, obj, body, params_in)
    else:
        terrain = _terrain_from_request(body)

    req = schemas.ComputeRequest(
        object_id=str(obj.id),
        subtype=obj.subtype,  # type: ignore[arg-type]
        center=schemas.LonLat(lon=float(obj.longitude), lat=float(obj.latitude)),
        params=_planner_params_arg(body, params_in),
        sketch=sketch_arg,
        envelope=envelope_arg,
        terrain=terrain,
    )
    adapter = get_pad_earthwork_adapter()
    DemNotSupportedError = dem_not_supported_error()
    try:
        raw = adapter.compute(req)
    except DemNotSupportedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    now = datetime.now(UTC)
    props = dict(obj.properties or {})
    props[PAD_LENGTH_M] = params_in.length_m
    props[PAD_WIDTH_M] = params_in.width_m
    props[PAD_HEIGHT_M] = params_in.height_m
    props[PAD_ROTATION_DEG] = params_in.rotation_deg
    props[PAD_REFERENCE_ELEVATION_M] = params_in.reference_elevation_m
    if body and body.sketch is not None:
        props = store_sketch(props, body.sketch)
    if body and body.envelope is not None:
        props = store_envelope(props, body.envelope)
    elif body and body.envelope is None:
        props = store_envelope(props, None)
    props.update(dem_updates)
    props = store_compute_result(props, raw)
    return planner_response_to_bff(raw, computed_at=now), props


def save_pad_sketch_for_object(
    obj: InfrastructureObject,
    body: PadEarthworkSketchSaveRequest,
) -> dict[str, Any]:
    assert_pad_object(obj)
    fake_body = PadEarthworkComputeRequest(
        params=body.params,
        sketch=body.sketch,
        envelope=body.envelope,
    )
    params_in = _params_from_sketch_and_body(body.sketch, fake_body, obj)
    if body.rotation_deg is not None:
        params_in = params_in.model_copy(update={"rotation_deg": body.rotation_deg})
    props = dict(obj.properties or {})
    props[PAD_LENGTH_M] = params_in.length_m
    props[PAD_WIDTH_M] = params_in.width_m
    props[PAD_HEIGHT_M] = params_in.height_m
    props[PAD_ROTATION_DEG] = params_in.rotation_deg
    props[PAD_REFERENCE_ELEVATION_M] = params_in.reference_elevation_m
    props = store_sketch(props, body.sketch)
    props = store_wells_local(props, body.wells_local)
    if body.envelope is not None:
        props = store_envelope(props, body.envelope)
    else:
        props = store_envelope(props, None)
    props[PAD_EARTHWORK_SKETCH_SAVED_AT] = datetime.now(UTC).isoformat()
    return props


def preview_pad_sketch(body: SketchPreviewRequestIn) -> SketchPreviewResponseOut:
    try:
        raw = preview_sketch_request(body.model_dump(mode="json"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SketchPreviewResponseOut.model_validate(raw.model_dump())


def generate_pad_sketch_from_wells(
    obj: InfrastructureObject,
    body: WellLayoutGenerateRequestIn | None,
) -> WellLayoutGenerateResponseOut:
    assert_pad_object(obj)
    from app.services.pad_earthwork.planner_bridge import generate_sketch_from_wells_request

    payload = resolve_well_layout_request(obj.properties, body)
    try:
        raw = generate_sketch_from_wells_request(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WellLayoutGenerateResponseOut.model_validate(raw.model_dump())


def patch_pad_params_only(
    props: dict[str, Any] | None,
    patch: PadEarthworkParamsPatch,
) -> dict[str, Any]:
    return merge_pad_params_patch(props, patch)
