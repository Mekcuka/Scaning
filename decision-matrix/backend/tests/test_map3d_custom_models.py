"""Custom GLB map3d models API — admin upload, RBAC, assign."""

from tests.conftest import csrf_headers, login
from tests.factories import create_test_infra_point, create_test_layer, create_test_project

MINIMAL_GLB = b"glTF" + b"\x02\x00\x00\x00" + b"\x1c\x00\x00\x00" + b"\x00" * 12


def _admin_headers(client):
    login(client, "admin@test.ru")
    return csrf_headers(client)


def _data_manager_headers(client):
    login(client, "data@test.ru")
    return csrf_headers(client)


def test_map3d_custom_models_admin_upload_assign_and_file(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_custom")
    pid = project["id"]
    headers = _admin_headers(client)
    layer = create_test_layer(client, pid, headers)
    point = create_test_infra_point(client, pid, layer["id"], headers, name="node_a", subtype="node")

    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("tower.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    assert upload.status_code == 201, upload.text
    model = upload.json()
    model_id = model["id"]
    assert model["filename"] == "tower.glb"

    listed = client.get(f"/api/v1/projects/{pid}/map3d-custom-models", headers=headers)
    assert listed.status_code == 200
    assert any(m["id"] == model_id for m in listed.json())

    assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"object_id": point["id"]},
        headers=headers,
    )
    assert assign.status_code == 200, assign.text
    assert assign.json()["assigned_object_id"] == point["id"]

    obj = client.get(f"/api/v1/projects/{pid}/infrastructure/objects").json()
    assigned = next(o for o in obj if o["id"] == point["id"])
    assert assigned["properties"].get("render_3d_model_id") == f"custom:{model_id}"
    assert assigned["properties"].get("render_3d_style") == "model"

    file_res = client.get(f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/file", headers=headers)
    assert file_res.status_code == 200
    assert file_res.content[:4] == b"glTF"


def test_map3d_custom_models_owner_can_assign(client):
    project, _ = create_test_project(client, email="analyst@test.ru", name="test_map3d_owner")
    pid = project["id"]
    admin_headers = _admin_headers(client)
    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("x.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=admin_headers,
    )
    assert upload.status_code == 201
    model_id = upload.json()["id"]

    login(client, "analyst@test.ru")
    owner_csrf = csrf_headers(client)
    denied_upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("y.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=owner_csrf,
    )
    assert denied_upload.status_code == 403

    layer = create_test_layer(client, pid, owner_csrf)
    point = create_test_infra_point(client, pid, layer["id"], owner_csrf, subtype="node")
    assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"object_id": point["id"]},
        headers=owner_csrf,
    )
    assert assign.status_code == 200, assign.text

    patch = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{point['id']}",
        json={"properties": {"render_3d_model_id": f"custom:{model_id}"}},
        headers=owner_csrf,
    )
    assert patch.status_code == 200, patch.text


def test_map3d_custom_models_non_owner_cannot_assign(client):
    project, admin_headers = create_test_project(client, email="admin@test.ru", name="test_map3d_no_owner")
    pid = project["id"]
    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("z.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=admin_headers,
    )
    assert upload.status_code == 201
    model_id = upload.json()["id"]

    dm_headers = _data_manager_headers(client)
    layer = create_test_layer(client, pid, dm_headers)
    point = create_test_infra_point(client, pid, layer["id"], dm_headers, subtype="node")
    denied_assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"object_id": point["id"]},
        headers=dm_headers,
    )
    assert denied_assign.status_code == 403


def test_map3d_custom_models_read_access_list_and_file(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_read")
    pid = project["id"]
    admin_headers = _admin_headers(client)
    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("m.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=admin_headers,
    )
    model_id = upload.json()["id"]

    read_headers = _data_manager_headers(client)
    listed = client.get(f"/api/v1/projects/{pid}/map3d-custom-models", headers=read_headers)
    assert listed.status_code == 200

    file_res = client.get(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/file",
        headers=read_headers,
    )
    assert file_res.status_code == 200
