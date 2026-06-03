"""Batch map delete API — group selection without parallel DELETE storms."""

from tests.conftest import csrf_headers
from tests.factories import create_test_infra_point, create_test_layer, create_test_project


def test_batch_delete_many_infra_objects(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_batch_del")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    hdrs = csrf_headers(client)

    created_ids: list[str] = []
    for i in range(12):
        pt = create_test_infra_point(
            client,
            pid,
            layer["id"],
            name=f"pt_{i}",
            lon=37.5 + i * 0.001,
            lat=55.75,
            headers=hdrs,
        )
        created_ids.append(pt["id"])

    res = client.post(
        f"/api/v1/projects/{pid}/map/batch-delete",
        json={"object_ids": created_ids, "poi_ids": []},
        headers=hdrs,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["deleted_objects"] >= len(created_ids)

    listed = client.get(f"/api/v1/projects/{pid}/infrastructure/objects")
    assert listed.status_code == 200
    remaining = {row["id"] for row in listed.json()}
    for oid in created_ids:
        assert oid not in remaining
