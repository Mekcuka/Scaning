"""Footprint geometry in local ENU around center lon/lat."""

from __future__ import annotations

import math


def meters_per_degree(lat_deg: float) -> tuple[float, float]:
    lat_rad = math.radians(lat_deg)
    return 111_320.0 * math.cos(lat_rad), 110_540.0


def footprint_corners_lonlat(
    lon: float,
    lat: float,
    length_m: float,
    width_m: float,
    rotation_deg: float = 0.0,
) -> list[tuple[float, float]]:
    """Rectangle corners (lon, lat) CCW from SW; center at lon/lat."""
    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat)
    half_l = length_m / 2.0
    half_w = width_m / 2.0
    local = [
        (-half_l, -half_w),
        (half_l, -half_w),
        (half_l, half_w),
        (-half_l, half_w),
    ]
    rot = math.radians(rotation_deg)
    cos_r = math.cos(rot)
    sin_r = math.sin(rot)
    out: list[tuple[float, float]] = []
    for east_m, north_m in local:
        xr = east_m * cos_r - north_m * sin_r
        yr = east_m * sin_r + north_m * cos_r
        out.append((lon + xr / m_per_deg_lon, lat + yr / m_per_deg_lat))
    return out


def footprint_polygon_lonlat(
    lon: float,
    lat: float,
    vertices: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """Polygon vertices (lon, lat) in local ENU order."""
    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat)
    return [
        (lon + east_m / m_per_deg_lon, lat + north_m / m_per_deg_lat)
        for east_m, north_m in vertices
    ]
