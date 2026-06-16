"""Tests for DEM cut volume (independent from pad fill)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from pad_earthwork.dem_volume import compute_volumes_dem

pytest.importorskip("rasterio")


def _write_geotiff(path: Path, west: float, south: float, east: float, north: float, elevation: float) -> None:
    width, height = 20, 20
    data = np.full((height, width), elevation, dtype=np.float32)
    transform = from_bounds(west, south, east, north, width, height)
    profile = {
        "driver": "GTiff",
        "dtype": "float32",
        "width": width,
        "height": height,
        "count": 1,
        "crs": "+proj=longlat +datum=WGS84 +no_defs",
        "transform": transform,
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(data, 1)


def test_compute_volumes_dem_cut_when_terrain_above_reference(tmp_path: Path):
    dem_path = tmp_path / "dem.tif"
    _write_geotiff(dem_path, 37.61, 55.75, 37.63, 55.77, elevation=105.0)
    local = [(-5.0, -5.0), (5.0, -5.0), (5.0, 5.0), (-5.0, 5.0)]
    fill, cut, area, _warnings = compute_volumes_dem(
        dem_path,
        37.62,
        55.76,
        local,
        reference_elevation_m=100.0,
        height_m=2.0,
        cell_size_m=1.0,
    )
    assert cut > 0
    assert fill == 0.0
    assert area > 0


def test_compute_volumes_dem_no_cut_when_terrain_below_reference(tmp_path: Path):
    dem_path = tmp_path / "dem.tif"
    _write_geotiff(dem_path, 37.61, 55.75, 37.63, 55.77, elevation=98.0)
    local = [(-5.0, -5.0), (5.0, -5.0), (5.0, 5.0), (-5.0, 5.0)]
    fill, cut, area, _warnings = compute_volumes_dem(
        dem_path,
        37.62,
        55.76,
        local,
        reference_elevation_m=100.0,
        height_m=2.0,
        cell_size_m=1.0,
    )
    assert fill == 0.0
    assert cut == 0.0
    assert area > 0
