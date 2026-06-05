"""GeoSteiner API endpoints."""

from uuid import uuid4

from fastapi.testclient import TestClient

from network_planner.api.app import app

client = TestClient(app)


def _sample_request() -> dict:
    start = uuid4()
    end = uuid4()
    return {
        "project_id": str(uuid4()),
        "terminals": [
            {
                "id": str(start),
                "type": "oil_pad",
                "role": "start",
                "lon": 37.60,
                "lat": 55.75,
            },
            {
                "id": str(uuid4()),
                "type": "oil_pad",
                "role": "intermediate",
                "lon": 37.62,
                "lat": 55.76,
            },
            {
                "id": str(end),
                "type": "gas_processing",
                "role": "end",
                "lon": 37.64,
                "lat": 55.74,
            },
        ],
        "options": {"max_points": 50},
    }


def test_geosteiner_status():
    r = client.get("/v1/geosteiner/status")
    assert r.status_code == 200
    data = r.json()
    assert "available" in data
    assert data["homepage"] == "https://geosteiner.net/"


def test_plan_geosteiner_unavailable_returns_503():
    r = client.post("/v1/plan/geosteiner", json=_sample_request())
    if r.status_code == 200:
        data = r.json()
        assert data["solver"] == "geosteiner"
        assert "solver:geosteiner" in data["warnings"]
    else:
        assert r.status_code == 503
