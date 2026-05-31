"""Smoke tests for map-related API endpoints."""

from tests.conftest import csrf_headers, login


def test_health_reports_database(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] in ("ok", "degraded")
    assert "database" in body


def test_projects_list_requires_auth(client):
    res = client.get("/api/v1/projects")
    assert res.status_code == 401


def test_analyst_can_list_projects(client):
    login(client, "analyst@test.ru")
    res = client.get("/api/v1/projects")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_viewer_cannot_create_project(client):
    login(client, "viewer@test.ru")
    res = client.post(
        "/api/v1/projects",
        headers=csrf_headers(client),
        json={"name": "Smoke", "description": "test"},
    )
    assert res.status_code == 403
