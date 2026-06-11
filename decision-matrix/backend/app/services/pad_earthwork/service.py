"""Orchestration for pad earthwork BFF."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_adapter import get_pad_earthwork_adapter
from app.services.pad_earthwork.earthwork_store import (
    merge_pad_params_patch,
    planner_response_to_bff,
    read_pad_params,
    store_compute_result,
    store_envelope,
    store_sketch,
)
from app.services.pad_earthwork.planner_bridge import (
    dem_not_supported_error,
    planner_schemas,
    preview_sketch_request,
    profile_not_supported_error,
)
from app.services.pad_earthwork.properties import (
    PAD_EARTHWORK_SKETCH_SAVED_AT,
    PAD_HEIGHT_M,
    PAD_LENGTH_M,
    PAD_REFERENCE_ELEVATION_M,
    PAD_ROTATION_DEG,
    PAD_WIDTH_M,
)
from app.services.pad_earthwork.schemas import (
    EnvelopeWrapIn,
    PadEarthworkComputeRequest,
    PadEarthworkComputeResponse,
    PadEarthworkParamsPatch,
    PadEarthworkSketchSaveRequest,
    PadHeightReferenceIn,
    PadParamsIn,
    PlanPolygonSketchIn,
    PlanRectangleSketchIn,
    ProfileSketchIn,
    SketchPreviewRequestIn,
    SketchPreviewResponseOut,
    TerrainDemIn,
)
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES


def assert_pad_object(obj: InfrastructureObject) -> None:
    if obj.subtype not in PAD_CLUSTER_SUBTYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Pad earthwork is only available for subtypes: {sorted(PAD_CLUSTER_SUBTYPES)}",
        )


def _sketch_to_planner(sketch: PlanRectangleSketchIn | PlanPolygonSketchIn | ProfileSketchIn) -> Any:
    schemas = planner_schemas()
    if isinstance(sketch, PlanRectangleSketchIn):
        return schemas.PlanRectangleSketch.model_validate(sketch.model_dump())
    if isinstance(sketch, PlanPolygonSketchIn):
        return schemas.PlanPolygonSketch.model_validate(sketch.model_dump())
    return schemas.ProfileSketch.model_validate(sketch.model_dump())


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


def _terrain_from_request(body: PadEarthworkComputeRequest | None) -> Any:
    schemas = planner_schemas()
    if body is None or body.terrain is None:
        return schemas.TerrainFlat()
    if isinstance(body.terrain, TerrainDemIn):
        return schemas.TerrainDem(mode="dem", dem_asset_id=body.terrain.dem_asset_id)
    return schemas.TerrainFlat()


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
            rotation_deg=0,
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
        if isinstance(body.sketch, ProfileSketchIn):
            raise HTTPException(status_code=501, detail="profile_not_supported")
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


def _planner_params_arg(body: PadEarthworkComputeRequest | None, params_in: PadParamsIn) -> Any:
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


async def compute_pad_earthwork_for_object(
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
) -> tuple[PadEarthworkComputeResponse, dict[str, Any]]:
    assert_pad_object(obj)
    if body and body.sketch is not None and isinstance(body.sketch, ProfileSketchIn):
        raise HTTPException(status_code=501, detail="profile_not_supported")
    params_in = resolve_compute_params(obj, body)
    schemas = planner_schemas()
    sketch_arg = _sketch_to_planner(body.sketch) if body and body.sketch else None
    envelope_arg = None
    if body and body.envelope is not None and body.envelope.enabled:
        envelope_arg = schemas.EnvelopeWrap.model_validate(body.envelope.model_dump())
    req = schemas.ComputeRequest(
        object_id=str(obj.id),
        subtype=obj.subtype,  # type: ignore[arg-type]
        center=schemas.LonLat(lon=float(obj.longitude), lat=float(obj.latitude)),
        params=_planner_params_arg(body, params_in),
        sketch=sketch_arg,
        envelope=envelope_arg,
        terrain=_terrain_from_request(body),
    )
    adapter = get_pad_earthwork_adapter()
    DemNotSupportedError = dem_not_supported_error()
    ProfileNotSupportedError = profile_not_supported_error()
    try:
        raw = adapter.compute(req)
    except DemNotSupportedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except ProfileNotSupportedError as exc:
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
    props = store_compute_result(props, raw)
    return planner_response_to_bff(raw, computed_at=now), props


def save_pad_sketch_for_object(
    obj: InfrastructureObject,
    body: PadEarthworkSketchSaveRequest,
) -> dict[str, Any]:
    assert_pad_object(obj)
    if isinstance(body.sketch, ProfileSketchIn):
        raise HTTPException(status_code=501, detail="profile_not_supported")
    fake_body = PadEarthworkComputeRequest(
        params=body.params,
        sketch=body.sketch,
        envelope=body.envelope,
    )
    params_in = _params_from_sketch_and_body(body.sketch, fake_body, obj)
    props = dict(obj.properties or {})
    props[PAD_LENGTH_M] = params_in.length_m
    props[PAD_WIDTH_M] = params_in.width_m
    props[PAD_HEIGHT_M] = params_in.height_m
    props[PAD_ROTATION_DEG] = params_in.rotation_deg
    props[PAD_REFERENCE_ELEVATION_M] = params_in.reference_elevation_m
    props = store_sketch(props, body.sketch)
    if body.envelope is not None:
        props = store_envelope(props, body.envelope)
    else:
        props = store_envelope(props, None)
    props[PAD_EARTHWORK_SKETCH_SAVED_AT] = datetime.now(UTC).isoformat()
    return props


def preview_pad_sketch(body: SketchPreviewRequestIn) -> SketchPreviewResponseOut:
    if isinstance(body.sketch, ProfileSketchIn):
        raise HTTPException(status_code=501, detail="profile_not_supported")
    ProfileNotSupportedError = profile_not_supported_error()
    try:
        raw = preview_sketch_request(body.model_dump(mode="json"))
    except ProfileNotSupportedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    return SketchPreviewResponseOut.model_validate(raw.model_dump())


def patch_pad_params_only(
    props: dict[str, Any] | None,
    patch: PadEarthworkParamsPatch,
) -> dict[str, Any]:
    return merge_pad_params_patch(props, patch)
