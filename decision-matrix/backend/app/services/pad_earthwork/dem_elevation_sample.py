"""Sample ground elevation from cached DEM for pad reference mark."""

from __future__ import annotations

import math
import statistics
from pathlib import Path

from fastapi import HTTPException

from app.services.pad_earthwork.gdal_proj import configure_rasterio_proj


def sample_elevation_at_lonlat(
    dataset,
    lon: float,
    lat: float,
    nodata: float | None,
) -> float | None:
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


def infer_reference_elevation_from_dem(
    dem_path: Path,
    center_lon: float,
    center_lat: float,
    footprint_corners_lonlat: list[tuple[float, float]],
) -> float:
    """Median elevation at pad center and footprint corners (meters AMSL)."""
    configure_rasterio_proj()
    try:
        import rasterio
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="rasterio_not_available") from exc

    sample_points: list[tuple[float, float]] = [(center_lon, center_lat)]
    for corner in footprint_corners_lonlat:
        pt = (corner[0], corner[1])
        if pt not in sample_points:
            sample_points.append(pt)

    elevations: list[float] = []
    try:
        with rasterio.open(dem_path) as dataset:
            nodata = dataset.nodata
            for lon, lat in sample_points:
                elev = sample_elevation_at_lonlat(dataset, lon, lat, nodata)
                if elev is not None:
                    elevations.append(elev)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="dem_elevation_sample_failed") from exc

    if not elevations:
        raise HTTPException(status_code=502, detail="dem_elevation_sample_failed")

    return round(statistics.median(elevations), 2)
