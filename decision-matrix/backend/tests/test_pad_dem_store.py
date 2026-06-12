"""Tests for pad DEM store helpers."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from pad_earthwork.footprint import footprint_corners_lonlat

from app.services.pad_earthwork.dem_store import (
    bbox_hash,
    compute_dem_bbox,
    fetch_opentopography_dem,
)


def _bbox_side_lengths_m(
    bbox: tuple[float, float, float, float],
    *,
    lat_deg: float,
) -> tuple[float, float]:
    from app.services.pad_earthwork.dem_store import _meters_per_degree

    west, south, east, north = bbox
    m_lon, m_lat = _meters_per_degree(lat_deg)
    return (east - west) * m_lon, (north - south) * m_lat


def test_compute_dem_bbox_with_padding():
    corners = [(37.0, 55.0), (37.01, 55.0), (37.01, 55.01), (37.0, 55.01)]
    west, south, east, north = compute_dem_bbox(corners, padding_m=50.0, lat_deg=55.0)
    assert west < min(c[0] for c in corners)
    assert east > max(c[0] for c in corners)
    assert south < min(c[1] for c in corners)
    assert north > max(c[1] for c in corners)


def test_compute_dem_bbox_expands_narrow_rotated_footprint():
    corners = footprint_corners_lonlat(37.62, 55.76, 196, 58, 90)
    bbox = compute_dem_bbox(corners, padding_m=50.0, lat_deg=55.76, min_side_m=300.0)
    width_m, height_m = _bbox_side_lengths_m(bbox, lat_deg=55.76)
    assert width_m >= 300.0
    assert height_m >= 300.0

def test_bbox_hash_stable():
    bbox = (37.0, 55.0, 37.1, 55.1)
    assert bbox_hash(bbox) == bbox_hash(bbox)
    assert len(bbox_hash(bbox)) == 16


def test_uuid_api_key_rejected_before_http():
    bbox = (37.0, 55.0, 37.1, 55.1)
    with pytest.raises(HTTPException) as exc:
        fetch_opentopography_dem(bbox, api_key="33109778-77e6-4640-858c-028710898914")
    assert exc.value.detail == "dem_api_key_invalid_format"


@pytest.mark.skip(reason="live OpenTopography — run manually when needed")
def test_fetch_opentopography_rotated_pad_bbox():
    """Live OT call — requires OPENTOPOGRAPHY_API_KEY in env."""
    from app.core.config import settings

    if not settings.OPENTOPOGRAPHY_API_KEY.strip():
        pytest.skip("OPENTOPOGRAPHY_API_KEY not set")
    corners = footprint_corners_lonlat(37.62, 55.76, 196, 58, 90)
    bbox = compute_dem_bbox(corners, padding_m=50.0, lat_deg=55.76)
    raw = fetch_opentopography_dem(bbox)
    assert len(raw) > 256
