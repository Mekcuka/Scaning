"""Minimal spatial helpers for the standalone planner."""

from __future__ import annotations

import math


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def closest_point_on_segment(
    plon: float, plat: float, alon: float, alat: float, blon: float, blat: float
) -> tuple[float, float]:
    cos_lat = math.cos(math.radians((alat + blat + plat) / 3))
    ax, ay = alon * cos_lat, alat
    bx, by = blon * cos_lat, blat
    px, py = plon * cos_lat, plat
    abx, aby = bx - ax, by - ay
    ab2 = abx * abx + aby * aby
    if ab2 < 1e-15:
        t = 0.0
    else:
        t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / ab2))
    clon = (ax + t * abx) / cos_lat
    clat = ay + t * aby
    return clon, clat
