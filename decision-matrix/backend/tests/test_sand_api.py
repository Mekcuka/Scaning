"""Sand logistics analyze API smoke test."""

from tests.factories import create_test_project


def test_sand_logistics_analyze_empty_project(client):
    project, headers = create_test_project(client, name="test_sand_api")
    pid = project["id"]

    from tests.conftest import csrf_headers

    res = client.post(
        f"/api/v1/projects/{pid}/sand-logistics/analyze",
        headers=csrf_headers(client),
    )
    assert res.status_code == 200
    body = res.json()
    assert "subnets" in body
    assert isinstance(body["subnets"], list)


def test_sand_logistics_analyze_with_as_of(client):
    project, headers = create_test_project(client, name="test_sand_api_as_of")
    pid = project["id"]

    from tests.conftest import csrf_headers

    res = client.post(
        f"/api/v1/projects/{pid}/sand-logistics/analyze",
        headers=csrf_headers(client),
        json={"as_of": "2019-01-01"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["as_of"] == "2019-01-01"
    assert body.get("calculated_at")


def test_sand_logistics_get_result_not_found(client):
    project, _ = create_test_project(client, name="test_sand_api_get_missing")
    pid = project["id"]

    from tests.conftest import csrf_headers

    res = client.get(
        f"/api/v1/projects/{pid}/sand-logistics/result",
        headers=csrf_headers(client),
    )
    assert res.status_code == 404


def test_sand_logistics_analyze_then_get_persisted(client):
    project, _ = create_test_project(client, name="test_sand_api_persist")
    pid = project["id"]

    from tests.conftest import csrf_headers

    headers = csrf_headers(client)
    post = client.post(
        f"/api/v1/projects/{pid}/sand-logistics/analyze",
        headers=headers,
        json={"as_of": "2020-01-01"},
    )
    assert post.status_code == 200
    saved = post.json()

    get_res = client.get(
        f"/api/v1/projects/{pid}/sand-logistics/result",
        headers=headers,
    )
    assert get_res.status_code == 200
    loaded = get_res.json()
    assert loaded["as_of"] == saved["as_of"]
    assert loaded["subnet_count"] == saved["subnet_count"]
    assert loaded.get("calculated_at") == saved.get("calculated_at")

    post2 = client.post(
        f"/api/v1/projects/{pid}/sand-logistics/analyze",
        headers=headers,
        json={"as_of": "2025-12-31"},
    )
    assert post2.status_code == 200
    assert post2.json()["as_of"] == "2025-12-31"

    get_res2 = client.get(
        f"/api/v1/projects/{pid}/sand-logistics/result",
        headers=headers,
    )
    assert get_res2.json()["as_of"] == "2025-12-31"
