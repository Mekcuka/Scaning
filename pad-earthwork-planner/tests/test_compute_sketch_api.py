from fastapi.testclient import TestClient

from pad_earthwork.api import app

client = TestClient(app)

BASE = {
    "object_id": "00000000-0000-0000-0000-000000000001",
    "subtype": "oil_pad",
    "center": {"lon": 37.62, "lat": 55.76},
    "terrain": {"mode": "flat"},
}


def test_compute_with_plan_sketch():
    body = {
        **BASE,
        "sketch": {"kind": "plan_rectangle", "length_m": 100, "width_m": 50, "rotation_deg": 0},
        "params": {"height_m": 2, "reference_elevation_m": 150},
    }
    res = client.post("/v1/compute", json=body)
    assert res.status_code == 200, res.text
    assert res.json()["volumes"]["fill_m3"] == 10000.0


def test_sketch_preview():
    res = client.post(
        "/v1/sketch/preview",
        json={"sketch": {"kind": "plan_rectangle", "length_m": 40, "width_m": 20, "rotation_deg": 0}},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["footprint_area_m2"] == 800.0
    assert len(body["footprint_corners_local"]) == 4


def test_compute_with_plan_polygon():
    body = {
        **BASE,
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
    }
    res = client.post("/v1/compute", json=body)
    assert res.status_code == 200, res.text
    assert res.json()["volumes"]["fill_m3"] == 400.0
    assert len(res.json()["footprint_corners"]) == 4


def test_compute_with_envelope():
    body = {
        **BASE,
        "sketch": {
            "kind": "plan_rectangle",
            "length_m": 10,
            "width_m": 10,
            "rotation_deg": 0,
        },
        "params": {"height_m": 2, "reference_elevation_m": 150},
        "envelope": {"enabled": True, "wrap_width_m": 2},
    }
    res = client.post("/v1/compute", json=body)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["volumes"]["fill_m3"] > 200.0
    assert "envelope_volume_is_truncated_pyramid_approximation" in data["warnings"]


def test_sketch_preview_polygon():
    res = client.post(
        "/v1/sketch/preview",
        json={
            "sketch": {
                "kind": "plan_polygon",
                "vertices": [
                    {"east_m": 0, "north_m": 0},
                    {"east_m": 10, "north_m": 0},
                    {"east_m": 0, "north_m": 10},
                ],
            }
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["footprint_area_m2"] == 50.0
    assert len(body["footprint_corners_local"]) == 3


def test_profile_sketch_returns_501():
    res = client.post(
        "/v1/sketch/preview",
        json={
            "sketch": {
                "kind": "profile",
                "width_m": 10,
                "design_elevation_m": 100,
                "chainage_points": [{"chainage_m": 0, "elevation_m": 98}],
            }
        },
    )
    assert res.status_code == 501
