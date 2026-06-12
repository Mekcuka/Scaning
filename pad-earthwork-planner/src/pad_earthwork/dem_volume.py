"""DEM-based cut/fill volume computation."""

from __future__ import annotations

import math
from pathlib import Path

from pad_earthwork.footprint import meters_per_degree


def _local_to_lonlat(
    lon0: float,
    lat0: float,
    east_m: float,
    north_m: float,
) -> tuple[float, float]:
    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat0)
    return lon0 + east_m / m_per_deg_lon, lat0 + north_m / m_per_deg_lat


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


def _footprint_bounds(vertices: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    easts = [v[0] for v in vertices]
    norths = [v[1] for v in vertices]
    return min(easts), max(easts), min(norths), max(norths)


def _sample_elevation(
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


def compute_volumes_dem(
    dem_path: str | Path,
    center_lon: float,
    center_lat: float,
    local_vertices: list[tuple[float, float]],
    *,
    reference_elevation_m: float,
    height_m: float,
    cell_size_m: float = 1.0,
) -> tuple[float, float, float, list[str]]:
    """Return fill_m3, cut_m3, footprint_area_m2, warnings.

    Cut: excavation where terrain exceeds pad bottom (reference_elevation_m).
    Fill is not derived from DEM (always 0 here); pad fill = footprint × height
    is computed in compute.py — imported sand is independent of cut.
    """
    from pad_earthwork.gdal_proj import configure_rasterio_proj

    configure_rasterio_proj()
    import rasterio

    warnings: list[str] = []
    if len(local_vertices) < 3:
        raise ValueError("local_vertices must have at least 3 points")

    min_e, max_e, min_n, max_n = _footprint_bounds(local_vertices)
    cell = max(0.5, float(cell_size_m))
    cols = max(1, int(math.ceil((max_e - min_e) / cell)))
    rows = max(1, int(math.ceil((max_n - min_n) / cell)))
    cell_area = cell * cell
    bottom_elev = reference_elevation_m

    fill_m3 = 0.0
    cut_m3 = 0.0
    footprint_cells = 0
    skipped_nodata = 0
    terrain_samples: list[float] = []

    with rasterio.open(dem_path) as dataset:
        nodata = dataset.nodata
        if nodata is not None:
            try:
                nodata = float(nodata)
            except (TypeError, ValueError):
                nodata = None

        for row in range(rows):
            north = min_n + (row + 0.5) * cell
            for col in range(cols):
                east = min_e + (col + 0.5) * cell
                if not _point_in_polygon(east, north, local_vertices):
                    continue
                lon, lat = _local_to_lonlat(center_lon, center_lat, east, north)
                elev = _sample_elevation(dataset, lon, lat, nodata)
                if elev is None:
                    skipped_nodata += 1
                    continue
                terrain_samples.append(elev)
                footprint_cells += 1
                if elev > bottom_elev:
                    cut_m3 += (elev - bottom_elev) * cell_area

    if skipped_nodata:
        warnings.append("dem_nodata_cells_skipped")
    if terrain_samples and reference_elevation_m < min(terrain_samples) - 0.5:
        warnings.append("dem_reference_below_terrain_min")

    footprint_area = footprint_cells * cell_area
    return fill_m3, cut_m3, footprint_area, warnings
