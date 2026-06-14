"""Integration tests for pad placement compute API."""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from tests.factories import create_test_infra_point, create_test_layer, create_test_project

pytest.importorskip("well_trajectory")


@pytest.fixture(autouse=True)
def _install_well_trajectory_planner():
    try:
        import well_trajectory  # noqa: F401
    except ImportError:
        pytest.skip("well-trajectory-planner not installed")


def _create_bottomhole(
    client: TestClient,
    pid: str,
    layer_id: str,
    headers: dict,
    *,
    name: str,
    subtype: str,
    lon: float,
    lat: float,
    properties: dict | None = None,
    end_lon: float | None = None,
    end_lat: float | None = None,
) -> dict:
    payload: dict = {
        "name": name,
        "subtype": subtype,
        "lon": lon,
        "lat": lat,
        "layer_id": layer_id,
        "properties": properties or {},
    }
    if end_lon is not None:
        payload["end_lon"] = end_lon
    if end_lat is not None:
        payload["end_lat"] = end_lat
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_pad_placement_request_and_compute_three_nnb(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_placement")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)

    ids = []
    for i in range(3):
        obj = _create_bottomhole(
            client,
            pid,
            layer["id"],
            headers,
            name=f"BH-{i}",
            subtype="well_bottomhole_nnb",
            lon=37.62 + i * 0.001,
            lat=55.76 + i * 0.001,
            properties={"well_bottomhole_tvd_m": 1500 + i * 10},
        )
        ids.append(obj["id"])

    req = client.post(
        f"/api/v1/projects/{pid}/pad-placement/request",
        json={"bottomhole_ids": ids, "params": {"top_k": 3}},
        headers=headers,
    )
    assert req.status_code == 200, req.text
    body = req.json()
    assert body["logical_well_count"] == 3
    assert body["sync_allowed"] is True

    comp = client.post(
        f"/api/v1/projects/{pid}/pad-placement/compute",
        json={
            "bottomhole_ids": ids,
            "params": {
                "top_k": 3,
                "min_pad_spacing_m": 50,
                "center_optimize": True,
                "center_search_radius_m": 400,
                "center_search_step_m": 200,
            },
        },
        headers=headers,
    )
    assert comp.status_code == 200, comp.text
    result = comp.json()
    assert result["logical_well_count"] == 3
    assert len(result["variants"]) >= 1
    assert result["variants"][0]["pad_count"] >= 1

    request_id = result["request_id"]
    geo = client.get(
        f"/api/v1/projects/{pid}/pad-placement/preview/{request_id}/0/geojson",
        headers=headers,
    )
    assert geo.status_code == 200, geo.text
    assert len(geo.json()["features"]) > 0


def test_pad_placement_apply_creates_pad(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_placement_apply")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)

    obj = _create_bottomhole(
        client,
        pid,
        layer["id"],
        headers,
        name="BH-solo",
        subtype="well_bottomhole_nnb",
        lon=37.62,
        lat=55.76,
        properties={"well_bottomhole_tvd_m": 1500},
    )

    comp = client.post(
        f"/api/v1/projects/{pid}/pad-placement/compute",
        json={"bottomhole_ids": [obj["id"]], "params": {"top_k": 1}},
        headers=headers,
    )
    assert comp.status_code == 200, comp.text
    result = comp.json()
    variant = result["variants"][0]
    assert variant["invalid"] is False

    apply_res = client.post(
        f"/api/v1/projects/{pid}/pad-placement/apply",
        json={
            "request_id": result["request_id"],
            "variant_index": variant["variant_index"],
        },
        headers=headers,
    )
    assert apply_res.status_code == 200, apply_res.text
    applied = apply_res.json()
    assert len(applied["created_pad_ids"]) == 1
    assert obj["id"] in applied["updated_bottomhole_ids"]


def test_pad_placement_compute_gs_unified_line_valid(client: TestClient):
    project, headers = create_test_project(client, name="test_pad_placement_gs_line")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)

    gs = _create_bottomhole(
        client,
        pid,
        layer["id"],
        headers,
        name="GS-line",
        subtype="well_bottomhole_gs",
        lon=37.621,
        lat=55.761,
        end_lon=37.631,
        end_lat=55.761,
        properties={
            "well_bottomhole_tvd_m": 2000,
            "well_bottomhole_heel_tvd_m": 1800,
            "well_bottomhole_toe_tvd_m": 2100,
        },
    )

    comp = client.post(
        f"/api/v1/projects/{pid}/pad-placement/compute",
        json={
            "bottomhole_ids": [gs["id"]],
            "params": {
                "top_k": 1,
                "min_pad_spacing_m": 50,
                "center_optimize": False,
            },
        },
        headers=headers,
    )
    assert comp.status_code == 200, comp.text
    result = comp.json()
    assert result["logical_well_count"] == 1
    variant = result["variants"][0]
    assert variant["invalid"] is False
    pad = variant["pads"][0]
    assert "не заданы координаты heel/toe" not in " ".join(pad.get("warnings", []))
    assert pad["trajectories"][0]["survey"]["source"] == "calculated"
    assert pad["trajectories"][0].get("design", {}).get("profile") == "horizontal"

    apply_res = client.post(
        f"/api/v1/projects/{pid}/pad-placement/apply",
        json={
            "request_id": result["request_id"],
            "variant_index": variant["variant_index"],
        },
        headers=headers,
    )
    assert apply_res.status_code == 200, apply_res.text
    applied = apply_res.json()
    pad_id = applied["created_pad_ids"][0]

    geo = client.get(
        f"/api/v1/projects/{pid}/well-trajectory/geojson",
        headers=headers,
    )
    assert geo.status_code == 200, geo.text
    kinds = [f["properties"]["kind"] for f in geo.json()["features"]]
    assert "trajectory_plan" in kinds
    assert any(f["properties"].get("infra_object_id") == pad_id for f in geo.json()["features"])

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{pad_id}/well-trajectory/last",
        headers=headers,
    )
    assert last.status_code == 200, last.text
    traj = last.json()["trajectories"]
    assert len(traj) >= 1
    assert traj[0]["survey"]["source"] == "calculated"
    assert traj[0].get("design", {}).get("profile") == "horizontal"
