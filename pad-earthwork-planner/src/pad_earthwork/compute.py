"""Compute pipeline."""

from __future__ import annotations

from pad_earthwork.dem_volume import compute_volumes_dem
from pad_earthwork.design_surface import design_surface_summary
from pad_earthwork.envelope import (
    compute_envelope_volumes,
    top_vertices_from_polygon_sketch,
    top_vertices_from_rectangle_sketch,
)
from pad_earthwork.footprint import footprint_corners_lonlat, footprint_polygon_lonlat
from pad_earthwork.mesh import box_mesh_glb_base64
from pad_earthwork.schemas import (
    ComputeRequest,
    ComputeResponse,
    DesignOut,
    EnvelopeWrap,
    FootprintCornerOut,
    LocalCornerOut,
    MeshOut,
    PadHeightReference,
    PadParams,
    PlanPolygonSketch,
    PlanRectangleSketch,
    ProfileSketch,
    SketchPreviewRequest,
    SketchPreviewResponse,
    TerrainDem,
    VolumesOut,
)
from pad_earthwork.volume_flat import compute_volumes_flat
from pad_earthwork.volume_plan import (
    derive_params_from_plan,
    derive_params_from_polygon,
    plan_corners_local_m,
    plan_footprint_area_m2,
    polygon_bbox_dims,
    polygon_footprint_area_m2,
    polygon_vertices_local_m,
)
from pad_earthwork.volume_profile import (
    compute_volumes_profile,
    compute_volumes_profile_with_envelope,
    derive_params_from_profile,
    profile_length_m,
)


class DemNotSupportedError(Exception):
    """Raised when terrain.mode=dem without implemented DEM pipeline."""


def _resolve_pad_params(req: ComputeRequest) -> PadParams:
    if req.profile is not None:
        p = req.params
        height_m: float
        reference_elevation_m: float
        rotation_deg: float
        if isinstance(p, PadParams):
            height_m = p.height_m
            reference_elevation_m = p.reference_elevation_m
            rotation_deg = p.rotation_deg
        elif isinstance(p, PadHeightReference):
            height_m = p.height_m
            reference_elevation_m = p.reference_elevation_m
            rotation_deg = 0.0
        else:
            raise ValueError("params required with profile")
        return derive_params_from_profile(
            req.profile,
            rotation_deg=rotation_deg,
            height_m=height_m,
            reference_elevation_m=reference_elevation_m,
        )
    if isinstance(req.sketch, PlanRectangleSketch):
        p = req.params
        if isinstance(p, PadParams):
            return derive_params_from_plan(
                req.sketch,
                height_m=p.height_m,
                reference_elevation_m=p.reference_elevation_m,
            )
        if isinstance(p, PadHeightReference):
            return derive_params_from_plan(
                req.sketch,
                height_m=p.height_m,
                reference_elevation_m=p.reference_elevation_m,
            )
        raise ValueError("params required with plan sketch")
    if isinstance(req.sketch, PlanPolygonSketch):
        p = req.params
        if isinstance(p, PadParams):
            return derive_params_from_polygon(
                req.sketch,
                height_m=p.height_m,
                reference_elevation_m=p.reference_elevation_m,
            )
        if isinstance(p, PadHeightReference):
            return derive_params_from_polygon(
                req.sketch,
                height_m=p.height_m,
                reference_elevation_m=p.reference_elevation_m,
            )
        raise ValueError("params required with polygon sketch")
    if isinstance(req.params, PadParams):
        return req.params
    raise ValueError("full params required when sketch is omitted")


def _envelope_active(req: ComputeRequest) -> EnvelopeWrap | None:
    if req.envelope is not None and req.envelope.enabled:
        return req.envelope
    return None


def _top_vertices_from_request(req: ComputeRequest, params: PadParams) -> list:
    from pad_earthwork.schemas import PlanVertex

    if isinstance(req.sketch, PlanPolygonSketch):
        return top_vertices_from_polygon_sketch(req.sketch)
    if isinstance(req.sketch, PlanRectangleSketch):
        return top_vertices_from_rectangle_sketch(req.sketch)
    hl = params.length_m / 2.0
    hw = params.width_m / 2.0
    import math

    rot = math.radians(params.rotation_deg)
    cos_r = math.cos(rot)
    sin_r = math.sin(rot)
    local = [(-hl, -hw), (hl, -hw), (hl, hw), (-hl, hw)]
    return [
        PlanVertex(
            east_m=e * cos_r - n * sin_r,
            north_m=e * sin_r + n * cos_r,
        )
        for e, n in local
    ]


