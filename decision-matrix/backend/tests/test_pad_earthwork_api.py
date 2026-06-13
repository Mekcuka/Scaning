"""Pad earthwork BFF for oil_pad / gas_pad."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from starlette.testclient import TestClient

from tests.factories import create_test_infra_point, create_test_layer, create_test_project

pytest.importorskip("rasterio")


@pytest.fixture(autouse=True)
def _install_pad_planner():
  try:
    import pad_earthwork  # noqa: F401
  except ImportError:
    pytest.skip("pad-earthwork-planner not installed")


def _seed_oil_pad(client: TestClient) -> tuple[str, dict[str, str], str]:
    project, headers = create_test_project(client, name="test_pad_earthwork")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Куст-1",
        subtype="oil_pad",
        lon=37.62,
        lat=55.76,
    )
    return pid, headers, obj["id"]


def _make_dem_geotiff_bytes(*, elevation: float = 105.0) -> bytes:
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
    from rasterio.io import MemoryFile

    with MemoryFile() as memfile:
        with memfile.open(**profile) as dst:
            dst.write(data, 1)
        return memfile.read()


def test_dem_mode_returns_503_without_api_key(client: TestClient, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "")
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
        json={
            "params": {
                "length_m": 10,
                "width_m": 10,
                "height_m": 2,
                "reference_elevation_m": 100,
            },
            "terrain": {"mode": "dem"},
        },
        headers=headers,
    )
    assert res.status_code == 503


def test_dem_compute_with_mock_opentopography(client: TestClient, tmp_path: Path, monkeypatch):
    monkeypatch.setenv("OPENTOPOGRAPHY_API_KEY", "test-key")
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "test-key")
    monkeypatch.setattr(settings, "PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))

    dem_bytes = _make_dem_geotiff_bytes(elevation=105.0)

    with patch(
        "app.services.pad_earthwork.pad_dem_repository.fetch_opentopography_dem",
        return_value=dem_bytes,
    ):
        pid, headers, oid = _seed_oil_pad(client)
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
            json={
                "params": {
                    "length_m": 10,
                    "width_m": 10,
                    "height_m": 2,
                    "reference_elevation_m": 100,
                },
                "terrain": {"mode": "dem"},
            },
            headers=headers,
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["volumes"]["cut_m3"] > 0
    assert data["volumes"]["fill_m3"] == pytest.approx(200.0)
    assert data["volumes"]["net_fill_m3"] == pytest.approx(200.0)

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/last",
        headers=headers,
    )
    assert last.status_code == 200
    assert last.json().get("dem", {}).get("asset_id")


def test_dem_compute_rotated_large_pad_expanded_bbox(client: TestClient, tmp_path: Path, monkeypatch):
    """Regression: NDS 90° narrows lon/lat bbox — must expand before OpenTopography fetch."""
    test_key = "a" * 32
    monkeypatch.setenv("OPENTOPOGRAPHY_API_KEY", test_key)
    from app.core.config import settings
    from app.services.pad_earthwork.dem_store import _meters_per_degree

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", test_key)
    monkeypatch.setattr(settings, "PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))

    dem_bytes = _make_dem_geotiff_bytes(elevation=150.0)
    captured: dict[str, tuple[float, float, float, float]] = {}

    def _capture_fetch(bbox, **kwargs):
        captured["bbox"] = bbox
        return dem_bytes

    with patch(
        "app.services.pad_earthwork.pad_dem_repository.fetch_opentopography_dem",
        side_effect=_capture_fetch,
    ):
        pid, headers, oid = _seed_oil_pad(client)
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
            json={
                "params": {
                    "length_m": 196,
                    "width_m": 58,
                    "height_m": 2.5,
                    "rotation_deg": 90,
                    "reference_elevation_m": 150,
                },
                "terrain": {"mode": "dem"},
            },
            headers=headers,
        )
    assert res.status_code == 200, res.text
    bbox = captured["bbox"]
    west, south, east, north = bbox
    center_lat = (south + north) / 2
    m_lon, m_lat = _meters_per_degree(center_lat)
    assert (east - west) * m_lon >= 300.0
    assert (north - south) * m_lat >= 300.0
    data = res.json()
    assert data["volumes"]["fill_m3"] >= 0
    assert data["volumes"]["cut_m3"] >= 0


def test_dem_fetch_endpoint(client: TestClient, tmp_path: Path, monkeypatch):
    monkeypatch.setenv("OPENTOPOGRAPHY_API_KEY", "test-key")
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "test-key")
    monkeypatch.setattr(settings, "PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))

    dem_bytes = _make_dem_geotiff_bytes()

    with patch(
        "app.services.pad_earthwork.pad_dem_repository.fetch_opentopography_dem",
        return_value=dem_bytes,
    ):
        pid, headers, oid = _seed_oil_pad(client)
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/dem/fetch",
            json={
                "params": {
                    "length_m": 10,
                    "width_m": 10,
                    "height_m": 2,
                    "reference_elevation_m": 100,
                },
            },
            headers=headers,
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["dem_asset_id"]
    assert body["source"].startswith("opentopography:")
    assert body["reference_elevation_m"] == 105.0

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/last",
        headers=headers,
    )
    assert last.status_code == 200
    assert last.json()["params"]["reference_elevation_m"] == 105.0


def test_compute_flat_volumes(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
        json={
            "params": {
                "length_m": 120,
                "width_m": 80,
                "height_m": 2.5,
                "rotation_deg": 0,
                "reference_elevation_m": 150,
            },
            "terrain": {"mode": "flat"},
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["volumes"]["fill_m3"] == 24000.0
    assert body["volumes"]["cut_m3"] == 0.0

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/last",
        headers=headers,
    )
    assert last.status_code == 200
    assert last.json()["result"]["volumes"]["fill_m3"] == 24000.0


def test_compute_rejects_node(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_reject_node")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(client, pid, layer["id"], headers, subtype="node")
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{obj['id']}/pad-earthwork/compute",
        json={
            "params": {
                "length_m": 10,
                "width_m": 10,
                "height_m": 1,
                "reference_elevation_m": 0,
            }
        },
        headers=headers,
    )
    assert res.status_code == 400


def test_compute_accepts_sand_quarry(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_sand_quarry")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(client, pid, layer["id"], headers, subtype="sand_quarry")
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{obj['id']}/pad-earthwork/compute",
        json={
            "params": {
                "length_m": 10,
                "width_m": 10,
                "height_m": 1,
                "reference_elevation_m": 0,
            }
        },
        headers=headers,
    )
    assert res.status_code == 200


def test_compute_accepts_facility_point(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_substation")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="ПС-1",
        subtype="substation",
        lon=37.62,
        lat=55.76,
    )
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{obj['id']}/pad-earthwork/compute",
        json={
            "params": {
                "length_m": 10,
                "width_m": 10,
                "height_m": 1,
                "reference_elevation_m": 0,
            }
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["volumes"]["fill_m3"] == 100.0
    assert body["volumes"]["cut_m3"] == 0.0


def test_sketch_generate_rejects_non_pad(client: TestClient):
    project, headers = create_test_project(client, name="test_generate_reject")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        subtype="substation",
        lon=37.62,
        lat=55.76,
    )
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{obj['id']}/pad-earthwork/sketch/generate",
        json={},
        headers=headers,
    )
    assert res.status_code == 400


def test_patch_params_without_recompute(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/params",
        json={"length_m": 100, "width_m": 50, "height_m": 2},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    props = res.json()["properties"]
    assert props["pad_length_m"] == 100
    assert props.get("pad_fill_volume_m3") is None


def test_compute_with_plan_sketch(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
        json={
            "sketch": {
                "kind": "plan_rectangle",
                "length_m": 100,
                "width_m": 50,
                "rotation_deg": 0,
            },
            "params": {"height_m": 2, "reference_elevation_m": 150},
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["volumes"]["fill_m3"] == 10000.0
    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/last",
        headers=headers,
    )
    assert last.json()["sketch"]["length_m"] == 100


def test_sketch_preview(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_sketch_preview")
    pid = project["id"]
    res = client.post(
        f"/api/v1/projects/{pid}/pad-earthwork/sketch/preview",
        json={"sketch": {"kind": "plan_rectangle", "length_m": 40, "width_m": 20, "rotation_deg": 0}},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["footprint_area_m2"] == 800.0


def test_compute_with_plan_polygon(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
        json={
            "sketch": {
                "kind": "plan_polygon",
                "vertices": [
                    {"east_m": -10, "north_m": -5},
                    {"east_m": 10, "north_m": -5},
                    {"east_m": 10, "north_m": 5},
                    {"east_m": -10, "north_m": 5},
                ],
            },
            "params": {"height_m": 2, "reference_elevation_m": 150},
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["volumes"]["fill_m3"] == 400.0
    assert len(res.json()["footprint_corners"]) == 4


def test_compute_with_envelope(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
        json={
            "sketch": {
                "kind": "plan_rectangle",
                "length_m": 10,
                "width_m": 10,
                "rotation_deg": 0,
            },
            "params": {"height_m": 2, "reference_elevation_m": 150},
            "envelope": {"enabled": True, "wrap_width_m": 2},
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["volumes"]["fill_m3"] > 200.0
    assert "envelope_volume_is_truncated_pyramid_approximation" in data["warnings"]


def test_sketch_generate_defaults(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/sketch/generate",
        json={},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["sketch"]["kind"] == "plan_polygon"
    assert len(body["wells_local"]) == 12
    assert body["length_m"] == 196.0
    assert body["width_m"] == 58.0


def test_sketch_generate_from_object_properties(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}",
        json={
            "properties": {
                "pad_well_count": 4,
                "pad_wells_per_group": 4,
                "pad_well_spacing_m": 30,
                "pad_well_group_spacing_m": 10,
                "pad_layout_margin_left_m": 20,
                "pad_layout_margin_bottom_m": 15,
                "pad_layout_margin_top_m": 15,
                "pad_layout_margin_end_m": 20,
            }
        },
        headers=headers,
    )
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/sketch/generate",
        json={},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["wells_local"]) == 4
    assert body["length_m"] == 130.0
    assert body["width_m"] == 30.0


def test_sketch_generate_override_body(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/sketch/generate",
        json={
            "well_count": 2,
            "wells_per_group": 2,
            "well_spacing_m": 40,
            "group_spacing_m": 0,
            "margins": {"left_m": 10, "bottom_m": 5, "top_m": 5, "end_m": 10},
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["length_m"] == 60.0
    assert body["width_m"] == 10.0


def test_patch_sketch_saves_without_recompute(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    compute_res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
        json={
            "params": {
                "length_m": 120,
                "width_m": 80,
                "height_m": 2.5,
                "rotation_deg": 0,
                "reference_elevation_m": 150,
            },
            "terrain": {"mode": "flat"},
        },
        headers=headers,
    )
    assert compute_res.status_code == 200
    fill_before = compute_res.json()["volumes"]["fill_m3"]

    polygon_sketch = {
        "kind": "plan_polygon",
        "vertices": [
            {"east_m": -30, "north_m": -20},
            {"east_m": 30, "north_m": -20},
            {"east_m": 30, "north_m": 20},
            {"east_m": -30, "north_m": 20},
        ],
    }
    wells_local = [
        {"east_m": 0, "north_m": 0},
        {"east_m": 30, "north_m": 0},
        {"east_m": 60, "north_m": 0},
        {"east_m": 90, "north_m": 0},
    ]
    save_res = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/sketch",
        json={
            "sketch": polygon_sketch,
            "params": {"height_m": 2.5, "reference_elevation_m": 150},
            "envelope": {"enabled": True, "wrap_width_m": 3},
            "wells_local": wells_local,
        },
        headers=headers,
    )
    assert save_res.status_code == 200, save_res.text
    props = save_res.json()["properties"]
    assert props["pad_earthwork_sketch_json"]["kind"] == "plan_polygon"
    assert props["pad_wells_local_json"] == wells_local
    assert props["pad_length_m"] == 60
    assert props["pad_width_m"] == 40
    assert props["pad_envelope_enabled"] is True
    assert props["pad_envelope_wrap_width_m"] == 3
    assert props["pad_fill_volume_m3"] == fill_before
    assert props.get("pad_earthwork_sketch_saved_at")

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/last",
        headers=headers,
    )
    assert last.status_code == 200
    last_body = last.json()
    assert last_body["sketch"]["kind"] == "plan_polygon"
    assert last_body["wells_local"] == wells_local
    assert last_body["envelope"]["enabled"] is True
    assert last_body["envelope"]["wrap_width_m"] == 3
    assert last_body["sketch_saved_at"] is not None
    assert last_body["result"]["volumes"]["fill_m3"] == fill_before
