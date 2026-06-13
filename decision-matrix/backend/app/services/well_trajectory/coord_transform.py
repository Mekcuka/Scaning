"""Local ENU (m) ↔ WGS84 for pad-centered well geometry."""

from __future__ import annotations


def local_to_lonlat(lon0: float, lat0: float, east_m: float, north_m: float) -> tuple[float, float]:
    from pad_earthwork.footprint import meters_per_degree

    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat0)
    return lon0 + east_m / m_per_deg_lon, lat0 + north_m / m_per_deg_lat


def lonlat_to_local(lon0: float, lat0: float, lon: float, lat: float) -> tuple[float, float]:
    from pad_earthwork.footprint import meters_per_degree

    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat0)
    east_m = (lon - lon0) * m_per_deg_lon
    north_m = (lat - lat0) * m_per_deg_lat
    return east_m, north_m
