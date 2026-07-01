"""Tests for line elevation profile compute."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from starlette.testclient import TestClient

from tests.factories import create_test_infra_point, create_test_layer, create_test_project
from tests.test_pad_earthwork_api import _make_dem_geotiff_bytes

pytest.importorskip("rasterio")


def _seed_line_project(client: TestClient) -> tuple[str, dict[str, str], str]:
    project, headers = create_test_project(client, name="test_line_profile_compute")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    create_test_infra_point(client, pid, layer["id"], headers, lon=37.62, lat=55.76)
    create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Узел-2",
        subtype="substation",
        lon=37.615,
        lat=55.755,
    )
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        json={
            "name": "Труба",
            "subtype": "gas_pipeline",
            "lon": 37.62,
            "lat": 55.76,
            "end_lon": 37.615,
            "end_lat": 55.755,
            "layer_id": layer["id"],
            "properties": {"line_elevation_profile_step_m": 50},
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return pid, headers, res.json()["id"]


def test_compute_line_elevation_profile(client: TestClient, tmp_path: Path, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.LINE_PROFILE_DEM_DATA_ROOT", str(tmp_path / "line_dem"))
    monkeypatch.setattr("app.core.config.settings.OPENTOPOGRAPHY_API_KEY", "a" * 32)
    dem_bytes = _make_dem_geotiff_bytes(elevation=130.0)

    with patch(
        "app.services.line_elevation_profile.project_dem_repository.fetch_opentopography_dem_async",
        return_value=dem_bytes,
    ):
        pid, headers, line_id = _seed_line_project(client)
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/line-elevation-profile/compute",
            json={},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["computed_count"] == 1
        assert body["points_updated_count"] == 2
        assert body["dem_fetched"] is True
        assert body["errors"] == []

        list_res = client.get(
            f"/api/v1/projects/{pid}/infrastructure/objects",
            headers=headers,
        )
        assert list_res.status_code == 200, list_res.text
        points = [o for o in list_res.json() if o.get("subtype") != "gas_pipeline"]
        assert len(points) == 2
        for pt in points:
            assert pt["properties"]["render_3d_base_m"] == pytest.approx(130.0, abs=0.5)
            assert pt["properties"]["render_3d_base_from_dem"] is True

        get_res = client.get(
            f"/api/v1/projects/{pid}/infrastructure/objects/{line_id}/line-elevation-profile",
            headers=headers,
        )
        assert get_res.status_code == 200, get_res.text
        profile = get_res.json()
        assert profile["step_m"] == 50
        assert len(profile["points"]) >= 2
        assert profile["points"][0]["elevation_m"] == pytest.approx(130.0, abs=0.5)


def test_compute_no_lines_returns_400(client: TestClient):
    project, headers = create_test_project(client, name="test_line_profile_no_lines")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    create_test_infra_point(client, pid, layer["id"], headers, lon=37.62, lat=55.76)
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/line-elevation-profile/compute",
        json={},
        headers=headers,
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "line_elevation_profile_no_lines"


def test_compute_enqueues_job_when_async_enabled(client: TestClient, monkeypatch):
    pid, headers, _line_id = _seed_line_project(client)

    monkeypatch.setattr("app.services.line_elevation_profile.api_handlers.jobs_async_enabled", lambda: True)
    created: list[dict] = []

    async def fake_create_and_schedule(db, **kwargs):
        from uuid import uuid4

        from app.models import ProjectJob
        from app.services.project_jobs import JOB_STATUS_PENDING

        job = ProjectJob(
            id=uuid4(),
            project_id=kwargs["project_id"],
            user_id=kwargs["user_id"],
            job_type=kwargs["job_type"],
            status=JOB_STATUS_PENDING,
            payload=kwargs["payload"],
        )
        created.append(kwargs)
        return job

    async def fake_commit_and_schedule(db, job):
        return None

    monkeypatch.setattr(
        "app.services.line_elevation_profile.api_handlers.create_and_schedule_job",
        fake_create_and_schedule,
    )
    monkeypatch.setattr(
        "app.services.line_elevation_profile.api_handlers.commit_and_schedule",
        fake_commit_and_schedule,
    )

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/line-elevation-profile/compute",
        json={},
        headers=headers,
    )
    assert res.status_code == 202, res.text
    body = res.json()
    assert body["job_type"] == "line_elevation_profile_compute"
    assert created[0]["job_type"] == "line_elevation_profile_compute"
    assert created[0]["payload"] == {}


def test_compute_creates_project_job_for_admin_journal(client: TestClient, tmp_path: Path, monkeypatch):
    """Sync SQLite path must persist ProjectJob so admin journal lists the compute."""
    monkeypatch.setattr("app.core.config.settings.LINE_PROFILE_DEM_DATA_ROOT", str(tmp_path / "line_dem"))
    monkeypatch.setattr("app.core.config.settings.OPENTOPOGRAPHY_API_KEY", "a" * 32)
    dem_bytes = _make_dem_geotiff_bytes(elevation=125.0)

    with patch(
        "app.services.line_elevation_profile.project_dem_repository.fetch_opentopography_dem_async",
        return_value=dem_bytes,
    ):
        pid, headers, _line_id = _seed_line_project(client)
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/line-elevation-profile/compute",
            json={},
            headers=headers,
        )
        assert res.status_code == 200, res.text

    import asyncio
    from uuid import UUID

    from app.core.database import async_session
    from app.services.admin_jobs import list_jobs_admin
    from app.services.project_jobs import JOB_STATUS_COMPLETED, JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE

    async def _assert_admin_row():
        async with async_session() as db:
            rows, total = await list_jobs_admin(
                db,
                job_type=JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE,
                project_id=UUID(pid),
            )
            assert total >= 1
            match = next(r for r in rows if r.job.job_type == JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE)
            assert match.job.status == JOB_STATUS_COMPLETED
            assert match.project_name

    asyncio.run(_assert_admin_row())
