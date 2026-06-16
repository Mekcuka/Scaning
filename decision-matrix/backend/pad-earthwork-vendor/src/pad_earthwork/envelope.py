"""Envelope wrap (truncated pyramid) volume helpers."""

from __future__ import annotations

import math

from pad_earthwork.schemas import EnvelopeWrap, PlanVertex
from pad_earthwork.volume_plan import polygon_area_m2


def _edge_outward_normal(dx: float, dy: float) -> tuple[float, float]:
    length = math.hypot(dx, dy)
    if length < 1e-12:
        return 0.0, 0.0
    return dy / length, -dx / length


def offset_polygon_outward(vertices: list[PlanVertex], distance: float) -> list[PlanVertex]:
    """Outward offset for CCW polygon vertices."""
    n = len(vertices)
    if n < 3 or distance <= 0:
        return [PlanVertex(east_m=v.east_m, north_m=v.north_m) for v in vertices]
    max_miter = distance * 4.0
    out: list[PlanVertex] = []
    for i in range(n):
        prev = vertices[(i - 1) % n]
        curr = vertices[i]
        nxt = vertices[(i + 1) % n]
        e1x = curr.east_m - prev.east_m
        e1y = curr.north_m - prev.north_m
        e2x = nxt.east_m - curr.east_m
        e2y = nxt.north_m - curr.north_m
        n1x, n1y = _edge_outward_normal(e1x, e1y)
        n2x, n2y = _edge_outward_normal(e2x, e2y)
        bx = n1x + n2x
        by = n1y + n2y
        bl = math.hypot(bx, by)
        if bl < 1e-9:
            ox, oy = n1x * distance, n1y * distance
        else:
            bx /= bl
            by /= bl
            dot = n1x * bx + n1y * by
            scale = distance / dot if abs(dot) > 1e-6 else distance
            if not math.isfinite(scale) or scale < 0 or scale > max_miter:
                ox, oy = n1x * distance, n1y * distance
            else:
                ox, oy = bx * scale, by * scale
        out.append(
            PlanVertex(
                east_m=max(-500.0, min(500.0, curr.east_m + ox)),
                north_m=max(-500.0, min(500.0, curr.north_m + oy)),
            )
        )
    return out


def envelope_fill_volume_m3(area_top: float, area_bottom: float, height_m: float) -> float:
    """Truncated pyramid: upper base = top contour, lower base = outward offset."""
    if height_m <= 0:
        return 0.0
    return (height_m / 3.0) * (
        area_top + area_bottom + math.sqrt(max(0.0, area_top * area_bottom))
    )


def _vertices_to_points(vertices: list[PlanVertex]) -> list[tuple[float, float]]:
    return [(v.east_m, v.north_m) for v in vertices]


def compute_envelope_volumes(
    top_vertices: list[PlanVertex],
    height_m: float,
    envelope: EnvelopeWrap,
) -> tuple[float, float, list[tuple[float, float]], list[str]]:
    """Returns fill_m3, footprint_area_m2 (bottom), outer corners local, warnings."""
    warnings: list[str] = ["envelope_volume_is_truncated_pyramid_approximation"]
    area_top = polygon_area_m2(_vertices_to_points(top_vertices))
    outer = offset_polygon_outward(top_vertices, envelope.wrap_width_m)
    area_bottom = polygon_area_m2(_vertices_to_points(outer))
    fill_m3 = envelope_fill_volume_m3(area_top, area_bottom, height_m)
    outer_local = [(v.east_m, v.north_m) for v in outer]
    return fill_m3, area_bottom, outer_local, warnings


def top_vertices_from_rectangle_sketch(sketch) -> list[PlanVertex]:
    from pad_earthwork.volume_plan import plan_corners_local_m

    return [
        PlanVertex(east_m=c[0], north_m=c[1]) for c in plan_corners_local_m(sketch)
    ]


def top_vertices_from_polygon_sketch(sketch) -> list[PlanVertex]:
    return list(sketch.vertices)


def outer_vertices_local_m(top_vertices: list[PlanVertex], wrap_width_m: float) -> list[tuple[float, float]]:
    outer = offset_polygon_outward(top_vertices, wrap_width_m)
    return [(v.east_m, v.north_m) for v in outer]
