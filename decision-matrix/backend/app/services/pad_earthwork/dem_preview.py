"""DEM elevation grid preview for pad earthwork sketch overlay."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import InfrastructureObject
from app.services.pad_earthwork.dem_store import compute_dem_bbox
from app.services.pad_earthwork.pad_dem_repository import ensure_pad_dem
from app.services.pad_earthwork.gdal_proj import configure_rasterio_proj
from app.services.pad_earthwork.schemas import (
    PadDemPreviewBoundsOut,
    PadDemPreviewResponseOut,
    PadEarthworkComputeRequest,
    PlanPolygonSketchIn,
    PlanRectangleSketchIn,
)
from app.services.pad_earthwork.earthwork_store import read_sketch
from app.services.pad_earthwork.service import (
    _footprint_corners_lonlat_for_compute,
    resolve_compute_params,
)

MAX_GRID_CELLS = 128
CUT_FILL_EPS_M = 0.05


def _lonlat_to_local(
    lon0: float,
    lat0: float,
    lon: float,
    lat: float,
) -> tuple[float, float]:
    from pad_earthwork.footprint import meters_per_degree

    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat0)
    east_m = (lon - lon0) * m_per_deg_lon
    north_m = (lat - lat0) * m_per_deg_lat
    return east_m, north_m


def _point_in_polygon(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y):
            x_intersect = (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi
            if x < x_intersect:
                inside = not inside
        j = i
    return inside


def _footprint_local_vertices(
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
    params_in: Any,
) -> list[tuple[float, float]]:
    sketch = body.sketch if body and body.sketch is not None else read_sketch(obj.properties)
    if isinstance(sketch, PlanPolygonSketchIn):
        return [(v.east_m, v.north_m) for v in sketch.vertices]
    if isinstance(sketch, PlanRectangleSketchIn):
        from pad_earthwork.volume_plan import plan_corners_local_m
        from pad_earthwork.schemas import PlanRectangleSketch

        planner_sketch = PlanRectangleSketch.model_validate(sketch.model_dump())
        return plan_corners_local_m(planner_sketch)
    from pad_earthwork.footprint import footprint_corners_lonlat

    lon = float(obj.longitude)
    lat = float(obj.latitude)
    corners_lonlat = footprint_corners_lonlat(
        lon,
        lat,
        params_in.length_m,
        params_in.width_m,
        params_in.rotation_deg,
    )
    return [_lonlat_to_local(lon, lat, c[0], c[1]) for c in corners_lonlat]


def _dem_bbox_local_bounds(
    bbox: tuple[float, float, float, float],
    center_lon: float,
    center_lat: float,
) -> tuple[float, float, float, float]:
    west, south, east, north = bbox
    corners_lonlat = [
        (west, south),
        (east, south),
        (east, north),
        (west, north),
    ]
    locals_ = [_lonlat_to_local(center_lon, center_lat, lon, lat) for lon, lat in corners_lonlat]
    easts = [p[0] for p in locals_]
    norths = [p[1] for p in locals_]
    return min(easts), max(easts), min(norths), max(norths)


def _sample_elevation(dataset, lon: float, lat: float, nodata: float | None) -> float | None:
    try:
        values = list(dataset.sample([(lon, lat)]))
    except Exception:
        return None
    if not values:
        return None
    val = float(values[0][0])
    if nodata is not None and (math.isnan(val) or abs(val - nodata) < 1e-6):
        return None
    if math.isnan(val):
        return None
    return val


def _local_to_lonlat(lon0: float, lat0: float, east_m: float, north_m: float) -> tuple[float, float]:
    from pad_earthwork.footprint import meters_per_degree

    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat0)
    return lon0 + east_m / m_per_deg_lon, lat0 + north_m / m_per_deg_lat


def _grid_dimensions(min_e: float, max_e: float, min_n: float, max_n: float) -> tuple[int, int, float]:
    extent_e = max(1.0, max_e - min_e)
    extent_n = max(1.0, max_n - min_n)
    cell_size = max(1.0, extent_e / MAX_GRID_CELLS, extent_n / MAX_GRID_CELLS)
    cols = max(1, min(MAX_GRID_CELLS, int(math.ceil(extent_e / cell_size))))
    rows = max(1, min(MAX_GRID_CELLS, int(math.ceil(extent_n / cell_size))))
    return cols, rows, cell_size


async def build_dem_preview_for_object(
    db: AsyncSession,
    project_id: UUID,
    obj: InfrastructureObject,
    body: PadEarthworkComputeRequest | None,
    *,
    dem_path: Path | None = None,
) -> PadDemPreviewResponseOut:
    params_in = resolve_compute_params(obj, body)
    center_lon = float(obj.longitude)
    center_lat = float(obj.latitude)
    footprint = _footprint_local_vertices(obj, body, params_in)
    if len(footprint) < 3:
        raise HTTPException(status_code=400, detail="invalid_footprint")

    corners_lonlat = _footprint_corners_lonlat_for_compute(obj, body, params_in)
    padding = float(settings.PAD_DEM_BBOX_PADDING_M)
    bbox = compute_dem_bbox(
        corners_lonlat,
        padding_m=padding,
        lat_deg=center_lat,
    )
    min_east, max_east, min_north, max_north = _dem_bbox_local_bounds(bbox, center_lon, center_lat)

    if dem_path is None:
        _asset_id, path, _updates = await ensure_pad_dem(
            db,
            project_id=project_id,
            obj=obj,
            footprint_corners_lonlat=corners_lonlat,
        )
        dem_path = path
    if not dem_path.is_file():
        raise HTTPException(status_code=404, detail="dem_not_loaded")

    design_elevation_m = params_in.reference_elevation_m + params_in.height_m
    cols, rows, cell_size = _grid_dimensions(min_east, max_east, min_north, max_north)

    configure_rasterio_proj()
    import rasterio

    elevations: list[float | None] = []
    cut_fill: list[int | None] = []
    elev_samples: list[float] = []
    footprint_elev_samples: list[float] = []

    with rasterio.open(dem_path) as dataset:
        nodata = dataset.nodata
        if nodata is not None:
            try:
                nodata = float(nodata)
            except (TypeError, ValueError):
                nodata = None

        for row in range(rows):
            north = min_north + (row + 0.5) * cell_size
            for col in range(cols):
                east = min_east + (col + 0.5) * cell_size
                lon, lat = _local_to_lonlat(center_lon, center_lat, east, north)
                elev = _sample_elevation(dataset, lon, lat, nodata)
                elevations.append(elev)
                if elev is not None:
                    elev_samples.append(elev)

                if not _point_in_polygon(east, north, footprint):
                    cut_fill.append(None)
                    continue
                if elev is None:
                    cut_fill.append(None)
                    continue
                footprint_elev_samples.append(elev)
                if elev > params_in.reference_elevation_m + CUT_FILL_EPS_M:
                    cut_fill.append(-1)
                else:
                    cut_fill.append(0)

    if not elev_samples:
        raise HTTPException(status_code=502, detail="dem_preview_no_data")
    if not footprint_elev_samples:
        raise HTTPException(status_code=502, detail="dem_preview_no_footprint_data")

    return PadDemPreviewResponseOut(
        bounds=PadDemPreviewBoundsOut(
            min_east_m=min_east,
            max_east_m=max_east,
            min_north_m=min_north,
            max_north_m=max_north,
        ),
        cols=cols,
        rows=rows,
        cell_size_m=cell_size,
        elev_min=min(elev_samples),
        elev_max=max(elev_samples),
        footprint_elev_min=round(min(footprint_elev_samples), 2),
        design_elevation_m=design_elevation_m,
        elevations=elevations,
        cut_fill=cut_fill,
    )
