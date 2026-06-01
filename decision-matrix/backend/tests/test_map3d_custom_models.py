"""Custom GLB map3d models API — admin upload, RBAC, assign by subtype."""

from pathlib import Path

import pytest

from tests.conftest import csrf_headers, login
from tests.factories import create_test_infra_point, create_test_layer, create_test_project

OIL_DRUM_RED_GLB = Path(
    r"C:\Users\user\Downloads\industrial storage tank asset pack\glb-1k-vertices\oil-drum-red.glb"
)

MINIMAL_GLB = b"glTF" + b"\x02\x00\x00\x00" + b"\x1c\x00\x00\x00" + b"\x00" * 12


def _admin_headers(client):
    login(client, "admin@test.ru")
    return csrf_headers(client)


def _data_manager_headers(client):
    login(client, "data@test.ru")
    return csrf_headers(client)


def test_map3d_custom_models_admin_upload_assign_by_subtype(client):
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
        json={"subtype": "node"},
        headers=headers,
    )
    assert assign.status_code == 200, assign.text
    assert assign.json()["assigned_subtypes"] == ["node"]

    obj_before = client.get(f"/api/v1/projects/{pid}/infrastructure/objects").json()
    node_obj = next(o for o in obj_before if o["id"] == point["id"])
    assert node_obj["properties"].get("render_3d_model_id") in (None, "")

    patch = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{point['id']}",
        json={"properties": {"render_3d_model_id": f"custom:{model_id}"}},
        headers=headers,
    )
    assert patch.status_code == 200, patch.text
    assigned = patch.json()
    assert assigned["properties"].get("render_3d_model_id") == f"custom:{model_id}"

    file_res = client.get(f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/file", headers=headers)
    assert file_res.status_code == 200
    assert file_res.content[:4] == b"glTF"


def test_map3d_custom_models_assign_gtes_subtype(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_gtes")
    pid = project["id"]
    headers = _admin_headers(client)
    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("tank.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    model_id = upload.json()["id"]
    assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"subtype": "gtes"},
        headers=headers,
    )
    assert assign.status_code == 200, assign.text
    assert assign.json()["assigned_subtypes"] == ["gtes"]


def test_map3d_custom_models_assign_multiple_subtypes(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_multi")
    pid = project["id"]
    headers = _admin_headers(client)
    layer = create_test_layer(client, pid, headers)
    gtes_point = create_test_infra_point(client, pid, layer["id"], headers, name="gt", subtype="gtes")
    substation = create_test_infra_point(
        client, pid, layer["id"], headers, name="sub_a", subtype="substation"
    )

    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("multi.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    model_id = upload.json()["id"]

    assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"subtypes": ["node", "gtes"]},
        headers=headers,
    )
    assert assign.status_code == 200, assign.text
    assert set(assign.json()["assigned_subtypes"]) == {"node", "gtes"}

    ok = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{gtes_point['id']}",
        json={"properties": {"render_3d_model_id": f"custom:{model_id}"}},
        headers=headers,
    )
    assert ok.status_code == 200, ok.text

    bad = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{substation['id']}",
        json={"properties": {"render_3d_model_id": f"custom:{model_id}"}},
        headers=headers,
    )
    assert bad.status_code == 400, bad.text


def test_map3d_custom_models_assign_clear_subtypes(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_clear")
    pid = project["id"]
    headers = _admin_headers(client)
    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("x.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    model_id = upload.json()["id"]
    client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"subtype": "node"},
        headers=headers,
    )
    cleared = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"subtypes": []},
        headers=headers,
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["assigned_subtypes"] == []


def test_map3d_custom_models_shared_subtype_two_models(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_shared")
    pid = project["id"]
    headers = _admin_headers(client)
    layer = create_test_layer(client, pid, headers)
    point = create_test_infra_point(client, pid, layer["id"], headers, name="n1", subtype="node")

    up1 = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("a.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    up2 = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("b.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    id1, id2 = up1.json()["id"], up2.json()["id"]
    client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{id1}/assign",
        json={"subtypes": ["node"]},
        headers=headers,
    )
    client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{id2}/assign",
        json={"subtypes": ["node"]},
        headers=headers,
    )

    for mid in (id1, id2):
        patch = client.patch(
            f"/api/v1/projects/{pid}/infrastructure/objects/{point['id']}",
            json={"properties": {"render_3d_model_id": f"custom:{mid}"}},
            headers=headers,
        )
        assert patch.status_code == 200, patch.text


def test_map3d_custom_models_assign_legacy_object_id(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_legacy_assign")
    pid = project["id"]
    headers = _admin_headers(client)
    layer = create_test_layer(client, pid, headers)
    point = create_test_infra_point(client, pid, layer["id"], headers, name="gt", subtype="gtes")
    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("legacy.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    model_id = upload.json()["id"]
    assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"object_id": point["id"]},
        headers=headers,
    )
    assert assign.status_code == 200, assign.text
    assert assign.json()["assigned_subtypes"] == ["gtes"]


def test_map3d_custom_models_patch_rejects_wrong_subtype(client):
    project, _ = create_test_project(client, email="admin@test.ru", name="test_map3d_subtype_mismatch")
    pid = project["id"]
    headers = _admin_headers(client)
    layer = create_test_layer(client, pid, headers)
    substation = create_test_infra_point(
        client, pid, layer["id"], headers, name="sub_a", subtype="substation"
    )

    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("x.glb", MINIMAL_GLB, "model/gltf-binary")},
        headers=headers,
    )
    model_id = upload.json()["id"]
    client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"subtype": "node"},
        headers=headers,
    )

    bad = client.patch(
        f"/api/v1/projects/{pid}/infrastructure/objects/{substation['id']}",
        json={"properties": {"render_3d_model_id": f"custom:{model_id}"}},
        headers=headers,
    )
    assert bad.status_code == 400, bad.text


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

    assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"subtype": "node"},
        headers=owner_csrf,
    )
    assert assign.status_code == 200, assign.text
    assert assign.json()["assigned_subtypes"] == ["node"]


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
    denied_assign = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model_id}/assign",
        json={"subtype": "node"},
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


@pytest.mark.skipif(not OIL_DRUM_RED_GLB.is_file(), reason="local export GLB not present")
def test_upload_oil_drum_red_glb_fixture(client):
    """Regression: ~6.5 MB decimated tank must pass API validation (under 20 MB, glTF header)."""
    project, _ = create_test_project(client, email="admin@test.ru", name="test_oil_drum_glb")
    pid = project["id"]
    headers = _admin_headers(client)
    raw = OIL_DRUM_RED_GLB.read_bytes()
    assert raw[:4] == b"glTF"
    assert len(raw) < 20 * 1024 * 1024

    upload = client.post(
        f"/api/v1/projects/{pid}/map3d-custom-models",
        files={"file": ("oil-drum-red.glb", raw, "model/gltf-binary")},
        headers=headers,
    )
    assert upload.status_code == 201, upload.text
    model = upload.json()
    assert model["filename"] == "oil-drum-red.glb"

    file_res = client.get(
        f"/api/v1/projects/{pid}/map3d-custom-models/{model['id']}/file",
        headers=headers,
    )
    assert file_res.status_code == 200
    assert file_res.content[:4] == b"glTF"
    assert len(file_res.content) == len(raw)
