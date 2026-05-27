"""WKT helpers for GeoAlchemy2 (SRID 4326) or plain WKT strings (SQLite)."""

import re

from geoalchemy2.elements import WKTElement

from app.core.config import settings

GeoWkt = str | WKTElement


def _wrap_wkt(wkt: str) -> GeoWkt:
    if settings.is_sqlite:
        return wkt
    return WKTElement(wkt, srid=4326)


def point_wkt(lon: float, lat: float) -> GeoWkt:
    return _wrap_wkt(f"POINT({lon} {lat})")


def linestring_wkt(coords: list[tuple[float, float]]) -> GeoWkt:
    if len(coords) < 2:
        raise ValueError("LineString requires at least 2 coordinates")
    parts = ", ".join(f"{lon} {lat}" for lon, lat in coords)
    return _wrap_wkt(f"LINESTRING({parts})")


def line_from_endpoints(lon: float, lat: float, end_lon: float, end_lat: float) -> GeoWkt:
    return linestring_wkt([(lon, lat), (end_lon, end_lat)])


def is_line_subtype(subtype: str) -> bool:
    from app.geo.constants import LINE_SUBTYPES

    return subtype in LINE_SUBTYPES


def geometry_to_wkt_str(geom: object | None) -> str | None:
    if geom is None:
        return None
    if isinstance(geom, str):
        return geom
    desc = getattr(geom, "desc", None)
    if isinstance(desc, str):
        return desc
    return str(geom)


def parse_linestring_wkt(wkt: str | None) -> list[list[float]] | None:
    if not wkt:
        return None
    m = re.match(r"LINESTRING\s*\((.+)\)\s*$", wkt.strip(), re.I | re.S)
    if not m:
        return None
    coords: list[list[float]] = []
    for part in m.group(1).split(","):
        nums = part.strip().split()
        if len(nums) >= 2:
            coords.append([float(nums[0]), float(nums[1])])
    return coords if len(coords) >= 2 else None


def line_coordinates_for_storage(
    *,
    lon: float,
    lat: float,
    end_lon: float | None,
    end_lat: float | None,
    coordinates: list[list[float]] | None,
) -> list[list[float]] | None:
    if coordinates and len(coordinates) >= 2:
        return [[float(c[0]), float(c[1])] for c in coordinates]
    if end_lon is not None and end_lat is not None:
        return [[lon, lat], [end_lon, end_lat]]
    return None


def build_infra_geometry(
    subtype: str,
    lon: float,
    lat: float,
    end_lon: float | None = None,
    end_lat: float | None = None,
    coordinates: list[list[float]] | None = None,
) -> GeoWkt:
    from app.geo.constants import LINE_SUBTYPES, POINT_SUBTYPES

    if subtype in LINE_SUBTYPES:
        if coordinates and len(coordinates) >= 2:
            return linestring_wkt([(c[0], c[1]) for c in coordinates])
        if end_lon is not None and end_lat is not None:
            return line_from_endpoints(lon, lat, end_lon, end_lat)
        raise ValueError(f"Linear subtype {subtype} requires end_lon/end_lat or coordinates")
    if subtype in POINT_SUBTYPES:
        if end_lon is not None or end_lat is not None:
            raise ValueError(f"Point subtype {subtype} must not have line endpoints")
        return point_wkt(lon, lat)
    raise ValueError(f"Unknown subtype: {subtype}")
