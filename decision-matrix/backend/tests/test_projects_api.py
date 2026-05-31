"""Project CRUD API integration tests."""

from tests.conftest import client, csrf_headers, login, register
from tests.factories import create_test_project


def test_get_project_by_id(client):
    created, _headers = create_test_project(client, name="test_get_by_id")
    pid = created["id"]

    res = client.get(f"/api/v1/projects/{pid}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == pid
    assert body["name"] == "test_get_by_id"


def test_patch_project_name(client):
    created, headers = create_test_project(client, name="test_patch_before")
    pid = created["id"]

    res = client.patch(
        f"/api/v1/projects/{pid}",
        json={"name": "test_patch_after"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "test_patch_after"


def test_delete_project_returns_204(client):
    created, headers = create_test_project(client, name="test_delete_api")
    pid = created["id"]

    res = client.delete(f"/api/v1/projects/{pid}", headers=headers)
    assert res.status_code == 204

    gone = client.get(f"/api/v1/projects/{pid}")
    assert gone.status_code == 404


def test_delete_project_not_found(client):
    login(client, "analyst@test.ru")
    headers = csrf_headers(client)
    import uuid

    res = client.delete(f"/api/v1/projects/{uuid.uuid4()}", headers=headers)
    assert res.status_code == 404


def test_viewer_cannot_delete_project(client):
    register(client, "owner-del@test.ru", "Owner Del")
    owner_headers = csrf_headers(client)
    project = client.post(
        "/api/v1/projects",
        json={"name": "test_viewer_no_delete"},
        headers=owner_headers,
    ).json()

    login(client, "viewer@test.ru")
    viewer_headers = csrf_headers(client)
    res = client.delete(
        f"/api/v1/projects/{project['id']}",
        headers=viewer_headers,
    )
    assert res.status_code == 403
