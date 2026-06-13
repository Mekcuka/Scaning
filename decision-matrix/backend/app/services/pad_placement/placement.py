"""Pad center heuristics and spacing checks."""

from __future__ import annotations

import math

from app.models import InfrastructureObject
from app.services.pad_placement.schemas import LogicalWell, PadPlacementParams

HEEL_OFFSET_M = 300.0


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def td_centroid(wells: list[LogicalWell]) -> tuple[float, float]:
    if not wells:
        return 0.0, 0.0
    clon = sum(w.td_longitude for w in wells) / len(wells)
    clat = sum(w.td_latitude for w in wells) / len(wells)
    return clon, clat


def mean_azimuth_deg(wells: list[LogicalWell]) -> float:
    if not wells:
        return 90.0
    azis_from_target = [w.target_azi for w in wells if w.target_azi is not None]
    if azis_from_target:
        return _circular_mean_deg(azis_from_target)
    if len(wells) == 1 and wells[0].profile == "gs":
        w = wells[0]
        if w.heel_longitude is not None and w.heel_latitude is not None:
            return _azimuth(w.heel_longitude, w.heel_latitude, w.td_longitude, w.td_latitude)
    clon, clat = td_centroid(wells)
    azis = [_azimuth(clon, clat, w.td_longitude, w.td_latitude) for w in wells]
    return _circular_mean_deg(azis)


def suggest_pad_center(wells: list[LogicalWell]) -> tuple[float, float]:
    """Legacy seed: centroid shifted opposite mean drilling azimuth (heel heuristic)."""
    if not wells:
        return 0.0, 0.0
    clon, clat = td_centroid(wells)
    azi_deg = mean_azimuth_deg(wells)
    azi_rad = math.radians(azi_deg)
    dlon, dlat = _offset_lonlat(clat, azi_rad + math.pi, HEEL_OFFSET_M)
    return clon + dlon, clat + dlat


def _offset_lonlat(lat: float, bearing_rad: float, distance_m: float) -> tuple[float, float]:
    from pad_earthwork.footprint import meters_per_degree

    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat)
    north_m = distance_m * math.cos(bearing_rad)
    east_m = distance_m * math.sin(bearing_rad)
    return east_m / m_per_deg_lon, north_m / m_per_deg_lat


def _circular_mean_deg(azis: list[float]) -> float:
    sx = sum(math.sin(math.radians(a)) for a in azis)
    sy = sum(math.cos(math.radians(a)) for a in azis)
    if sx == 0 and sy == 0:
        return 90.0
    return math.degrees(math.atan2(sx, sy)) % 360.0


def _azimuth(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    from pad_earthwork.footprint import meters_per_degree

    m_per_deg_lon, m_per_deg_lat = meters_per_degree(lat1)
    de = (lon2 - lon1) * m_per_deg_lon
    dn = (lat2 - lat1) * m_per_deg_lat
    deg = math.degrees(math.atan2(de, dn))
    return deg % 360.0


def violates_pad_spacing(
    lon: float,
    lat: float,
    *,
    params: PadPlacementParams,
    existing_pads: list[InfrastructureObject],
    other_centers: list[tuple[float, float]],
) -> bool:
    min_m = params.min_pad_spacing_m
    for pad in existing_pads:
        if haversine_m(lon, lat, float(pad.longitude), float(pad.latitude)) < min_m:
            return True
    for olon, olat in other_centers:
        if haversine_m(lon, lat, olon, olat) < min_m:
            return True
    return False
