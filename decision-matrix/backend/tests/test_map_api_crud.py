"""Map infrastructure layer/object CRUD smoke tests."""

from tests.factories import (
    create_test_infra_point,
    create_test_layer,
    create_test_project,
)


def test_map_layer_and_point_object_crud(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_map_crud")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    point = create_test_infra_point(client, pid, layer["id"], headers)

    listed = client.get(f"/api/v1/projects/{pid}/infrastructure/layers")
    assert listed.status_code == 200
    assert any(row["id"] == layer["id"] for row in listed.json())

    from tests.conftest import csrf_headers

    deleted = client.delete(
        f"/api/v1/projects/{pid}/infrastructure/objects/{point['id']}",
        headers=csrf_headers(client),
    )
    assert deleted.status_code == 204


def test_map_line_object_create_and_delete(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_map_line")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    a = create_test_infra_point(
        client, pid, layer["id"], name="node_a", lon=37.6, lat=55.75, subtype="gas_processing"
    )
    b = create_test_infra_point(
        client, pid, layer["id"], name="node_b", lon=37.62, lat=55.77, subtype="gas_processing"
    )

    from tests.conftest import csrf_headers

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        json={
            "name": "test_road",
            "subtype": "autoroad",
            "lon": a["lon"],
            "lat": a["lat"],
            "end_lon": b["lon"],
            "end_lat": b["lat"],
            "layer_id": layer["id"],
        },
        headers=csrf_headers(client),
    )
    assert res.status_code == 201, res.text
    obj = res.json()

    res_del = client.delete(
        f"/api/v1/projects/{pid}/infrastructure/objects/{obj['id']}",
        headers=csrf_headers(client),
    )
    assert res_del.status_code == 204
