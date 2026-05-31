"""GeoJSON import preview smoke test."""

import json

from tests.factories import create_test_layer, create_test_project


def test_geojson_import_preview(client):
    project, headers = create_test_project(client, email="analyst@test.ru", name="test_import_geojson")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)

    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Point A", "type": "gas_processing"},
                "geometry": {"type": "Point", "coordinates": [37.6, 55.75]},
            }
        ],
    }

    from tests.conftest import csrf_headers

    res = client.post(
        f"/api/v1/projects/{pid}/import/preview",
        params={"format": "geojson"},
        headers=csrf_headers(client),
        files={"file": ("test.geojson", json.dumps(geojson), "application/geo+json")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body.get("records_total", 0) >= 1
    assert len(body.get("rows", [])) >= 1
