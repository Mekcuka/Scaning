"""Sample DEM elevations along pad centerline for profile editor."""

from __future__ import annotations

import math
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.dem_elevation_sample import sample_elevation_at_lonlat
from app.services.pad_earthwork.dem_store import ensure_dem_for_object
from app.services.pad_earthwork.earthwork_store import read_sketch
from app.services.pad_earthwork.gdal_proj import configure_rasterio_proj
from app.services.pad_earthwork.schemas import (
    PadDemProfileSampleRequest,
    PadDemProfileSampleResponse,
    PadHeightReferenceIn,
    PadParamsIn,
    PlanPolygonSketchIn,
    PlanRectangleSketchIn,
    ProfileChainagePointIn,
)
from app.services.pad_earthwork.service import (
    _footprint_corners_lonlat_for_compute,
    resolve_compute_params,
)


def _resolve_length_rotation(
    obj: InfrastructureObject,
    params_in: PadParamsIn,
) -> tuple[float, float]:
    sketch = read_sketch(obj.properties)
    if isinstance(sketch, PlanRectangleSketchIn):
        return sketch.length_m, sketch.rotation_deg
    if isinstance(sketch, PlanPolygonSketchIn):
        from pad_earthwork.schemas import PlanVertex
        from pad_earthwork.volume_plan import polygon_bbox_dims

        verts = [PlanVertex(east_m=v.east_m, north_m=v.north_m) for v in sketch.vertices]
        length_m, _width_m, _ = polygon_bbox_dims(verts)
        from app.services.pad_earthwork.earthwork_store import read_nds_deg

        return length_m, read_nds_deg(obj.properties)
    return params_in.length_m, params_in.rotation_deg


def _centerline_lonlat(
    center_lon: float,
    center_lat: float,
    length_m: float,
    rotation_deg: float,
    chainage_m: float,
) -> tuple[float, float]:
    from pad_earthwork.footprint import meters_per_degree

    m_per_deg_lon, m_per_deg_lat = meters_per_degree(center_lat)
    rot = math.radians(rotation_deg)
    offset = chainage_m - length_m / 2.0
    east_m = offset * math.cos(rot)
    north_m = offset * math.sin(rot)
    return center_lon + east_m / m_per_deg_lon, center_lat + north_m / m_per_deg_lat


def _design_elevation_from_params(
    params_in: PadParamsIn,
    body: PadDemProfileSampleRequest | None,
) -> float:
    if body and body.params is not None:
        if isinstance(body.params, PadHeightReferenceIn):
            return body.params.reference_elevation_m + body.params.height_m
        return body.params.reference_elevation_m + body.params.height_m
    return params_in.reference_elevation_m + params_in.height_m


def build_dem_profile_sample_for_object(
    project_id: UUID,
    obj: InfrastructureObject,
    body: PadDemProfileSampleRequest | None,
) -> PadDemProfileSampleResponse:
    params_in = resolve_compute_params(obj, None)
    if body and body.params is not None:
        if isinstance(body.params, PadParamsIn):
            params_in = body.params
        elif isinstance(body.params, PadHeightReferenceIn):
            params_in = params_in.model_copy(
                update={
                    "height_m": body.params.height_m,
                    "reference_elevation_m": body.params.reference_elevation_m,
                }
            )

    length_m, rotation_deg = _resolve_length_rotation(obj, params_in)
    step_m = body.step_m if body else 1.0
    center_lon = float(obj.longitude)
    center_lat = float(obj.latitude)

    corners = _footprint_corners_lonlat_for_compute(obj, None, params_in)
    _asset_id, dem_path, _updates = ensure_dem_for_object(project_id, obj, corners)
    if not dem_path.is_file():
        raise HTTPException(status_code=404, detail="dem_not_loaded")

    configure_rasterio_proj()
    import rasterio

    chainage_points: list[ProfileChainagePointIn] = []
    with rasterio.open(dem_path) as dataset:
        nodata = dataset.nodata
        s = 0.0
        while s <= length_m + 1e-9:
            lon, lat = _centerline_lonlat(center_lon, center_lat, length_m, rotation_deg, s)
            elev = sample_elevation_at_lonlat(dataset, lon, lat, nodata)
            if elev is not None:
                chainage_points.append(ProfileChainagePointIn(chainage_m=round(s, 3), elevation_m=round(elev, 3)))
            s += step_m

    if len(chainage_points) < 2:
        raise HTTPException(status_code=422, detail="dem_profile_sample_insufficient_points")

    return PadDemProfileSampleResponse(
        chainage_points=chainage_points,
        length_m=length_m,
        rotation_deg=rotation_deg,
        design_elevation_m=_design_elevation_from_params(params_in, body),
    )
