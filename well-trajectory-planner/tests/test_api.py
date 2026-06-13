"""HTTP API smoke tests."""

from pathlib import Path

from fastapi.testclient import TestClient

from well_trajectory.api import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_pad_generate_from_layout_endpoint():
    res = client.post(
        "/v1/pad/generate-from-layout",
        json={
            "wells_local": [{"east_m": 0, "north_m": 0}, {"east_m": 9, "north_m": 0}],
            "kb_m": 151.0,
            "rotation_deg": 90,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["wells"]) == 2
    assert body["wells"][0]["geometry"]["length_m"] > 0


def test_design_connector_endpoint():
    res = client.post(
        "/v1/design/connector",
        json={
            "start": {"northing": 0, "easting": 0, "tvd": 0, "inc": 0, "azi": 90},
            "end": {"northing": 500, "easting": 800, "tvd": 2500, "inc": 90, "azi": 270},
            "step_m": 50,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["stations"]) >= 2
    assert "geometry" in body


def test_import_csv_endpoint():
    content = (Path(__file__).resolve().parent / "fixtures" / "sample_survey.csv").read_text(
        encoding="utf-8"
    )
    res = client.post("/v1/import/csv", json={"content": content})
    assert res.status_code == 200
    body = res.json()
    assert len(body["wells"]) == 3


def test_import_witsml_returns_501():
    res = client.post("/v1/import/witsml")
    assert res.status_code == 501