def _local_vertices_from_request(req: ComputeRequest, params: PadParams) -> list[tuple[float, float]]:
    vertices = _top_vertices_from_request(req, params)
    return [(v.east_m, v.north_m) for v in vertices]


def _footprint_corners_from_request(
    req: ComputeRequest,
    params: PadParams,
) -> list[tuple[float, float]]:
    if isinstance(req.sketch, PlanPolygonSketch):
        return footprint_polygon_lonlat(
            req.center.lon,
            req.center.lat,
            polygon_vertices_local_m(req.sketch),
        )
    if isinstance(req.sketch, PlanRectangleSketch):
        return footprint_corners_lonlat(
            req.center.lon,
            req.center.lat,
            req.sketch.length_m,
            req.sketch.width_m,
            req.sketch.rotation_deg,
        )
    return footprint_corners_lonlat(
        req.center.lon,
        req.center.lat,
        params.length_m,
        params.width_m,
        params.rotation_deg,
    )


def _compute_dem_response(req: ComputeRequest, params: PadParams) -> ComputeResponse:
    if not isinstance(req.terrain, TerrainDem) or not req.terrain.dem_file_path:
        raise DemNotSupportedError("dem_not_available")

    warnings: list[str] = []
    if _envelope_active(req) is not None:
        warnings.append("envelope_ignored_with_dem")

    local_vertices = _local_vertices_from_request(req, params)
    _dem_fill, cut_m3, _footprint_area_grid, dem_warnings = compute_volumes_dem(
        req.terrain.dem_file_path,
        req.center.lon,
        req.center.lat,
        local_vertices,
        reference_elevation_m=params.reference_elevation_m,
        height_m=params.height_m,
    )
    warnings.extend(dem_warnings)
    corners = _footprint_corners_from_request(req, params)
    if isinstance(req.sketch, PlanPolygonSketch):
        footprint_area = polygon_footprint_area_m2(req.sketch.vertices)
        warnings.append("polygon_mesh_is_bbox_approximation")
    elif isinstance(req.sketch, PlanRectangleSketch):
        footprint_area = plan_footprint_area_m2(req.sketch)
    else:
        footprint_area = params.length_m * params.width_m

    fill_m3 = footprint_area * params.height_m
    design = design_surface_summary(params, footprint_area_m2=footprint_area)
    mesh_b64 = box_mesh_glb_base64(params.length_m, params.width_m, params.height_m)
    return ComputeResponse(
        volumes=VolumesOut(
            fill_m3=round(fill_m3, 3),
            cut_m3=round(cut_m3, 3),
            net_fill_m3=round(fill_m3, 3),
        ),
        design=design,
        footprint_corners=[FootprintCornerOut(lon=c[0], lat=c[1]) for c in corners],
        mesh=MeshOut(format="glb", base64=mesh_b64),
        warnings=warnings,
    )


def _compute_profile_response(req: ComputeRequest, params: PadParams) -> ComputeResponse:
    assert req.profile is not None
    warnings: list[str] = []
    envelope = _envelope_active(req)
    if isinstance(req.terrain, TerrainDem):
        warnings.append("profile_volumes_use_chainage_terrain")

    if envelope is not None:
        fill_m3, cut_m3, footprint_area, profile_warnings = compute_volumes_profile_with_envelope(
            req.profile,
            envelope,
            params.height_m,
        )
    else:
        fill_m3, cut_m3, footprint_area, profile_warnings = compute_volumes_profile(req.profile)
    warnings.extend(profile_warnings)

    corners = _footprint_corners_from_request(req, params)
    design = DesignOut(
        top_elevation_m=req.profile.design_elevation_m,
        footprint_area_m2=footprint_area,
    )
    mesh_b64 = box_mesh_glb_base64(params.length_m, params.width_m, params.height_m)
    return ComputeResponse(
        volumes=VolumesOut(
            fill_m3=round(fill_m3, 3),
            cut_m3=round(cut_m3, 3),
            net_fill_m3=round(fill_m3, 3),
        ),
        design=design,
        footprint_corners=[FootprintCornerOut(lon=c[0], lat=c[1]) for c in corners],
        mesh=MeshOut(format="glb", base64=mesh_b64),
        warnings=warnings,
    )


