"""Build a candidate graph for SteinerPy from Euclidean terminals."""

from __future__ import annotations

import math

import networkx as nx

from network_planner.steiner.types import SteinerTreeResult


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _angle_penalty(
    terminal_pt: tuple[float, float],
    candidate_pt: tuple[float, float],
    backbone_dir: tuple[float, float],
    *,
    target_deg: float,
    penalty_factor: float,
) -> float:
    """Multiplicative penalty (>1) for deviation from target angle at backbone."""
    if penalty_factor <= 0:
        return 1.0

    dx = candidate_pt[0] - terminal_pt[0]
    dy = candidate_pt[1] - terminal_pt[1]
    dist = math.hypot(dx, dy)
    if dist < 1e-9:
        return 1.0

    bx, by = backbone_dir
    bnorm = math.hypot(bx, by)
    if bnorm < 1e-9:
        return 1.0

    cos_a = (dx * bx + dy * by) / (dist * bnorm)
    cos_a = max(-1.0, min(1.0, cos_a))
    actual_deg = math.degrees(math.acos(cos_a))
    deviation = abs(actual_deg - target_deg) / 180.0
    return 1.0 + penalty_factor * deviation


def build_candidate_graph(
    ids: list[str],
    points: list[tuple[float, float]],
    *,
    steiner_candidates: SteinerTreeResult | None = None,
    attachment_limits: dict[str, float] | None = None,
    angle_target_deg: float = 0.0,
    angle_penalty: float = 0.0,
    steiner_radius_m: float = 0.0,
) -> tuple[nx.Graph, dict[str, tuple[float, float]]]:
    """
    Complete graph on terminals plus Steiner candidate nodes.

    attachment_limits cap terminal edges and add per-terminal ring candidates.
    angle_target_deg/angle_penalty adjust edge weights to prefer attachments
    whose direction from the terminal matches the target angle to the backbone.
    steiner_radius_m creates an exclusion zone around each terminal: Steiner
    candidates inside are dropped.  Terminal-to-terminal edges are always kept
    so the graph stays connected even when the exclusion zone is large.
    """
    terminal_set = set(ids)
    positions: dict[str, tuple[float, float]] = {
        gid: pt for gid, pt in zip(ids, points, strict=True)
    }
    if steiner_candidates:
        for sid, pt in steiner_candidates.steiner_points.items():
            if sid not in positions:
                positions[sid] = pt

    cx = cy = 0.0
    if len(ids) >= 3:
        cx = sum(p[0] for p in points) / len(points)
        cy = sum(p[1] for p in points) / len(points)
        centroid_id = "steiner:candidate:centroid"
        if centroid_id not in positions:
            positions[centroid_id] = (cx, cy)

    backbone_dirs: dict[str, tuple[float, float]] = {}
    for i, (gid, pt) in enumerate(zip(ids, points, strict=True)):
        dx = cx - pt[0]
        dy = cy - pt[1]
        if math.hypot(dx, dy) < 1e-9 and len(ids) > 1:
            others = [points[j] for j in range(len(ids)) if j != i]
            ox = sum(p[0] for p in others) / len(others)
            oy = sum(p[1] for p in others) / len(others)
            dx, dy = ox - pt[0], oy - pt[1]
        backbone_dirs[gid] = (dx, dy)

    if attachment_limits:
        for i, (gid, pt) in enumerate(zip(ids, points, strict=True)):
            max_m = attachment_limits.get(gid, math.inf)
            if max_m == math.inf:
                continue
            bx, by = backbone_dirs.get(gid, (1.0, 0.0))
            bnorm = math.hypot(bx, by)
            if bnorm < 1e-9:
                bx, by = 1.0, 0.0
                bnorm = 1.0
            step = min(max_m, bnorm * 0.999)
            positions[f"steiner:candidate:attach:{i}"] = (
                pt[0] + bx * (step / bnorm),
                pt[1] + by * (step / bnorm),
            )

    if steiner_radius_m > 0:
        filtered: dict[str, tuple[float, float]] = {}
        for nid, pt in positions.items():
            if nid in terminal_set:
                filtered[nid] = pt
                continue
            if all(_dist(pt, tpt) >= steiner_radius_m for tpt in points):
                filtered[nid] = pt
        positions = filtered

    node_ids = list(positions.keys())
    graph = nx.Graph()
    for i, a in enumerate(node_ids):
        ax, ay = positions[a]
        for b in node_ids[i + 1 :]:
            bx, by = positions[b]
            w = math.hypot(ax - bx, ay - by)
            if attachment_limits:
                if a in attachment_limits and a in terminal_set:
                    if w > attachment_limits[a] + 1e-6:
                        continue
                if b in attachment_limits and b in terminal_set:
                    if w > attachment_limits[b] + 1e-6:
                        continue
            if angle_penalty > 0:
                if a in terminal_set and b not in terminal_set:
                    bd = backbone_dirs.get(a, (0.0, 0.0))
                    w *= _angle_penalty(
                        positions[a],
                        positions[b],
                        bd,
                        target_deg=angle_target_deg,
                        penalty_factor=angle_penalty,
                    )
                elif b in terminal_set and a not in terminal_set:
                    bd = backbone_dirs.get(b, (0.0, 0.0))
                    w *= _angle_penalty(
                        positions[b],
                        positions[a],
                        bd,
                        target_deg=angle_target_deg,
                        penalty_factor=angle_penalty,
                    )
            graph.add_edge(a, b, weight=w)

    if steiner_radius_m > 0:
        for gid in ids:
            if gid not in graph:
                graph.add_node(gid)
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                if not nx.has_path(graph, a, b):
                    graph.add_edge(
                        a,
                        b,
                        weight=_dist(positions[a], positions[b]),
                    )
    return graph, positions


def tree_from_steinerpy_solution(
    ids: list[str],
    positions: dict[str, tuple[float, float]],
    selected_edges: list[tuple[str, str]],
    *,
    objective: float,
) -> SteinerTreeResult:
    """Convert SteinerPy edge list to SteinerTreeResult."""
    terminal_set = set(ids)
    edges_out: list[tuple[str, str, tuple[float, float], tuple[float, float]]] = []
    total = 0.0
    for a, b in selected_edges:
        pa = positions[a]
        pb = positions[b]
        w = math.hypot(pa[0] - pb[0], pa[1] - pb[1])
        edges_out.append((a, b, pa, pb))
        total += w

    used: set[str] = set()
    for a, b in selected_edges:
        used.add(a)
        used.add(b)
    steiner_points = {
        nid: positions[nid]
        for nid in used
        if nid not in terminal_set and not nid.startswith("steiner:hub:")
    }

    length_m = objective if objective > 0 else total
    return SteinerTreeResult(
        edges=edges_out,
        steiner_points=steiner_points,
        length_m=length_m,
        heuristic=False,
    )
