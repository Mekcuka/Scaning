"""Microservice probe and middleware tests."""

import pytest
from fastapi.testclient import TestClient

from network_planner.api.app import app
from network_planner.steiner.steinerpy import is_steinerpy_available

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.skipif(not is_steinerpy_available(), reason="SteinerPy not installed")
def test_ready_returns_ok_when_steinerpy_available():
    response = client.get("/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["steinerpy"] is True
    assert "geosteiner" in body


def test_request_id_header_present():
    response = client.get("/health", headers={"X-Request-ID": "test-req-123"})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == "test-req-123"


def test_request_id_generated_when_missing():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")
