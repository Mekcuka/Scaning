"""Segment intersection helpers (from backend line_split.py)."""

from __future__ import annotations

from autoroad_planner.constants import LINE_SPLIT_ENDPOINT_MIN_KM
from autoroad_planner.spatial import haversine_km


def _segments_intersect(
    a1: tuple[float, float],
    a2: tuple[float, float],
    b1: tuple[float, float],
    b2: tuple[float, float],
) -> tuple[float, float] | None:
    x1, y1 = a1
    x2, y2 = a2
    x3, y3 = b1
    x4, y4 = b2
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-15:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
    eps = 1e-9
    if eps < t < 1 - eps and eps < u < 1 - eps:
        ix = x1 + t * (x2 - x1)
        iy = y1 + t * (y2 - y1)
        return ix, iy
    return None


def find_segment_intersections(
    seg_a: tuple[tuple[float, float], tuple[float, float]],
    seg_b: tuple[tuple[float, float], tuple[float, float]],
) -> tuple[float, float] | None:
    return _segments_intersect(seg_a[0], seg_a[1], seg_b[0], seg_b[1])


def is_near_line_endpoint(
    lon: float,
    lat: float,
    coords: list[tuple[float, float]],
    *,
    min_km: float = LINE_SPLIT_ENDPOINT_MIN_KM,
) -> bool:
    if len(coords) < 2:
        return True
    start, end = coords[0], coords[-1]
    return (
        haversine_km(lon, lat, start[0], start[1]) < min_km
        or haversine_km(lon, lat, end[0], end[1]) < min_km
    )
