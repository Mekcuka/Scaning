"""Read/write pad earthwork params and cached results in object properties."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from app.geo.sand_properties import parse_nonneg_float
from app.services.pad_earthwork.properties import (
    PAD_CUT_VOLUME_M3,
    PAD_EARTHWORK_COMPUTED_AT,
    PAD_EARTHWORK_SKETCH_JSON,
    PAD_EARTHWORK_SKETCH_SAVED_AT,
    PAD_ENVELOPE_ENABLED,
    PAD_ENVELOPE_WRAP_WIDTH_M,
    PAD_FILL_VOLUME_M3,
    PAD_HEIGHT_M,
    PAD_LENGTH_M,
    PAD_REFERENCE_ELEVATION_M,
    PAD_ROTATION_DEG,
    PAD_WIDTH_M,
)
from app.services.pad_earthwork.schemas import (
    DesignOut,
    EnvelopeWrapIn,
    FootprintCornerOut,
    MeshOut,
    PadEarthworkComputeResponse,
    PadEarthworkLastResponse,
    PadEarthworkParamsPatch,
    PadParamsIn,
    PlanPolygonSketchIn,
    PlanRectangleSketchIn,
    ProfileSketchIn,
    SketchIn,
    VolumesOut,
)

if TYPE_CHECKING:
    from pad_earthwork.schemas import ComputeResponse


def _read_float(props: dict[str, Any], key: str) -> float | None:
    return parse_nonneg_float(props.get(key))


def read_pad_params(props: dict[str, Any] | None) -> PadParamsIn | None:
    p = props or {}
    length = _read_float(p, PAD_LENGTH_M)
    width = _read_float(p, PAD_WIDTH_M)
    height = _read_float(p, PAD_HEIGHT_M)
    if length is None or width is None or height is None:
        return None
    ref = p.get(PAD_REFERENCE_ELEVATION_M)
    try:
        reference = float(ref) if ref is not None else 0.0
    except (TypeError, ValueError):
        reference = 0.0
    rot_raw = p.get(PAD_ROTATION_DEG)
    try:
        rotation = float(rot_raw) if rot_raw is not None else 0.0
    except (TypeError, ValueError):
        rotation = 0.0
    return PadParamsIn(
        length_m=length,
        width_m=width,
        height_m=height,
        rotation_deg=rotation,
        reference_elevation_m=reference,
    )


def pad_params_patch_delta(patch: PadEarthworkParamsPatch) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if patch.length_m is not None:
        out[PAD_LENGTH_M] = patch.length_m
    if patch.width_m is not None:
        out[PAD_WIDTH_M] = patch.width_m
    if patch.height_m is not None:
        out[PAD_HEIGHT_M] = patch.height_m
    if patch.rotation_deg is not None:
        out[PAD_ROTATION_DEG] = patch.rotation_deg
    if patch.reference_elevation_m is not None:
        out[PAD_REFERENCE_ELEVATION_M] = patch.reference_elevation_m
    return out


def merge_pad_params_patch(
    props: dict[str, Any] | None,
    patch: PadEarthworkParamsPatch,
) -> dict[str, Any]:
    out = dict(props or {})
    out.update(pad_params_patch_delta(patch))
    return out


def read_sketch(props: dict[str, Any] | None) -> PlanRectangleSketchIn | PlanPolygonSketchIn | ProfileSketchIn | None:
    raw = (props or {}).get(PAD_EARTHWORK_SKETCH_JSON)
    if not isinstance(raw, dict):
        return None
    kind = raw.get("kind")
    if kind == "plan_rectangle":
        return PlanRectangleSketchIn.model_validate(raw)
    if kind == "plan_polygon":
        return PlanPolygonSketchIn.model_validate(raw)
    if kind == "profile":
        return ProfileSketchIn.model_validate(raw)
    return None


def store_sketch(props: dict[str, Any] | None, sketch: SketchIn | None) -> dict[str, Any]:
    out = dict(props or {})
    if sketch is None:
        out.pop(PAD_EARTHWORK_SKETCH_JSON, None)
        return out
    out[PAD_EARTHWORK_SKETCH_JSON] = sketch.model_dump(mode="json")
    return out


def read_envelope(props: dict[str, Any] | None) -> EnvelopeWrapIn | None:
    p = props or {}
    enabled_raw = p.get(PAD_ENVELOPE_ENABLED)
    if enabled_raw is None:
        return None
    enabled = bool(enabled_raw)
    wrap_raw = p.get(PAD_ENVELOPE_WRAP_WIDTH_M)
    if wrap_raw is None:
        return EnvelopeWrapIn(enabled=enabled, wrap_width_m=3.0) if enabled else None
    try:
        wrap = float(wrap_raw)
    except (TypeError, ValueError):
        return None
    if not enabled:
        return EnvelopeWrapIn(enabled=False, wrap_width_m=wrap)
    return EnvelopeWrapIn(enabled=True, wrap_width_m=wrap)


def read_sketch_saved_at(props: dict[str, Any] | None) -> datetime | None:
    raw = (props or {}).get(PAD_EARTHWORK_SKETCH_SAVED_AT)
    if not isinstance(raw, str):
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def store_envelope(
    props: dict[str, Any] | None,
    envelope: EnvelopeWrapIn | None,
) -> dict[str, Any]:
    out = dict(props or {})
    if envelope is None:
        out.pop(PAD_ENVELOPE_ENABLED, None)
        out.pop(PAD_ENVELOPE_WRAP_WIDTH_M, None)
        return out
    out[PAD_ENVELOPE_ENABLED] = envelope.enabled
    out[PAD_ENVELOPE_WRAP_WIDTH_M] = envelope.wrap_width_m
    return out


def store_compute_result(props: dict[str, Any] | None, result: "ComputeResponse") -> dict[str, Any]:
    out = dict(props or {})
    out[PAD_FILL_VOLUME_M3] = result.volumes.fill_m3
    out[PAD_CUT_VOLUME_M3] = result.volumes.cut_m3
    out[PAD_EARTHWORK_COMPUTED_AT] = datetime.now(UTC).isoformat()
    return out


def read_last_response(props: dict[str, Any] | None) -> PadEarthworkComputeResponse | None:
    p = props or {}
    fill = _read_float(p, PAD_FILL_VOLUME_M3)
    cut = _read_float(p, PAD_CUT_VOLUME_M3)
    if fill is None:
        return None
    if cut is None:
        cut = 0.0
    computed_raw = p.get(PAD_EARTHWORK_COMPUTED_AT)
    computed_at = None
    if isinstance(computed_raw, str):
        try:
            computed_at = datetime.fromisoformat(computed_raw.replace("Z", "+00:00"))
        except ValueError:
            computed_at = None
    params = read_pad_params(p)
    top = None
    area = None
    if params is not None:
        top = params.reference_elevation_m + params.height_m
        area = params.length_m * params.width_m
    return PadEarthworkComputeResponse(
        volumes=VolumesOut(fill_m3=fill, cut_m3=cut, net_fill_m3=fill - cut),
        design=DesignOut(
            top_elevation_m=top if top is not None else 0.0,
            footprint_area_m2=area if area is not None else 0.0,
        ),
        footprint_corners=[],
        mesh=None,
        warnings=[],
        computed_at=computed_at,
    )


def build_last_response(props: dict[str, Any] | None) -> PadEarthworkLastResponse:
    return PadEarthworkLastResponse(
        params=read_pad_params(props),
        sketch=read_sketch(props),
        envelope=read_envelope(props),
        sketch_saved_at=read_sketch_saved_at(props),
        result=read_last_response(props),
    )


def planner_response_to_bff(
    result: "ComputeResponse",
    *,
    computed_at: datetime | None = None,
) -> PadEarthworkComputeResponse:
    mesh = None
    if result.mesh is not None:
        mesh = MeshOut(format=result.mesh.format, base64=result.mesh.base64)
    return PadEarthworkComputeResponse(
        volumes=VolumesOut(
            fill_m3=result.volumes.fill_m3,
            cut_m3=result.volumes.cut_m3,
            net_fill_m3=result.volumes.net_fill_m3,
        ),
        design=DesignOut(
            top_elevation_m=result.design.top_elevation_m,
            footprint_area_m2=result.design.footprint_area_m2,
        ),
        footprint_corners=[
            FootprintCornerOut(lon=c.lon, lat=c.lat) for c in result.footprint_corners
        ],
        mesh=mesh,
        warnings=list(result.warnings),
        computed_at=computed_at,
    )
