"""Well trajectory BFF for oil_pad / gas_pad."""

from __future__ import annotations

from unittest.mock import patch

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


def _seed_oil_pad(client: TestClient) -> tuple[str, dict[str, str], str]:
    project, headers = create_test_project(client, name="test_well_trajectory")
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


def _save_wells_local(
    client: TestClient,
    pid: str,
    oid: str,
    headers: dict[str, str],
    well_count: int = 12,
) -> None:
    wells_local = [{"east_m": float(i * 9), "north_m": 0.0} for i in range(well_count)]
    res = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/sketch",
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


def test_generate_from_layout_twelve_wells(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=12)

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["trajectories"]) == 12
    for i, traj in enumerate(body["trajectories"]):
        assert traj["well_index"] == i
        assert traj["survey"]["stations"][0]["inc"] == 0.0
        assert traj["geometry"]["length_m"] > 0

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/last",
        headers=headers,
    )
    assert last.status_code == 200
    assert len(last.json()["trajectories"]) == 12


def test_design_updates_one_well(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=3)
    gen = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )
    assert gen.status_code == 200

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/design",
        json={
            "well_index": 1,
            "end": {
                "northing": 200,
                "easting": 400,
                "tvd": 1500,
                "inc": 90,
                "azi": 270,
            },
            "step_m": 50,
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["well_index"] == 1
    assert body["trajectory"]["design"]["profile"] == "connector"
    assert len(body["trajectory"]["survey"]["stations"]) >= 2
    assert body["trajectory"]["geometry"]["length_m"] > 100


def test_last_returns_trajectories(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=2)
    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )

    res = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/last",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["trajectories"]) == 2
    assert len(body["wells_local"]) == 2
    assert body["settings"]["default_error_model"] == "ISCWSA MWD Rev5.11"


def test_compute_sets_computed_at(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=2)
    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/compute",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["computed_at"]
    assert len(body["trajectories"]) == 2


def test_planner_unavailable_returns_503(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=2)

    with patch(
        "app.services.well_trajectory.service.planner_schemas",
        side_effect=RuntimeError("missing"),
    ):
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
            headers=headers,
        )
    assert res.status_code == 503
    assert res.json()["detail"] == "missing"


def test_rejects_non_pad_subtype(client: TestClient):
    project, headers = create_test_project(client, name="test_well_trajectory_node")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Узел",
        subtype="node",
        lon=37.62,
        lat=55.76,
    )
    oid = obj["id"]
    res = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/last",
        headers=headers,
    )
    assert res.status_code == 400


def test_patch_targets_and_geojson(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=2)
    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )

    patch = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/targets",
        json={
            "targets": [
                {
                    "well_index": 0,
                    "target": {
                        "source": "manual_map",
                        "lon": 37.63,
                        "lat": 55.77,
                        "tvd_m": 1500,
                    },
                },
                {
                    "well_index": 1,
                    "target": {
                        "source": "manual_map",
                        "lon": 37.631,
                        "lat": 55.771,
                        "tvd_m": 1500,
                    },
                },
            ]
        },
        headers=headers,
    )
    assert patch.status_code == 200, patch.text
    traj = patch.json()["trajectories"][0]
    assert traj["target"]["plan"]["east_m"] != 0 or traj["target"]["plan"]["north_m"] != 0
    assert traj["target"]["lon"] == 37.63

    geo = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/geojson",
        headers=headers,
    )
    assert geo.status_code == 200
    kinds = {f["properties"]["kind"] for f in geo.json()["features"]}
    assert "trajectory_plan" in kinds
    assert "bottomhole_target" in kinds

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/last",
        headers=headers,
    )
    assert last.status_code == 200
    assert isinstance(last.json()["warnings"], list)


def test_design_all_from_targets(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=2)
    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )
    client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/targets",
        json={
            "targets": [
                {
                    "well_index": 0,
                    "target": {"lon": 37.63, "lat": 55.77, "tvd_m": 1200, "inc": 90, "azi": 270},
                },
                {
                    "well_index": 1,
                    "target": {"lon": 37.631, "lat": 55.771, "tvd_m": 1200},
                },
            ]
        },
        headers=headers,
    )

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/design-all",
        json={"step_m": 50},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["designed"] == [0, 1]
    assert body["skipped"] == []
    assert body["trajectories"][0]["design"]["profile"] == "connector"
    assert len(body["trajectories"][0]["survey"]["stations"]) >= 2


def test_project_geojson(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _save_wells_local(client, pid, oid, headers, well_count=1)
    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )
    res = client.get(f"/api/v1/projects/{pid}/well-trajectory/geojson", headers=headers)
    assert res.status_code == 200
    assert len(res.json()["features"]) >= 1


def _design_all_wells(client: TestClient, pid: str, oid: str, headers: dict[str, str], count: int):
    _save_wells_local(client, pid, oid, headers, well_count=count)
    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/generate-from-layout",
        headers=headers,
    )
    targets = [
        {
            "well_index": i,
            "target": {"lon": 37.63 + i * 0.001, "lat": 55.77 + i * 0.001, "tvd_m": 1500},
        }
        for i in range(count)
    ]
    client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/targets",
        json={"targets": targets},
        headers=headers,
    )
    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/design-all",
        json={"step_m": 50},
        headers=headers,
    )


def test_pad_clearance_two_wells_sync(client: TestClient):
    pid, headers, oid = _seed_oil_pad(client)
    _design_all_wells(client, pid, oid, headers, count=2)

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/clearance",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["wells_count"] == 2
    assert body["pairs_count"] == 1
    assert len(body["pairs"]) == 1
    assert body["pairs"][0]["min_sf"] > 0

    last = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/well-trajectory/last",
        headers=headers,
    )
    assert last.status_code == 200
    last_body = last.json()
    assert last_body["clearance_computed_at"]
    assert len(last_body["clearance_pairs"]) == 1
    assert last_body["trajectories"][0]["clearance"]["min_sf"] > 0


def test_project_clearance_enqueues_job_when_many_wells(client: TestClient, monkeypatch):
    pid, headers, oid = _seed_oil_pad(client)
    _design_all_wells(client, pid, oid, headers, count=13)

    monkeypatch.setattr("app.api.v1.well_trajectory.jobs_async_enabled", lambda: True)
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

    monkeypatch.setattr("app.api.v1.well_trajectory.create_and_schedule_job", fake_create_and_schedule)
    monkeypatch.setattr("app.api.v1.well_trajectory.commit_and_schedule", fake_commit_and_schedule)

    res = client.post(
        f"/api/v1/projects/{pid}/well-trajectory/clearance",
        headers=headers,
    )
    assert res.status_code == 202, res.text
    body = res.json()
    assert body["job_type"] == "well_trajectory_compute"
    assert created[0]["job_type"] == "well_trajectory_compute"

