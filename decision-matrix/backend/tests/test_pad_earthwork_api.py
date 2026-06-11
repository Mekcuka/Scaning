"""Pad earthwork BFF for oil_pad / gas_pad."""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from tests.factories import create_test_infra_point, create_test_layer, create_test_project


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


def test_compute_rejects_non_pad(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_reject")
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


def test_dem_mode_returns_501(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/compute",
        json={
            "params": {
                "length_m": 10,
                "width_m": 10,
                "height_m": 1,
                "reference_elevation_m": 0,
            },
            "terrain": {"mode": "dem"},
        },
        headers=headers,
    )
    assert res.status_code == 501


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
    save_res = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/sketch",
        json={
            "sketch": polygon_sketch,
            "params": {"height_m": 2.5, "reference_elevation_m": 150},
            "envelope": {"enabled": True, "wrap_width_m": 3},
        },
        headers=headers,
    )
    assert save_res.status_code == 200, save_res.text
    props = save_res.json()["properties"]
    assert props["pad_earthwork_sketch_json"]["kind"] == "plan_polygon"
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
    assert last_body["envelope"]["enabled"] is True
    assert last_body["envelope"]["wrap_width_m"] == 3
    assert last_body["sketch_saved_at"] is not None
    assert last_body["result"]["volumes"]["fill_m3"] == fill_before
