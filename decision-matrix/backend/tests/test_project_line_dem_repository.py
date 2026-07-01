"""Tests for project line DEM repository."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from app.core.database import async_session
from app.models import ProjectLineDem
from app.services.line_elevation_profile.dem_paths import project_dem_file_path
from app.services.line_elevation_profile.project_dem_repository import ensure_project_line_dem
from app.services.pad_earthwork.dem_store import SYNTHETIC_DEM_SOURCE, bbox_hash
from tests.factories import create_test_infra_point, create_test_layer, create_test_project
from tests.test_pad_earthwork_api import _make_dem_geotiff_bytes

pytest.importorskip("rasterio")


def _bbox() -> tuple[float, float, float, float]:
    return 37.61, 55.75, 37.63, 55.77


def test_ensure_project_line_dem_fetch_and_reuse(client: TestClient, tmp_path: Path, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.LINE_PROFILE_DEM_DATA_ROOT", str(tmp_path / "line_dem"))
    dem_bytes = _make_dem_geotiff_bytes(elevation=120.0)
    fetch_calls = {"n": 0}

    async def _fetch(_bbox, **kwargs):
        fetch_calls["n"] += 1
        return dem_bytes

    with patch(
        "app.services.line_elevation_profile.project_dem_repository.fetch_opentopography_dem_async",
        side_effect=_fetch,
    ):
        project, headers = create_test_project(client, name="test_project_line_dem")
        pid = project["id"]
        layer = create_test_layer(client, pid, headers)
        create_test_infra_point(client, pid, layer["id"], headers, lon=37.62, lat=55.76)
        bbox = _bbox()

        async def run_once():
            async with async_session() as db:
                path, fetched, reused = await ensure_project_line_dem(db, project_id=UUID(pid), bbox=bbox)
                await db.commit()
                return path, fetched, reused

        path1, fetched1, reused1 = asyncio.run(run_once())
        assert fetched1 is True
        assert reused1 is False
        assert path1.is_file()
        assert path1 == project_dem_file_path(UUID(pid))

        path2, fetched2, reused2 = asyncio.run(run_once())
        assert fetched2 is False
        assert reused2 is True
        assert path2 == path1
        assert fetch_calls["n"] == 1

        async def load_row():
            async with async_session() as db:
                row = await db.scalar(select(ProjectLineDem).where(ProjectLineDem.project_id == UUID(pid)))
                assert row is not None
                assert row.file_size_bytes == len(dem_bytes)

        asyncio.run(load_row())


def test_ensure_project_line_dem_refetches_when_synthetic_cached_and_key_added(
    client: TestClient, tmp_path: Path, monkeypatch
):
    from app.core.config import settings

    monkeypatch.setattr("app.core.config.settings.LINE_PROFILE_DEM_DATA_ROOT", str(tmp_path / "line_dem"))
    dem_bytes = _make_dem_geotiff_bytes(elevation=120.0)
    fetch_calls = {"n": 0}

    async def _fetch(_bbox, **kwargs):
        fetch_calls["n"] += 1
        return dem_bytes

    with patch(
        "app.services.line_elevation_profile.project_dem_repository.fetch_opentopography_dem_async",
        side_effect=_fetch,
    ):
        project, headers = create_test_project(client, name="test_line_dem_upgrade")
        pid = UUID(project["id"])
        bbox = _bbox()

        async def seed_synthetic_row():
            async with async_session() as db:
                path = project_dem_file_path(pid)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(_make_dem_geotiff_bytes(elevation=100.0))
                row = ProjectLineDem(
                    id=UUID("00000000-0000-4000-8000-000000000001"),
                    project_id=pid,
                    bbox_hash="placeholder",
                    bbox_west=bbox[0],
                    bbox_south=bbox[1],
                    bbox_east=bbox[2],
                    bbox_north=bbox[3],
                    source=SYNTHETIC_DEM_SOURCE,
                    file_size_bytes=path.stat().st_size,
                    fetched_at=datetime.now(UTC),
                )
                row.bbox_hash = bbox_hash(bbox)
                db.add(row)
                await db.commit()

        asyncio.run(seed_synthetic_row())

        monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "a" * 32)

        async def run_upgrade():
            async with async_session() as db:
                path, fetched, reused = await ensure_project_line_dem(db, project_id=pid, bbox=bbox)
                await db.commit()
                return path, fetched, reused

        path, fetched, reused = asyncio.run(run_upgrade())
        assert fetched is True
        assert reused is False
        assert fetch_calls["n"] == 1
        assert path.is_file()

        async def load_row():
            async with async_session() as db:
                row = await db.scalar(select(ProjectLineDem).where(ProjectLineDem.project_id == pid))
                assert row is not None
                assert row.source == "opentopography:COP30"

        asyncio.run(load_row())
