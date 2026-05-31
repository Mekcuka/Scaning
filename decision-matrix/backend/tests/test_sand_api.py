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
