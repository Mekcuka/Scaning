"""Batch map paste API — clipboard group insert in one transaction."""

from tests.conftest import csrf_headers
from tests.factories import create_test_layer, create_test_project


def _batch_paste(client, pid, headers, payload):
    return client.post(
        f"/api/v1/projects/{pid}/map/batch-paste",
        json=payload,
        headers=headers,
    )


def test_batch_paste_points_line_with_snap_refs(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_paste")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    res = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [],
            "infra_points": [
                {
                    "client_ref": "n1",
                    "create": {
                        "name": "Узел_1",
                        "subtype": "node",
                        "lon": 37.6,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                },
                {
                    "client_ref": "n2",
                    "create": {
                        "name": "Узел_2",
                        "subtype": "node",
                        "lon": 37.62,
                        "lat": 55.76,
                        "layer_id": layer["id"],
                    },
                },
            ],
            "infra_lines": [
                {
                    "client_ref": "line1",
                    "snap_start_ref": "n1",
                    "snap_finish_ref": "n2",
                    "create": {
                        "name": "ЛЭП_1",
                        "subtype": "power_line",
                        "lon": 37.6,
                        "lat": 55.75,
                        "end_lon": 37.62,
                        "end_lat": 55.76,
                        "layer_id": layer["id"],
                        "coordinates": [
                            [37.6, 55.75],
                            [37.62, 55.76],
                        ],
                    },
                }
            ],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["network_rebuilt"] is True
    assert len(body["created_infra"]) == 3

    listed = client.get(f"/api/v1/projects/{pid}/infrastructure/objects")
    assert listed.status_code == 200
    by_id = {row["id"]: row for row in listed.json()}
    line = next(r for r in body["created_infra"] if r["subtype"] == "power_line")
    n1 = next(r for r in body["created_infra"] if r["name"] == "Узел_1")
    n2 = next(r for r in body["created_infra"] if r["name"] == "Узел_2")
    stored = by_id[line["id"]]
    assert stored["lon"] == n1["lon"]
    assert stored["lat"] == n1["lat"]
    assert stored["end_lon"] == n2["lon"]
    assert stored["end_lat"] == n2["lat"]


def test_batch_paste_gas_pad_target_subtype(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_paste_pad")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    res = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [],
            "infra_points": [
                {
                    "client_ref": "pad1",
                    "target_subtype": "gas_pad",
                    "create": {
                        "name": "Куст_1",
                        "subtype": "oil_pad",
                        "lon": 37.6,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                }
            ],
            "infra_lines": [],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["created_infra"]) == 1
    assert body["created_infra"][0]["subtype"] == "gas_pad"


def test_batch_paste_atomic_on_invalid_line(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_paste_atomic")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    before = client.get(f"/api/v1/projects/{pid}/infrastructure/objects")
    assert before.status_code == 200
    count_before = len(before.json())

    res = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [],
            "infra_points": [
                {
                    "client_ref": "ok",
                    "create": {
                        "name": "GKS_1",
                        "subtype": "gas_processing",
                        "lon": 37.6,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                }
            ],
            "infra_lines": [
                {
                    "client_ref": "bad_line",
                    "create": {
                        "name": "bad",
                        "subtype": "power_line",
                        "lon": 37.6,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                }
            ],
        },
    )
    assert res.status_code == 400, res.text

    after = client.get(f"/api/v1/projects/{pid}/infrastructure/objects")
    assert after.status_code == 200
    assert len(after.json()) == count_before


def test_batch_paste_atomic_rolls_back_pois_on_invalid_line(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_paste_atomic_poi")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    before_pois = client.get(f"/api/v1/projects/{pid}/pois")
    assert before_pois.status_code == 200
    poi_count_before = len(before_pois.json())

    res = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [
                {
                    "client_ref": "p1",
                    "create": {
                        "name": "POI_should_not_persist",
                        "lon": 37.61,
                        "lat": 55.751,
                    },
                }
            ],
            "infra_points": [],
            "infra_lines": [
                {
                    "client_ref": "bad_line",
                    "create": {
                        "name": "bad",
                        "subtype": "power_line",
                        "lon": 37.6,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                }
            ],
        },
    )
    assert res.status_code == 400, res.text

    after_pois = client.get(f"/api/v1/projects/{pid}/pois")
    assert after_pois.status_code == 200
    assert len(after_pois.json()) == poi_count_before


def test_batch_paste_poi(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_paste_poi")
    pid = project["id"]
    hdrs = csrf_headers(client)

    res = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [
                {
                    "client_ref": "p1",
                    "create": {
                        "name": "POI_1",
                        "lon": 37.61,
                        "lat": 55.751,
                    },
                }
            ],
            "infra_points": [],
            "infra_lines": [],
        },
    )
    assert res.status_code == 200, res.text
    assert len(res.json()["created_pois"]) == 1


def test_batch_paste_over_limit_returns_422_not_500(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_paste_limit")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    res = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [],
            "infra_points": [
                {
                    "client_ref": f"n{i}",
                    "create": {
                        "name": f"N_{i}",
                        "subtype": "node",
                        "lon": 37.6 + i * 0.0001,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                }
                for i in range(10001)
            ],
            "infra_lines": [],
        },
    )
    assert res.status_code == 422, res.text
    body = res.json()
    assert "detail" in body
    assert "request_id" in body
    assert "500" not in res.text or "10000" in res.text


def test_batch_paste_800_infra_points(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_paste_800")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    res = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [],
            "infra_points": [
                {
                    "client_ref": f"n{i}",
                    "create": {
                        "name": f"N_{i}",
                        "subtype": "node",
                        "lon": 37.6 + i * 0.00001,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                }
                for i in range(800)
            ],
            "infra_lines": [],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["created_infra"]) == 800


def test_batch_paste_lines_snap_existing_object_uuid(client):
    """Lines in a follow-up batch can snap to points created in an earlier batch."""
    project, headers = create_test_project(
        client, email="analyst@test.ru", name="test_batch_paste_uuid_snap"
    )
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    points = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [],
            "infra_points": [
                {
                    "client_ref": "n1",
                    "create": {
                        "name": "Узел_A",
                        "subtype": "node",
                        "lon": 37.6,
                        "lat": 55.75,
                        "layer_id": layer["id"],
                    },
                },
                {
                    "client_ref": "n2",
                    "create": {
                        "name": "Узел_B",
                        "subtype": "node",
                        "lon": 37.61,
                        "lat": 55.751,
                        "layer_id": layer["id"],
                    },
                },
            ],
            "infra_lines": [],
        },
    )
    assert points.status_code == 200, points.text
    created = points.json()["created_infra"]
    n1_id = created[0]["id"]
    n2_id = created[1]["id"]

    lines = _batch_paste(
        client,
        pid,
        hdrs,
        {
            "pois": [],
            "infra_points": [],
            "infra_lines": [
                {
                    "client_ref": "line1",
                    "snap_start_ref": n1_id,
                    "snap_finish_ref": n2_id,
                    "create": {
                        "name": "Дорога_1",
                        "subtype": "autoroad",
                        "lon": 37.6,
                        "lat": 55.75,
                        "end_lon": 37.61,
                        "end_lat": 55.751,
                        "layer_id": layer["id"],
                    },
                }
            ],
        },
    )
    assert lines.status_code == 200, lines.text
    assert len(lines.json()["created_infra"]) == 1
    assert lines.json()["network_rebuilt"] is True
