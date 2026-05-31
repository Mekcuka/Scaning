"""HTTP helpers to create test data (prefix test_* for isolation)."""

from __future__ import annotations

from starlette.testclient import TestClient

from tests.conftest import csrf_headers, login


def auth_headers(client: TestClient, email: str = "analyst@test.ru") -> dict[str, str]:
    login(client, email)
    return csrf_headers(client)


def create_test_project(
    client: TestClient,
    *,
    email: str = "analyst@test.ru",
    name: str = "test_project",
    description: str | None = "automated test",
) -> tuple[dict, dict[str, str]]:
    headers = auth_headers(client, email)
    res = client.post(
        "/api/v1/projects",
        json={"name": name, "description": description},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json(), csrf_headers(client)


def create_test_layer(
    client: TestClient,
    project_id: str,
    headers: dict[str, str] | None = None,
    *,
    name: str = "test_layer",
) -> dict:
    hdrs = headers or csrf_headers(client)
    res = client.post(
        f"/api/v1/projects/{project_id}/infrastructure/layers",
        json={"name": name, "layer_type": "vector", "source_type": "manual"},
        headers=hdrs,
    )
    assert res.status_code == 201, res.text
    return res.json()


def create_test_infra_point(
    client: TestClient,
    project_id: str,
    layer_id: str,
    headers: dict[str, str] | None = None,
    *,
    name: str = "test_point",
    subtype: str = "gas_processing",
    lon: float = 37.6,
    lat: float = 55.75,
) -> dict:
    hdrs = csrf_headers(client)
    res = client.post(
        f"/api/v1/projects/{project_id}/infrastructure/objects",
        json={
            "name": name,
            "subtype": subtype,
            "lon": lon,
            "lat": lat,
            "layer_id": layer_id,
        },
        headers=hdrs,
    )
    assert res.status_code == 201, res.text
    return res.json()


def create_test_poi(
    client: TestClient,
    project_id: str,
    headers: dict[str, str] | None = None,
    *,
    name: str = "test_poi",
    lon: float = 37.61,
    lat: float = 55.751,
) -> dict:
    hdrs = csrf_headers(client)
    res = client.post(
        f"/api/v1/projects/{project_id}/pois",
        json={
            "name": name,
            "lon": lon,
            "lat": lat,
            "planned_production_volume": 100,
            "production_per_well": 10,
            "wells_per_pad": 4,
            "fluid_type": "oil",
        },
        headers=hdrs,
    )
    assert res.status_code == 201, res.text
    return res.json()
