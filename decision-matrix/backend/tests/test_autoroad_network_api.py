"""JSON pipeline API: request → compute → apply (no recompute on apply)."""

from __future__ import annotations

import copy

import pytest
from starlette.testclient import TestClient

from tests.factories import (
    create_test_infra_point,
    create_test_layer,
    create_test_project,
)

@pytest.fixture(autouse=True)
def _sync_autoroad_apply(monkeypatch):
    """Apply endpoint must run in-process for deterministic geometry checks."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "JOBS_SYNC_FALLBACK", False)
    monkeypatch.setattr(settings, "AUTOROAD_NETWORK_SOLVER", "steinerpy")
    monkeypatch.setattr(
        "app.services.job_enqueue.jobs_async_enabled",
        lambda: False,
    )


GKS_TWELVE_LAYOUT = [
    ("GKS_1", 37.142939119144025, 56.04061323280081),
    ("GKS_2", 37.209717990505276, 56.04061323280081),
    ("GKS_3", 37.16123879581562, 55.94803530058053),
    ("GKS_4", 37.22213184325423, 55.94938438681757),
    ("GKS_5", 37.28356554653648, 55.9487153552989),
    ("GKS_6", 37.35034441789771, 55.9487153552989),
    ("GKS_7", 37.1387474374583, 56.0873732793855),
    ("GKS_8", 37.199455502332164, 56.08872847268688),
    ("GKS_9", 37.34092558425556, 56.05552410800988),
    ("GKS_10", 37.407704455616795, 56.05552410800988),
    ("GKS_11", 37.41338266237315, 55.99696486312589),
    ("GKS_12", 37.47409072724702, 55.9983232116441),
]


def _seed_twelve_gks(client: TestClient) -> tuple[str, dict[str, str], list[str]]:
    project, headers = create_test_project(client, name="test_autoroad_json_pipeline")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    ids: list[str] = []
    for name, lon, lat in GKS_TWELVE_LAYOUT:
        obj = create_test_infra_point(
            client,
            pid,
            layer["id"],
            headers,
            name=name,
            lon=lon,
            lat=lat,
        )
        ids.append(obj["id"])
    return pid, headers, ids


def _pipeline(client: TestClient, pid: str, headers: dict[str, str], object_ids: list[str]):
    req_res = client.post(
        f"/api/v1/projects/{pid}/autoroad-network/request",
        json={"object_ids": object_ids, "full_network_rebuild": True},
        headers=headers,
    )
    assert req_res.status_code == 200, req_res.text
    req_body = req_res.json()
    assert len(req_body["terminals"]) == len(object_ids)

    comp_res = client.post(
        f"/api/v1/projects/{pid}/autoroad-network/compute",
        json=req_body,
        headers=headers,
    )
    assert comp_res.status_code == 200, comp_res.text
    plan = comp_res.json()
    return req_body, plan


def test_autoroad_network_request_enriched_terminal_fields(client: TestClient):
    pid, headers, ids = _seed_twelve_gks(client)
    req_res = client.post(
        f"/api/v1/projects/{pid}/autoroad-network/request",
        json={"object_ids": ids[:2], "full_network_rebuild": True},
        headers=headers,
    )
    assert req_res.status_code == 200, req_res.text
    req_body = req_res.json()
    t0 = req_body["terminals"][0]
    assert t0["name"] == "GKS_1"
    assert t0["subtype"] == "gas_processing"
    assert t0.get("subtype_label")
    assert "category" in t0
    assert len(t0["coordinates"]) == 2
    assert abs(t0["coordinates"][0] - t0["lon"]) < 1e-9
    assert abs(t0["coordinates"][1] - t0["lat"]) < 1e-9

    _, plan = _pipeline(client, pid, headers, ids[:2])
    assert plan.get("request_meta", {}).get("terminal_count") == 2
    pt = plan["terminals"][0]
    assert pt["name"] == "GKS_1"
    assert pt.get("subtype") == "gas_processing"
    assert len(pt.get("coordinates", [])) == 2


def test_autoroad_network_pipeline_twelve_gks_connected(client: TestClient):
    pid, headers, ids = _seed_twelve_gks(client)
    _, plan = _pipeline(client, pid, headers, ids)
    assert len(ids) == 12
    assert plan["new_line_count"] >= 11
    assert plan["total_new_km"] > 0

    apply_res = client.post(
        f"/api/v1/projects/{pid}/autoroad-network/apply",
        json={"object_ids": ids, "plan": plan, "full_network_rebuild": True},
        headers=headers,
    )
    assert apply_res.status_code == 200, apply_res.text
    body = apply_res.json()
    assert body["created_lines"] > 0
    assert body["created_nodes"] > 0


def test_apply_materializes_submitted_plan_not_fresh_compute(client: TestClient):
    """Apply must write the exact coordinates from the submitted plan JSON."""
    project, headers = create_test_project(client, name="test_apply_fixed_plan")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    a = create_test_infra_point(client, pid, layer["id"], headers, name="A", lon=37.10, lat=56.00)
    b = create_test_infra_point(client, pid, layer["id"], headers, name="B", lon=37.50, lat=56.00)
    ids = [a["id"], b["id"]]

    _, plan = _pipeline(client, pid, headers, ids)
    assert plan["new_lines"], "expected a greenfield plan with new lines"

    tampered = copy.deepcopy(plan)
    marker_lon: float | None = None
    for ln in tampered["new_lines"]:
        if ln.get("kind") != "link" or len(ln.get("coordinates", [])) < 2:
            continue
        mid = len(ln["coordinates"]) // 2
        marker_lon = float(ln["coordinates"][mid][0]) + 0.05
        ln["coordinates"][mid][0] = marker_lon
        break
    assert marker_lon is not None

    apply_res = client.post(
        f"/api/v1/projects/{pid}/autoroad-network/apply",
        json={"object_ids": ids, "plan": tampered, "full_network_rebuild": True},
        headers=headers,
    )
    assert apply_res.status_code == 200, apply_res.text
    created_line_ids = apply_res.json()["created_line_ids"]
    assert created_line_ids

    listed = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        headers=headers,
    ).json()
    found = False
    for oid in created_line_ids:
        line = next(o for o in listed if str(o["id"]) == oid)
        assert line["subtype"] == "autoroad"
        for c in line.get("coordinates") or []:
            if abs(float(c[0]) - marker_lon) < 1e-4:
                found = True
                break
    assert found, "applied geometry should include the tampered coordinate from plan JSON"
