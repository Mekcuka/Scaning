"""SteinerPy API endpoints."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from network_planner.api.app import app
from network_planner.steiner.steinerpy import is_steinerpy_available

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


def test_steinerpy_status():
    r = client.get("/v1/steinerpy/status")
    assert r.status_code == 200
    data = r.json()
    assert "available" in data
    assert data["package"] == "steinerpy"
    assert data["available"] == is_steinerpy_available()


@pytest.mark.skipif(not is_steinerpy_available(), reason="steinerpy not installed")
def test_plan_steinerpy_success():
    r = client.post("/v1/plan/steinerpy", json=_sample_request())
    assert r.status_code == 200
    data = r.json()
    assert data["solver"] == "steinerpy"
    assert "solver:steinerpy" in data["warnings"]
    assert data["steiner_tree"]["length_m"] > 0


def test_plan_steinerpy_unavailable_or_success():
    r = client.post("/v1/plan/steinerpy", json=_sample_request())
    if is_steinerpy_available():
        assert r.status_code == 200
    else:
        assert r.status_code == 503
