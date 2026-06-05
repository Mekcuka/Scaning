"""Subdivide straight tree edges into chains of shorter segments."""

from __future__ import annotations

import math

from network_planner.steiner.types import SteinerTreeResult


def subdivide_tree_edges(
    tree: SteinerTreeResult,
    spacing_m: float,
    *,
    waypoint_prefix: str = "steiner:waypoint",
) -> SteinerTreeResult:
    """
    Insert intermediate Steiner waypoints along each edge.

    spacing_m is the maximum segment length; shorter edges are unchanged.
    Total tree length and topology endpoints are preserved.
    """
    if spacing_m <= 1e-9:
        return tree

    steiner_points = dict(tree.steiner_points)
    new_edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]] = []
    wp_counter = 0

    def _next_waypoint_id() -> str:
        nonlocal wp_counter
        while True:
            sid = f"{waypoint_prefix}:{wp_counter}"
            wp_counter += 1
            if sid not in steiner_points:
                return sid

    for a, b, pta, ptb in tree.edges:
        dx = ptb[0] - pta[0]
        dy = ptb[1] - pta[1]
        dist = math.hypot(dx, dy)
        if dist <= spacing_m + 1e-9:
            new_edges.append((a, b, pta, ptb))
            continue

        n_segments = max(1, int(math.ceil(dist / spacing_m)))
        prev_id, prev_pt = a, pta
        for i in range(1, n_segments + 1):
            if i < n_segments:
                t = i / n_segments
                next_pt = (pta[0] + dx * t, pta[1] + dy * t)
                wp_id = _next_waypoint_id()
                steiner_points[wp_id] = next_pt
                new_edges.append((prev_id, wp_id, prev_pt, next_pt))
                prev_id, prev_pt = wp_id, next_pt
            else:
                new_edges.append((prev_id, b, prev_pt, ptb))

    return SteinerTreeResult(
        edges=new_edges,
        steiner_points=steiner_points,
        length_m=tree.length_m,
        heuristic=tree.heuristic,
    )
