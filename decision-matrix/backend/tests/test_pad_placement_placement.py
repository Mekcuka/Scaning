"""Tests for pad placement center grid helpers."""

from __future__ import annotations

import math

from app.services.pad_placement.placement import (
    mean_azimuth_deg,
    suggest_pad_center,
    td_centroid,
)
from app.services.pad_placement.placement_optimize import (
    effective_center_search_step,
    iter_center_search_points,
)
from app.services.pad_placement.schemas import LogicalWell


def _well(lon: float, lat: float, *, azi: float | None = None) -> LogicalWell:
    return LogicalWell(
        logical_id=f"nnb:{lon}",
        profile="nnb",
        bottomhole_ids=[],
        td_longitude=lon,
        td_latitude=lat,
        tvd_m=1500,
        target_azi=azi,
    )


def test_td_centroid_averages_coordinates():
    wells = [_well(37.62, 55.76), _well(37.63, 55.77)]
    clon, clat = td_centroid(wells)
    assert abs(clon - 37.625) < 1e-9
    assert abs(clat - 55.765) < 1e-9


def test_iter_center_search_points_symmetric_grid():
    points = iter_center_search_points(
        37.62,
        55.76,
        radius_m=200,
        step_m=200,
    )
    assert len(points) >= 5
    lons = [p[0] for p in points]
    assert max(lons) > 37.62 and min(lons) < 37.62


def test_effective_center_search_step_caps_grid():
    step = effective_center_search_step(radius_m=400, step_m=50)
    axis = int(2 * 400 / step) + 1
    assert axis <= 7


def test_mean_azimuth_uses_target_azi_when_present():
    wells = [_well(37.62, 55.76, azi=90), _well(37.63, 55.77, azi=90)]
    assert mean_azimuth_deg(wells) == 90.0


def test_mean_azimuth_averages_centroid_to_td_when_no_target():
    wells = [_well(37.62, 55.76), _well(37.63, 55.77)]
    azi = mean_azimuth_deg(wells)
    assert 0 <= azi < 360


def test_suggest_pad_center_offset_from_centroid():
    wells = [_well(37.62, 55.76)]
    clon, clat = td_centroid(wells)
    slon, slat = suggest_pad_center(wells)
    dist_deg = math.hypot(slon - clon, slat - clat)
    assert dist_deg > 0
