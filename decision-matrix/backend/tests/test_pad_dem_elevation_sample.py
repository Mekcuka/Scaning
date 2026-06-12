"""Tests for DEM reference elevation sampling."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from rasterio.io import MemoryFile

from app.services.pad_earthwork.dem_elevation_sample import infer_reference_elevation_from_dem

pytest.importorskip("rasterio")


def _write_flat_dem(path: Path, *, elevation: float = 112.5) -> None:
    west, south, east, north = 37.61, 55.75, 37.63, 55.77
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
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", **profile) as dataset:
        dataset.write(data, 1)


def test_infer_reference_elevation_from_dem_median(tmp_path: Path):
    dem_path = tmp_path / "dem.tif"
    _write_flat_dem(dem_path, elevation=112.5)
    corners = [(37.619, 55.759), (37.621, 55.759), (37.621, 55.761), (37.619, 55.761)]
    ref = infer_reference_elevation_from_dem(dem_path, 37.62, 55.76, corners)
    assert ref == 112.5
