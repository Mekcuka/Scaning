"""Well trajectory survey import (CSV / WBP)."""

from __future__ import annotations

from pathlib import Path

import pytest
from starlette.testclient import TestClient

from tests.factories import create_test_infra_point, create_test_layer, create_test_project

pytest.importorskip("well_trajectory")

FIXTURES = Path(__file__).resolve().parents[3] / "well-trajectory-planner" / "tests" / "fixtures"


@pytest.fixture(autouse=True)
def _install_well_trajectory_planner():
    try:
        import well_trajectory  # noqa: F401
    except ImportError:
        pytest.skip("well-trajectory-planner not installed")


def _seed_oil_pad(client: TestClient, *, well_count: int = 3) -> tuple[str, dict[str, str], str]:
    project, headers = create_test_project(client, name="test_well_trajectory_import")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Куст-import",
        subtype="oil_pad",
        lon=37.62,
        lat=55.76,
    )
    wells_local = [{"east_m": float(i * 9), "north_m": 0.0} for i in range(well_count)]
    res = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{obj['id']}/pad-earthwork/sketch",
        json={
            "sketch": {
                "kind": "plan_rectangle",
                "length_m": 120,
                "width_m": 80,
                "rotation_deg": 90,
            },
            "params": {"height_m": 2.0, "reference_elevation_m": 150.0},
            "wells_local": wells_local,
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    gen = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{obj['id']}/well-trajectory/generate-from-layout",
        headers=headers,
    )
    assert gen.status_code == 200, gen.text
    return pid, headers, obj["id"]


def test_import_csv_preview_three_wells(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client, well_count=3)
    csv_path = FIXTURES / "sample_survey.csv"
    with csv_path.open("rb") as handle:
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/import/preview"
            f"?format=csv",
            files={"file": ("sample_survey.csv", handle, "text/csv")},
            headers=headers,
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["well_count"] == 3
    assert len(body["wells"]) == 3
    assert body["wells"][0]["matched_index"] == 0


def test_import_csv_commit_updates_trajectories(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client, well_count=3)
    csv_path = FIXTURES / "sample_survey.csv"
    with csv_path.open("rb") as handle:
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/import/csv",
            files={"file": ("sample_survey.csv", handle, "text/csv")},
            headers=headers,
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["imported_count"] == 3
    assert body["trajectories"][0]["survey"]["source"] == "imported"

    geo = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/geojson",
        headers=headers,
    )
    assert geo.status_code == 200
    assert len(geo.json()["features"]) >= 3


def test_import_wbp_smoke(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client, well_count=1)
    wbp_path = FIXTURES / "sample.wbp"
    with wbp_path.open("rb") as handle:
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/import/wbp",
            files={"file": ("sample.wbp", handle, "application/octet-stream")},
            headers=headers,
        )
    assert res.status_code == 200, res.text
    assert res.json()["imported_count"] >= 1


def test_import_witsml_returns_501(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client, well_count=1)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/import/witsml",
        headers=headers,
    )
    assert res.status_code == 501


def test_import_csv_viewer_forbidden(client: TestClient):
    from tests.factories import csrf_headers, login

    pid, headers, oid = _seed_oil_pad(client, well_count=1)
    login(client, "viewer@test.ru")
    viewer_headers = csrf_headers(client)
    csv_path = FIXTURES / "sample_survey.csv"
    with csv_path.open("rb") as handle:
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/import/csv",
            files={"file": ("sample_survey.csv", handle, "text/csv")},
            headers=viewer_headers,
        )
    assert res.status_code == 403


def _csv_many_wells(count: int) -> bytes:
    lines = ["well_name,md,inc,azi"]
    for i in range(count):
        name = f"Скв-{i + 1}"
        lines.append(f"{name},0,0,90")
        lines.append(f"{name},500,45,90")
    return "\n".join(lines).encode("utf-8")


def test_import_csv_async_threshold(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WELL_TRAJECTORY_IMPORT_ASYNC_THRESHOLD", "20")
    from app.core.config import settings

    settings.WELL_TRAJECTORY_IMPORT_ASYNC_THRESHOLD = 20
    monkeypatch.setattr("app.api.v1.well_trajectory.jobs_async_enabled", lambda: True)

    pid, headers, oid = _seed_oil_pad(client, well_count=21)
    content = _csv_many_wells(21)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/import/csv?async=true",
        files={"file": ("many.csv", content, "text/csv")},
        headers=headers,
    )
    assert res.status_code == 202, res.text
    assert res.json()["job_type"] == "well_trajectory_import"
