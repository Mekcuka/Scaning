"""Tests for DEM preview grid for pad earthwork sketch overlay."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from app.services.pad_earthwork.dem_preview import build_dem_preview_for_object
from app.services.pad_earthwork.schemas import PadEarthworkComputeRequest, PadParamsIn

pytest.importorskip("rasterio")


def _make_dem_geotiff_file(path: Path, *, elevation: float = 100.0) -> None:
    west, south, east, north = 37.61, 55.75, 37.63, 55.77
    width, height = 40, 40
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
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(data, 1)


class _FakeObj:
    def __init__(self) -> None:
        self.id = uuid4()
        self.longitude = 37.62
        self.latitude = 55.76
        self.properties: dict = {}


def test_build_dem_preview_cut_zones_above_reference(tmp_path: Path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))
    dem_path = tmp_path / "pad_dem" / "proj" / "dem.tif"
    _make_dem_geotiff_file(dem_path, elevation=105.0)

    obj = _FakeObj()
    body = PadEarthworkComputeRequest(
        params=PadParamsIn(
            length_m=20,
            width_m=20,
            height_m=2,
            rotation_deg=0,
            reference_elevation_m=100,
        ),
    )

    preview = asyncio.run(
        build_dem_preview_for_object(None, uuid4(), obj, body, dem_path=dem_path)  # type: ignore[arg-type]
    )

    assert preview.design_elevation_m == pytest.approx(102.0)
    assert preview.footprint_elev_min == pytest.approx(105.0)
    assert -1 in preview.cut_fill
    assert 1 not in preview.cut_fill


def test_build_dem_preview_no_cut_at_reference(tmp_path: Path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))
    dem_path = tmp_path / "pad_dem" / "proj" / "dem.tif"
    _make_dem_geotiff_file(dem_path, elevation=100.0)

    obj = _FakeObj()
    body = PadEarthworkComputeRequest(
        params=PadParamsIn(
            length_m=20,
            width_m=20,
            height_m=2,
            rotation_deg=0,
            reference_elevation_m=100,
        ),
    )

    preview = asyncio.run(
        build_dem_preview_for_object(None, uuid4(), obj, body, dem_path=dem_path)  # type: ignore[arg-type]
    )

    assert preview.cols >= 1
    assert preview.rows >= 1
    assert len(preview.elevations) == preview.cols * preview.rows
    assert len(preview.cut_fill) == preview.cols * preview.rows
    assert preview.design_elevation_m == pytest.approx(102.0)
    assert preview.elev_min == pytest.approx(100.0)
    assert preview.elev_max == pytest.approx(100.0)
    assert preview.footprint_elev_min == pytest.approx(100.0)
    assert -1 not in preview.cut_fill
    assert 1 not in preview.cut_fill
    assert 0 in preview.cut_fill
    assert preview.bounds.max_east_m > preview.bounds.min_east_m


def test_build_dem_preview_api(client, tmp_path: Path, monkeypatch):
    from tests.test_pad_earthwork_api import _make_dem_geotiff_bytes, _seed_oil_pad

    monkeypatch.setenv("OPENTOPOGRAPHY_API_KEY", "a" * 32)
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "a" * 32)
    monkeypatch.setattr(settings, "PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))

    dem_bytes = _make_dem_geotiff_bytes(elevation=110.0)
    with patch(
        "app.services.pad_earthwork.pad_dem_repository.fetch_opentopography_dem",
        return_value=dem_bytes,
    ):
        pid, headers, oid = _seed_oil_pad(client)
        fetch = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/dem/fetch",
            json={
                "params": {
                    "length_m": 10,
                    "width_m": 10,
                    "height_m": 2,
                    "reference_elevation_m": 108,
                },
            },
            headers=headers,
        )
        assert fetch.status_code == 200, fetch.text

        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/dem/preview",
            json={
                "params": {
                    "length_m": 10,
                    "width_m": 10,
                    "height_m": 2,
                    "reference_elevation_m": 108,
                },
            },
            headers=headers,
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["design_elevation_m"] == pytest.approx(110.0)
    assert "footprint_elev_min" in data
    assert data["cols"] <= 128
    assert data["rows"] <= 128
    assert len(data["elevations"]) == data["cols"] * data["rows"]
