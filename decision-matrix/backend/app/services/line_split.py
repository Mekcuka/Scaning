"""Split infrastructure line objects at a point (server-side, mirrors frontend lineSplit.ts)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.models import InfrastructureObject
from app.services.spatial import line_coords_from_object
from app.services.road_graph import LINE_SPLIT_ENDPOINT_MIN_KM, haversine_km

LINE_SPLIT_HIT_TOLERANCE_KM = 0.3


@dataclass
class LineSplitPlan:
    first_coords: list[list[float]]
    second_coords: list[list[float]]
    second_name: str


def split_line_coordinates_at(
    coords: list[tuple[float, float]],
    segment_index: int,
    split_lon: float,
    split_lat: float,
) -> tuple[list[list[float]], list[list[float]]] | None:
    if len(coords) < 2:
        return None
    if segment_index < 0 or segment_index >= len(coords) - 1:
        return None
    q = [split_lon, split_lat]
    first = [[c[0], c[1]] for c in coords[: segment_index + 1]] + [q]
    second = [q] + [[c[0], c[1]] for c in coords[segment_index + 1 :]]
    if len(first) < 2 or len(second) < 2:
        return None
    return first, second


def build_line_split_plan(
    line: InfrastructureObject,
    segment_index: int,
    split_lon: float,
    split_lat: float,
    second_line_name: str,
) -> LineSplitPlan | None:
    coords = line_coords_from_object(line)
    parts = split_line_coordinates_at(coords, segment_index, split_lon, split_lat)
    if parts is None:
        return None
    first, second = parts
    return LineSplitPlan(first_coords=first, second_coords=second, second_name=second_line_name)


def line_geometry_fields_from_coords(
    coords: list[list[float]],
    *,
    name: str,
    subtype: str,
    layer_id: UUID,
    properties: dict[str, Any] | None = None,
) -> dict[str, Any]:
    props = dict(properties or {})
    props["coordinates"] = coords
    return {
        "name": name,
        "subtype": subtype,
        "layer_id": layer_id,
        "lon": coords[0][0],
        "lat": coords[0][1],
        "end_lon": coords[-1][0],
        "end_lat": coords[-1][1],
        "properties": props,
    }


def _segments_intersect(
    a1: tuple[float, float],
    a2: tuple[float, float],
    b1: tuple[float, float],
    b2: tuple[float, float],
) -> tuple[float, float] | None:
    """Planar segment intersection in lon/lat."""
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
