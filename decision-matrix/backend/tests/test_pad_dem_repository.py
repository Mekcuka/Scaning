"""Tests for pad DEM PostgreSQL cache and file lifecycle."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from app.core.database import async_session
from app.models import InfraObjectPadDem, InfrastructureObject
from app.services.pad_earthwork.dem_store import bbox_hash, compute_dem_bbox, dem_file_path
from app.services.pad_earthwork.pad_dem_repository import ensure_pad_dem
from tests.factories import create_test_infra_point, create_test_layer, create_test_project
from tests.test_pad_earthwork_api import _make_dem_geotiff_bytes

pytest.importorskip("rasterio")


def _footprint_corners(lon: float, lat: float, *, length_m: float, width_m: float) -> list[tuple[float, float]]:
    from pad_earthwork.footprint import footprint_corners_lonlat

    return footprint_corners_lonlat(lon, lat, length_m, width_m, 0.0)


async def _load_infra_object(object_id: str) -> InfrastructureObject:
    async with async_session() as db:
        obj = await db.get(InfrastructureObject, UUID(object_id))
        assert obj is not None
        return obj


def test_ensure_pad_dem_cache_hit_and_bbox_change_overwrites(
    client: TestClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr("app.core.config.settings.PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))
    dem_bytes = _make_dem_geotiff_bytes(elevation=105.0)
    fetch_calls = {"n": 0}

    def _fetch(_bbox, **kwargs):
        fetch_calls["n"] += 1
        return dem_bytes

    with patch("app.services.pad_earthwork.pad_dem_repository.fetch_opentopography_dem", side_effect=_fetch):
        pid, headers, oid = _create_pad(client)
        obj = asyncio.run(_load_infra_object(oid))
        corners = _footprint_corners(float(obj.longitude), float(obj.latitude), length_m=10, width_m=10)

        async def run_once(corners_arg):
            async with async_session() as db:
                fresh = await db.get(InfrastructureObject, UUID(oid))
                assert fresh is not None
                result = await ensure_pad_dem(
                    db,
                    project_id=UUID(pid),
                    obj=fresh,
                    footprint_corners_lonlat=corners_arg,
                )
                await db.commit()
                return result

        asset_id_1, path_1, updates_1 = asyncio.run(run_once(corners))
        assert updates_1
        assert path_1.is_file()
        asset_id_2, path_2, updates_2 = asyncio.run(run_once(corners))
        assert asset_id_1 == asset_id_2
        assert path_1 == path_2
        assert updates_2 == {}
        assert fetch_calls["n"] == 1

        big_corners = _footprint_corners(float(obj.longitude), float(obj.latitude), length_m=400, width_m=400)
        asset_id_3, path_3, updates_3 = asyncio.run(run_once(big_corners))
        assert asset_id_3 == asset_id_1
        assert path_3 == path_1
        assert updates_3 or fetch_calls["n"] == 2
        assert fetch_calls["n"] == 2
        tif_files = list((tmp_path / "pad_dem" / pid).glob("*.tif"))
        assert len(tif_files) == 1

        async def load_row():
            async with async_session() as db:
                row = await db.scalar(
                    select(InfraObjectPadDem).where(InfraObjectPadDem.infrastructure_object_id == UUID(oid))
                )
                assert row is not None
                padding = 50.0
                bbox = compute_dem_bbox(big_corners, padding_m=padding, lat_deg=float(obj.latitude))
                assert row.bbox_hash == bbox_hash(bbox)

        asyncio.run(load_row())


def test_delete_infra_object_removes_pad_dem_row_and_file(
    client: TestClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr("app.core.config.settings.PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))
    dem_bytes = _make_dem_geotiff_bytes()

    with patch(
        "app.services.pad_earthwork.pad_dem_repository.fetch_opentopography_dem",
        return_value=dem_bytes,
    ):
        pid, headers, oid = _create_pad(client)
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/dem/fetch",
            json={
                "params": {
                    "length_m": 10,
                    "width_m": 10,
                    "height_m": 2,
                    "reference_elevation_m": 100,
                },
            },
            headers=headers,
        )
        assert res.status_code == 200, res.text
        asset_id = res.json()["dem_asset_id"]
        assert dem_file_path(UUID(pid), asset_id).is_file()

    del_res = client.delete(
        f"/api/v1/projects/{pid}/infrastructure/objects/{oid}",
        headers=headers,
    )
    assert del_res.status_code in (200, 204), del_res.text

    async def assert_gone():
        async with async_session() as db:
            row = await db.scalar(
                select(InfraObjectPadDem).where(InfraObjectPadDem.infrastructure_object_id == UUID(oid))
            )
            assert row is None

    asyncio.run(assert_gone())
    assert not dem_file_path(UUID(pid), asset_id).is_file()


def test_dem_fetch_creates_db_row(client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("OPENTOPOGRAPHY_API_KEY", "a" * 32)
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "a" * 32)
    monkeypatch.setattr(settings, "PAD_DEM_DATA_ROOT", str(tmp_path / "pad_dem"))

    with patch(
        "app.services.pad_earthwork.pad_dem_repository.fetch_opentopography_dem",
        return_value=_make_dem_geotiff_bytes(),
    ):
        pid, headers, oid = _create_pad(client)
        res = client.post(
            f"/api/v1/projects/{pid}/infrastructure/objects/{oid}/pad-earthwork/dem/fetch",
            json={
                "params": {
                    "length_m": 10,
                    "width_m": 10,
                    "height_m": 2,
                    "reference_elevation_m": 100,
                },
            },
            headers=headers,
        )
    assert res.status_code == 200, res.text

    async def assert_row():
        async with async_session() as db:
            row = await db.scalar(
                select(InfraObjectPadDem).where(InfraObjectPadDem.infrastructure_object_id == UUID(oid))
            )
            assert row is not None
            assert str(row.id) == res.json()["dem_asset_id"]
            assert row.file_size_bytes > 0

    asyncio.run(assert_row())


def _create_pad(client: TestClient) -> tuple[str, dict[str, str], str]:
    project, headers = create_test_project(client, name="test_pad_dem_repo")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    obj = create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Куст-DEM",
        subtype="oil_pad",
        lon=37.62,
        lat=55.76,
    )
    return pid, headers, obj["id"]
