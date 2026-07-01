"""Tests for line elevation profile BBOX collection."""

from __future__ import annotations

import asyncio
from uuid import UUID

from starlette.testclient import TestClient

from app.core.database import async_session
from app.services.line_elevation_profile.bbox import collect_bbox_corners, compute_project_dem_bbox
from tests.factories import create_test_infra_point, create_test_layer, create_test_project


def _seed_project_with_objects(client: TestClient) -> tuple[str, dict[str, str], str]:
    project, headers = create_test_project(client, name="test_line_profile_bbox")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    point = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="УПН",
        subtype="gas_processing",
        lon=37.6,
        lat=55.75,
    )
    create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Узел-2",
        subtype="substation",
        lon=37.62,
        lat=55.752,
    )
    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        json={
            "name": "Дорога",
            "subtype": "autoroad",
            "lon": 37.6,
            "lat": 55.75,
            "end_lon": 37.62,
            "end_lat": 55.752,
            "layer_id": layer["id"],
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    bottomhole = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Забой",
        subtype="well_bottomhole_nnb",
        lon=37.59,
        lat=55.749,
    )
    return pid, headers, point["id"]


def test_bbox_excludes_bottomholes(client: TestClient):
    pid, _headers, _point_id = _seed_project_with_objects(client)

    async def run():
        async with async_session() as db:
            corners = await collect_bbox_corners(db, UUID(pid))
            return corners

    corners = asyncio.run(run())
    lons = [c[0] for c in corners]
    assert 37.59 not in lons
    assert 37.6 in lons
    assert 37.62 in lons


def test_bbox_raises_when_no_objects(client: TestClient):
    project, _headers = create_test_project(client, name="test_line_profile_bbox_empty")
    pid = project["id"]

    async def run():
        async with async_session() as db:
            await compute_project_dem_bbox(db, UUID(pid))

    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        asyncio.run(run())
    assert exc.value.detail == "line_elevation_profile_no_objects"
