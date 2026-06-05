"""Validate and normalize leaf degree in Steiner trees."""

from __future__ import annotations

import math

from network_planner.steiner.types import SteinerTreeResult


def vertex_degrees(
    edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]],
) -> dict[str, int]:
    deg: dict[str, int] = {}
    for a, b, _, _ in edges:
        deg[a] = deg.get(a, 0) + 1
        deg[b] = deg.get(b, 0) + 1
    return deg


def leaf_degree_violations(
    edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]],
    leaf_ids: set[str],
    *,
    max_degree: int = 1,
) -> dict[str, int]:
    """Return leaf ids with degree > max_degree."""
    deg = vertex_degrees(edges)
    return {
        vid: deg[vid]
        for vid in leaf_ids
        if deg.get(vid, 0) > max_degree
    }


def terminal_ids_in_tree(
    tree: SteinerTreeResult,
    terminal_ids: set[str] | None = None,
) -> set[str]:
    """Graph ids of terminals (not steiner:* or edge:* virtual nodes)."""
    if terminal_ids is not None:
        return set(terminal_ids)
    steiner = set(tree.steiner_points)
    found: set[str] = set()
    for a, b, _, _ in tree.edges:
        for vid in (a, b):
            if vid not in steiner and not vid.startswith("edge:"):
                found.add(vid)
    return found


def _hub_point_from_terminal(
    terminal_pt: tuple[float, float],
    neighbor_pts: list[tuple[float, float]],
    offset_m: float,
) -> tuple[tuple[float, float], float]:
    """Place hub on the ray from terminal toward backbone neighbors."""
    if offset_m <= 1e-9 or not neighbor_pts:
        return terminal_pt, 0.0

    cx = sum(p[0] for p in neighbor_pts) / len(neighbor_pts)
    cy = sum(p[1] for p in neighbor_pts) / len(neighbor_pts)
    dx, dy = cx - terminal_pt[0], cy - terminal_pt[1]
    dist = math.hypot(dx, dy)
    if dist < 1e-9:
        return terminal_pt, 0.0

    step = min(offset_m, dist * 0.999)
    hub = (
        terminal_pt[0] + dx * (step / dist),
        terminal_pt[1] + dy * (step / dist),
    )
    return hub, step


def normalize_terminal_leaves(
    tree: SteinerTreeResult,
    terminal_ids: set[str] | None = None,
    *,
    enabled: bool = True,
    hub_prefix: str = "steiner:hub",
    hub_offset_m: float = 0.0,
) -> SteinerTreeResult:
    """
    Ensure every terminal has degree 1.

    When a terminal acts as an internal node, insert a hub Steiner node
    ({hub_prefix}:0, …). hub_offset_m sets terminal→hub edge length; 0 keeps
    the hub at the terminal coordinates.
    """
    if not enabled:
        return tree

    terminals = terminal_ids_in_tree(tree, terminal_ids)
    if not terminals:
        return tree

    edges = list(tree.edges)
    steiner_points = dict(tree.steiner_points)
    hub_counter = 0
    length_m = tree.length_m

    def _next_hub_id() -> str:
        nonlocal hub_counter
        while True:
            sid = f"{hub_prefix}:{hub_counter}"
            hub_counter += 1
            if sid not in steiner_points:
                return sid

    while True:
        deg = vertex_degrees(edges)
        violator = next(
            (tid for tid in terminals if deg.get(tid, 0) > 1),
            None,
        )
        if violator is None:
            break

        t_pt: tuple[float, float] | None = None
        neighbor_pts: list[tuple[float, float]] = []
        for a, b, pta, ptb in edges:
            if a == violator:
                if t_pt is None:
                    t_pt = pta
                neighbor_pts.append(ptb)
            elif b == violator:
                if t_pt is None:
                    t_pt = ptb
                neighbor_pts.append(pta)
        if t_pt is None:
            break

        sid = _next_hub_id()
        hub_pt, hub_edge_len = _hub_point_from_terminal(t_pt, neighbor_pts, hub_offset_m)
        steiner_points[sid] = hub_pt
        length_m += hub_edge_len
        new_edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]] = []
        for a, b, pta, ptb in edges:
            if a == violator:
                new_edges.append((sid, b, hub_pt, ptb))
            elif b == violator:
                new_edges.append((a, sid, pta, hub_pt))
            else:
                new_edges.append((a, b, pta, ptb))
        new_edges.append((violator, sid, t_pt, hub_pt))
        edges = new_edges

    return SteinerTreeResult(
        edges=edges,
        steiner_points=steiner_points,
        length_m=length_m,
        heuristic=tree.heuristic,
    )
