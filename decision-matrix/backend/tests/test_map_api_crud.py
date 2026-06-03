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


def test_list_infra_bbox_includes_line_crossing_viewport(client):
    """Line intersecting bbox must be listed even when start vertex is outside bbox."""
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_bbox_line")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    a = create_test_infra_point(
        client, pid, layer["id"], name="west", lon=37.50, lat=55.75, subtype="gas_processing"
    )
    b = create_test_infra_point(
        client, pid, layer["id"], name="east", lon=37.70, lat=55.75, subtype="gas_processing"
    )

    from tests.conftest import csrf_headers

    line_res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        json={
            "name": "crossing_road",
            "subtype": "autoroad",
            "lon": a["lon"],
            "lat": a["lat"],
            "end_lon": b["lon"],
            "end_lat": b["lat"],
            "layer_id": layer["id"],
        },
        headers=csrf_headers(client),
    )
    assert line_res.status_code == 201, line_res.text
    line = line_res.json()

    # Viewport in the middle: line passes through; start (37.5) is outside.
    bbox = "37.58,55.74,37.62,55.76"
    listed = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        params={"bbox": bbox, "visible_layers_only": "false"},
    )
    assert listed.status_code == 200
    ids = {row["id"] for row in listed.json()}
    assert line["id"] in ids

    # Narrow bbox west of line start — line must not appear.
    west_only = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        params={"bbox": "37.40,55.74,37.48,55.76", "visible_layers_only": "false"},
    )
    assert west_only.status_code == 200
    assert line["id"] not in {row["id"] for row in west_only.json()}
