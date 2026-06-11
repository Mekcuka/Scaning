"""Plan-view sketch volume helpers."""

from __future__ import annotations

import math

from pad_earthwork.schemas import PadParams, PlanPolygonSketch, PlanRectangleSketch, PlanVertex

MIN_DIM = 1.0


def derive_params_from_plan(
    sketch: PlanRectangleSketch,
    *,
    height_m: float,
    reference_elevation_m: float,
) -> PadParams:
    return PadParams(
        length_m=sketch.length_m,
        width_m=sketch.width_m,
        height_m=height_m,
        rotation_deg=sketch.rotation_deg,
        reference_elevation_m=reference_elevation_m,
    )


def derive_params_from_polygon(
    sketch: PlanPolygonSketch,
    *,
    height_m: float,
    reference_elevation_m: float,
) -> PadParams:
    length_m, width_m, rotation_deg = polygon_bbox_dims(sketch.vertices)
    return PadParams(
        length_m=length_m,
        width_m=width_m,
        height_m=height_m,
        rotation_deg=rotation_deg,
        reference_elevation_m=reference_elevation_m,
    )


def plan_footprint_area_m2(sketch: PlanRectangleSketch) -> float:
    return sketch.length_m * sketch.width_m


def polygon_footprint_area_m2(vertices: list[PlanVertex]) -> float:
    return polygon_area_m2([(v.east_m, v.north_m) for v in vertices])


def polygon_area_m2(points: list[tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0.0
    area = 0.0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        area += points[i][0] * points[j][1]
        area -= points[j][0] * points[i][1]
    return abs(area) / 2.0


def polygon_bbox_dims(vertices: list[PlanVertex]) -> tuple[float, float, float]:
    easts = [v.east_m for v in vertices]
    norths = [v.north_m for v in vertices]
    length_m = max(MIN_DIM, min(500.0, max(easts) - min(easts)))
    width_m = max(MIN_DIM, min(500.0, max(norths) - min(norths)))
    return length_m, width_m, 0.0


def plan_corners_local_m(sketch: PlanRectangleSketch) -> list[tuple[float, float]]:
    """Rectangle corners in local ENU (east, north), CCW from SW."""
    hl = sketch.length_m / 2.0
    hw = sketch.width_m / 2.0
    local = [(-hl, -hw), (hl, -hw), (hl, hw), (-hl, hw)]
    rot = math.radians(sketch.rotation_deg)
    cos_r = math.cos(rot)
    sin_r = math.sin(rot)
    out: list[tuple[float, float]] = []
    for east, north in local:
        out.append((east * cos_r - north * sin_r, east * sin_r + north * cos_r))
    return out


def polygon_vertices_local_m(sketch: PlanPolygonSketch) -> list[tuple[float, float]]:
    return [(v.east_m, v.north_m) for v in sketch.vertices]