def preview_sketch(body: SketchPreviewRequest) -> SketchPreviewResponse:
    sketch = body.sketch
    if isinstance(sketch, ProfileSketch):
        length_m = max(1.0, profile_length_m(sketch.chainage_points))
        return SketchPreviewResponse(
            length_m=length_m,
            width_m=sketch.width_m,
            rotation_deg=0.0,
            footprint_area_m2=length_m * sketch.width_m,
            footprint_corners_local=[],
        )
    if isinstance(sketch, PlanRectangleSketch):
        corners = plan_corners_local_m(sketch)
        return SketchPreviewResponse(
            length_m=sketch.length_m,
            width_m=sketch.width_m,
            rotation_deg=sketch.rotation_deg,
            footprint_area_m2=plan_footprint_area_m2(sketch),
            footprint_corners_local=[
                LocalCornerOut(east_m=c[0], north_m=c[1]) for c in corners
            ],
        )
    if isinstance(sketch, PlanPolygonSketch):
        corners = polygon_vertices_local_m(sketch)
        length_m, width_m, rotation_deg = polygon_bbox_dims(sketch.vertices)
        return SketchPreviewResponse(
            length_m=length_m,
            width_m=width_m,
            rotation_deg=rotation_deg,
            footprint_area_m2=polygon_footprint_area_m2(sketch.vertices),
            footprint_corners_local=[
                LocalCornerOut(east_m=c[0], north_m=c[1]) for c in corners
            ],
        )
    raise ValueError("unsupported sketch kind")


def compute_pad_earthwork(req: ComputeRequest) -> ComputeResponse:
    if req.profile is not None:
        params = _resolve_pad_params(req)
        return _compute_profile_response(req, params)

    if isinstance(req.terrain, TerrainDem):
        params = _resolve_pad_params(req)
        return _compute_dem_response(req, params)

    warnings: list[str] = []
    params = _resolve_pad_params(req)
    envelope = _envelope_active(req)
    footprint_area = params.length_m * params.width_m
    cut_m3 = 0.0

    if envelope is not None:
        top_vertices = _top_vertices_from_request(req, params)
        fill_m3, footprint_area, outer_local, env_warnings = compute_envelope_volumes(
            top_vertices,
            params.height_m,
            envelope,
        )
        warnings.extend(env_warnings)
        corners = footprint_polygon_lonlat(
            req.center.lon,
            req.center.lat,
            outer_local,
        )
        if isinstance(req.sketch, PlanPolygonSketch):
            warnings.append("polygon_mesh_is_bbox_approximation")
    elif isinstance(req.sketch, PlanPolygonSketch):
        footprint_area = polygon_footprint_area_m2(req.sketch.vertices)
        fill_m3 = footprint_area * params.height_m
        corners = footprint_polygon_lonlat(
            req.center.lon,
            req.center.lat,
            polygon_vertices_local_m(req.sketch),
        )
        warnings.append("polygon_mesh_is_bbox_approximation")
    else:
        fill_m3, cut_m3 = compute_volumes_flat(params.length_m, params.width_m, params.height_m)
        corners = footprint_corners_lonlat(
            req.center.lon,
            req.center.lat,
            params.length_m,
            params.width_m,
            params.rotation_deg,
        )

    design = design_surface_summary(params, footprint_area_m2=footprint_area)
    mesh_b64 = box_mesh_glb_base64(params.length_m, params.width_m, params.height_m)
    return ComputeResponse(
        volumes=VolumesOut(
            fill_m3=round(fill_m3, 3),
            cut_m3=round(cut_m3, 3),
            net_fill_m3=round(fill_m3, 3),
        ),
        design=design,
        footprint_corners=[FootprintCornerOut(lon=c[0], lat=c[1]) for c in corners],
        mesh=MeshOut(format="glb", base64=mesh_b64),
        warnings=warnings,
    )
