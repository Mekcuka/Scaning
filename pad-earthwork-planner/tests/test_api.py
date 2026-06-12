from fastapi.testclient import TestClient

from pad_earthwork.api import app

client = TestClient(app)

BASE_BODY = {
    "object_id": "00000000-0000-0000-0000-000000000001",
    "subtype": "oil_pad",
    "center": {"lon": 37.62, "lat": 55.76},
    "params": {
        "length_m": 120,
        "width_m": 80,
        "height_m": 2.5,
        "rotation_deg": 0,
        "reference_elevation_m": 150.0,
    },
    "terrain": {"mode": "flat"},
}


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_compute_flat():
    res = client.post("/v1/compute", json=BASE_BODY)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["volumes"]["fill_m3"] == 24000.0
    assert body["volumes"]["cut_m3"] == 0.0
    assert body["design"]["top_elevation_m"] == 152.5
    assert body["design"]["footprint_area_m2"] == 9600.0
    assert len(body["footprint_corners"]) == 4
    assert body["mesh"]["format"] == "glb"
    assert body["mesh"]["base64"]


def test_compute_dem_returns_501_without_file_path():
    body = {**BASE_BODY, "terrain": {"mode": "dem", "dem_asset_id": "missing"}}
    res = client.post("/v1/compute", json=body)
    assert res.status_code == 501
