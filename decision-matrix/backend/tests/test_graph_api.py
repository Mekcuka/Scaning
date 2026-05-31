"""Infrastructure graph API smoke tests."""

from tests.factories import create_test_layer, create_test_project


def test_build_network_and_list(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_graph_api")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)

    from tests.conftest import csrf_headers

    client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        json={
            "name": "seg_a",
            "subtype": "autoroad",
            "lon": 37.6,
            "lat": 55.75,
            "end_lon": 37.62,
            "end_lat": 55.77,
            "layer_id": layer["id"],
        },
        headers=csrf_headers(client),
    )

    build = client.post(
        f"/api/v1/projects/{pid}/infrastructure/networks/build",
        headers=csrf_headers(client),
    )
    assert build.status_code == 200
    net = build.json()
    assert net["project_id"] == pid

    listed = client.get(f"/api/v1/projects/{pid}/infrastructure/networks")
    assert listed.status_code == 200
    assert len(listed.json()) >= 1
