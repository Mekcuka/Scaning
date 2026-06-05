"""Push Steiner points outside exclusion radius around terminals."""

from __future__ import annotations

import math

from network_planner.steiner.types import SteinerTreeResult


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _push_point_outside_radii(
    point: tuple[float, float],
    terminal_pts: list[tuple[float, float]],
    radius_m: float,
    *,
    max_iters: int = 8,
) -> tuple[float, float]:
    """
    Move `point` until it is at least `radius_m` away from every terminal.

    Iterative: a single push can land the point inside another terminal's
    radius, so we repeat until stable or max_iters is reached.
    """
    px, py = point
    for _ in range(max_iters):
        moved = False
        for tpt in terminal_pts:
            dx = px - tpt[0]
            dy = py - tpt[1]
            d = math.hypot(dx, dy)
            if d < radius_m - 1e-9:
                if d < 1e-9:
                    # Point coincides with terminal; pick an arbitrary direction.
                    dx, dy = 1.0, 0.0
                    d = 1.0
                scale = radius_m / d
                px = tpt[0] + dx * scale
                py = tpt[1] + dy * scale
                moved = True
        if not moved:
            break
    return (px, py)


def repel_steiner_points(
    tree: SteinerTreeResult,
    terminal_pts: list[tuple[float, float]],
    radius_m: float,
    *,
    skip_prefixes: tuple[str, ...] = ("steiner:hub", "steiner:attach"),
) -> SteinerTreeResult:
    """
    Move every Steiner point outside the exclusion zone of `radius_m` around
    each terminal. Edges and total length are recomputed from new positions.

    Terminals themselves are never moved. Steiner points that already satisfy
    the radius are left untouched. Nodes whose id starts with any of
    `skip_prefixes` are also skipped — these are bookkeeping nodes (hubs,
    attach points) that have to stay close to their terminal by design.
    """
    if radius_m <= 0 or not tree.steiner_points:
        return tree

    def _should_skip(sid: str) -> bool:
        return any(sid.startswith(p) for p in skip_prefixes)

    new_positions: dict[str, tuple[float, float]] = {}
    moved_any = False
    for sid, pt in tree.steiner_points.items():
        if _should_skip(sid):
            new_positions[sid] = pt
            continue
        new_pt = _push_point_outside_radii(pt, terminal_pts, radius_m)
        new_positions[sid] = new_pt
        if _dist(new_pt, pt) > 1e-9:
            moved_any = True

    if not moved_any:
        return tree

    def _resolve(node_id: str, original_pt: tuple[float, float]) -> tuple[float, float]:
        if node_id in new_positions:
            return new_positions[node_id]
        return original_pt

    new_edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]] = []
    total = 0.0
    for a, b, pa, pb in tree.edges:
        new_pa = _resolve(a, pa)
        new_pb = _resolve(b, pb)
        w = _dist(new_pa, new_pb)
        total += w
        new_edges.append((a, b, new_pa, new_pb))

    return SteinerTreeResult(
        edges=new_edges,
        steiner_points=new_positions,
        length_m=total,
        heuristic=tree.heuristic,
    )
