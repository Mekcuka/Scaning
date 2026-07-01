"""Synthetic DEM fallback for local dev without OpenTopography key."""

from __future__ import annotations

from pathlib import Path

import pytest
from starlette.testclient import TestClient

from app.services.pad_earthwork.dem_store import (
    SYNTHETIC_DEM_ELEVATION_M,
    SYNTHETIC_DEM_SOURCE,
    cached_synthetic_dem_should_upgrade,
    dem_source_label,
    fetch_opentopography_dem_async,
    make_synthetic_flat_dem_geotiff,
    synthetic_dem_allowed,
    validate_geotiff,
)
from tests.factories import create_test_infra_point, create_test_layer, create_test_project

pytest.importorskip("rasterio")


def test_make_synthetic_flat_dem_geotiff_validates():
    bbox = (37.61, 55.75, 37.63, 55.77)
    raw = make_synthetic_flat_dem_geotiff(bbox, elevation=88.0)
    validate_geotiff(raw)


@pytest.mark.asyncio
async def test_fetch_uses_synthetic_in_development_without_key(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "DEM_ALLOW_SYNTHETIC", False)
    assert synthetic_dem_allowed() is True

    bbox = (37.61, 55.75, 37.63, 55.77)
    raw = await fetch_opentopography_dem_async(bbox)
    validate_geotiff(raw)
    assert dem_source_label() == SYNTHETIC_DEM_SOURCE


def test_synthetic_blocked_in_production(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "DEM_ALLOW_SYNTHETIC", True)
    assert synthetic_dem_allowed() is False


def test_cached_synthetic_dem_should_upgrade_when_key_present(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "a" * 32)
    assert cached_synthetic_dem_should_upgrade(SYNTHETIC_DEM_SOURCE) is True
    assert cached_synthetic_dem_should_upgrade("opentopography:COP30") is False
    assert cached_synthetic_dem_should_upgrade(None) is False


def test_cached_synthetic_dem_not_upgraded_without_key(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert cached_synthetic_dem_should_upgrade(SYNTHETIC_DEM_SOURCE) is False


@pytest.mark.asyncio
async def test_fetch_with_key_does_not_use_synthetic(monkeypatch):
    from unittest.mock import AsyncMock, patch

    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "a" * 32)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert synthetic_dem_allowed() is False

    bbox = (37.61, 55.75, 37.63, 55.77)
    ot_bytes = make_synthetic_flat_dem_geotiff(bbox, elevation=42.0)
    mock_get = AsyncMock(return_value=type("R", (), {"status_code": 200, "content": ot_bytes, "text": ""})())

    with patch("app.services.pad_earthwork.dem_store.get_http_client") as mock_client:
        mock_client.return_value.get = mock_get
        raw = await fetch_opentopography_dem_async(bbox)

    validate_geotiff(raw)
    mock_get.assert_awaited_once()
    assert dem_source_label() == "opentopography:COP30"


def test_compute_line_profile_without_api_key_uses_synthetic(
    client: TestClient, tmp_path: Path, monkeypatch
):
    from app.core.config import settings

    monkeypatch.setattr(settings, "LINE_PROFILE_DEM_DATA_ROOT", str(tmp_path / "line_dem"))
    monkeypatch.setattr(settings, "OPENTOPOGRAPHY_API_KEY", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    project, headers = create_test_project(client, name="test_line_profile_synthetic")
    pid = project["id"]
    layer = create_test_layer(client, pid, headers)
    create_test_infra_point(client, pid, layer["id"], headers, lon=37.62, lat=55.76)
    create_test_infra_point(
        client,
        pid,
        layer["id"],
        headers,
        name="Узел-2",
        subtype="substation",
        lon=37.615,
        lat=55.755,
    )
    line_res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/objects",
        json={
            "name": "Труба",
            "subtype": "gas_pipeline",
            "lon": 37.62,
            "lat": 55.76,
            "end_lon": 37.615,
            "end_lat": 55.755,
            "layer_id": layer["id"],
            "properties": {"line_elevation_profile_step_m": 50},
        },
        headers=headers,
    )
    assert line_res.status_code == 201, line_res.text
    line_id = line_res.json()["id"]

    res = client.post(
        f"/api/v1/projects/{pid}/infrastructure/line-elevation-profile/compute",
        json={},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["computed_count"] == 1
    assert body["dem_fetched"] is True
    assert body["errors"] == []

    get_res = client.get(
        f"/api/v1/projects/{pid}/infrastructure/objects/{line_id}/line-elevation-profile",
        headers=headers,
    )
    assert get_res.status_code == 200, get_res.text
    profile = get_res.json()
    assert profile["dem_source"] == SYNTHETIC_DEM_SOURCE
    assert profile["points"][0]["elevation_m"] == pytest.approx(SYNTHETIC_DEM_ELEVATION_M, abs=0.5)
