"""Flow schematic HTTP API smoke tests."""

from tests.factories import create_test_poi, create_test_project


def test_flow_schematic_get_put_delete(client):
    project, headers = create_test_project(client, name="test_flow_api")
    pid = project["id"]
    poi = create_test_poi(client, pid, headers)
    poi_id = poi["id"]

    get_empty = client.get(
        f"/api/v1/projects/{pid}/pois/{poi_id}/flow-schematic",
    )
    assert get_empty.status_code == 200
    body = get_empty.json()
    assert body["poi_id"] == poi_id
    assert isinstance(body.get("nodes"), list)

    from tests.conftest import csrf_headers

    save = client.put(
        f"/api/v1/projects/{pid}/pois/{poi_id}/flow-schematic",
        json={
            "nodes": [{"id": "n1", "kind": "poi", "label": "POI"}],
            "edges": [],
        },
        headers=csrf_headers(client),
    )
    assert save.status_code == 200

    get_saved = client.get(f"/api/v1/projects/{pid}/pois/{poi_id}/flow-schematic")
    assert get_saved.status_code == 200
    assert get_saved.json()["source"] in ("layout", "auto", "merged")

    reset = client.delete(
        f"/api/v1/projects/{pid}/pois/{poi_id}/flow-schematic",
        headers=csrf_headers(client),
    )
    assert reset.status_code == 200


def test_economic_flow_schematic_get(client):
    project, headers = create_test_project(client, name="test_economic_flow")
    pid = project["id"]
    poi = create_test_poi(client, pid, headers)

    res = client.get(f"/api/v1/projects/{pid}/pois/{poi['id']}/economic-flow-schematic")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
