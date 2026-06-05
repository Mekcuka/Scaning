"""Build SteinerTreeResult from GeoSteiner optimal certificate."""

from __future__ import annotations

import math

from network_planner.steiner.geosteiner.parser import GeoSteinerCertificateEdge, GeoSteinerSolution
from network_planner.steiner.geosteiner.runner import solve_geosteiner_plane
from network_planner.steiner.mst import mst_edges
from network_planner.steiner.types import SteinerTreeResult
from network_planner.steiner.validate import normalize_terminal_leaves

_COORD_TOL = 1e-3


def _coord_key(pt: tuple[float, float]) -> tuple[float, float]:
    return (round(pt[0], 6), round(pt[1], 6))


def _match_steiner_id(
    pt: tuple[float, float],
    steiner_points: dict[str, tuple[float, float]],
    steiner_pts: list[tuple[float, float]],
) -> str:
    key = _coord_key(pt)
    for sid, spt in steiner_points.items():
        if _coord_key(spt) == key:
            return sid
        if math.hypot(spt[0] - pt[0], spt[1] - pt[1]) <= _COORD_TOL:
            return sid
    for i, spt in enumerate(steiner_pts):
        if math.hypot(spt[0] - pt[0], spt[1] - pt[1]) <= _COORD_TOL:
            sid = f"steiner:{i}"
            steiner_points[sid] = spt
            return sid
    sid = f"steiner:{len(steiner_points)}"
    steiner_points[sid] = pt
    return sid



def _tree_from_certificate_edges(
    ids: list[str],
    terminal_pts: list[tuple[float, float]],
    steiner_pts: list[tuple[float, float]],
    cert_edges: list[GeoSteinerCertificateEdge],
    *,
    length_m: float,
) -> SteinerTreeResult:
    steiner_points: dict[str, tuple[float, float]] = {}
    for i, pt in enumerate(steiner_pts):
        steiner_points[f"steiner:{i}"] = pt

    edges_out: list[tuple[str, str, tuple[float, float], tuple[float, float]]] = []
    total = 0.0
    seen_terminals: set[str] = set()

    for edge in cert_edges:
        if edge.terminal_index is not None and edge.point_b is not None:
            a_id = ids[edge.terminal_index]
            a_pt = terminal_pts[edge.terminal_index]
            b_id = _match_steiner_id(edge.point_b, steiner_points, steiner_pts)
            b_pt = steiner_points[b_id]
            seen_terminals.add(a_id)
        elif edge.point_a is not None and edge.terminal_index_b is not None:
            a_id = _match_steiner_id(edge.point_a, steiner_points, steiner_pts)
            a_pt = steiner_points[a_id]
            b_id = ids[edge.terminal_index_b]
            b_pt = terminal_pts[edge.terminal_index_b]
            seen_terminals.add(b_id)
        elif edge.point_a is not None and edge.point_b is not None:
            a_id = _match_steiner_id(edge.point_a, steiner_points, steiner_pts)
            a_pt = steiner_points[a_id]
            b_id = _match_steiner_id(edge.point_b, steiner_points, steiner_pts)
            b_pt = steiner_points[b_id]
        else:
            continue

        w = math.hypot(a_pt[0] - b_pt[0], a_pt[1] - b_pt[1])
        total += w
        edges_out.append((a_id, b_id, a_pt, b_pt))

    all_pts: list[tuple[float, float]] = list(terminal_pts) + [
        steiner_points[sid] for sid in steiner_points
    ]
    all_ids: list[str] = list(ids) + list(steiner_points.keys())
    pt_index = {gid: i for i, gid in enumerate(all_ids)}

    def _nearest_in_tree(target_pt: tuple[float, float], tree_pts: list[tuple[float, float]]) -> int:
        best_j = -1
        best_d = math.inf
        for j, q in enumerate(tree_pts):
            d = math.hypot(target_pt[0] - q[0], target_pt[1] - q[1])
            if d < best_d:
                best_d = d
                best_j = j
        return best_j

    tree_pt_list: list[tuple[float, float]] = []
    tree_id_list: list[str] = []
    edge_pt_set: set[str] = set()
    for a, b, pa, pb in edges_out:
        for gid, pt in ((a, pa), (b, pb)):
            if gid not in edge_pt_set:
                edge_pt_set.add(gid)
                tree_pt_list.append(pt)
                tree_id_list.append(gid)

    for i, gid in enumerate(ids):
        if gid in seen_terminals:
            continue
        tpt = terminal_pts[i]
        j = _nearest_in_tree(tpt, tree_pt_list)
        if j < 0:
            continue
        neighbor_id = tree_id_list[j]
        neighbor_pt = tree_pt_list[j]
        w = math.hypot(tpt[0] - neighbor_pt[0], tpt[1] - neighbor_pt[1])
        total += w
        edges_out.append((gid, neighbor_id, tpt, neighbor_pt))
        edge_pt_set.add(gid)
        tree_pt_list.append(tpt)
        tree_id_list.append(gid)

    return SteinerTreeResult(
        edges=edges_out,
        steiner_points=steiner_points,
        length_m=length_m if length_m > 0 else total,
        heuristic=False,
    )


def _tree_from_certificate(
    ids: list[str],
    terminal_pts: list[tuple[float, float]],
    solution: GeoSteinerSolution,
    *,
    length_m: float,
    normalize_leaves: bool = True,
    steiner_hub_prefix: str = "steiner:hub",
    hub_offset_m: float = 0.0,
) -> SteinerTreeResult:
    """Reconstruct SMT from GeoSteiner certificate (edges) or MST fallback."""
    steiner_pts = solution.steiner_points

    if solution.certificate_edges:
        tree = _tree_from_certificate_edges(
            ids,
            terminal_pts,
            steiner_pts,
            solution.certificate_edges,
            length_m=length_m,
        )
    else:
        vertex_ids: list[str] = list(ids)
        vertex_pts: list[tuple[float, float]] = list(terminal_pts)
        steiner_points: dict[str, tuple[float, float]] = {}

        for i, pt in enumerate(steiner_pts):
            sid = f"steiner:{i}"
            steiner_points[sid] = pt
            vertex_ids.append(sid)
            vertex_pts.append(pt)

        edges_out: list[tuple[str, str, tuple[float, float], tuple[float, float]]] = []
        total = 0.0
        for i, j, w in mst_edges(vertex_pts):
            a, b = vertex_ids[i], vertex_ids[j]
            edges_out.append((a, b, vertex_pts[i], vertex_pts[j]))
            total += w

        tree = SteinerTreeResult(
            edges=edges_out,
            steiner_points=steiner_points,
            length_m=length_m if length_m > 0 else total,
            heuristic=False,
        )

    return normalize_terminal_leaves(
        tree,
        set(ids),
        enabled=normalize_leaves,
        hub_prefix=steiner_hub_prefix,
        hub_offset_m=hub_offset_m,
    )


def solve_steiner_tree_geosteiner(
    ids: list[str],
    points: list[tuple[float, float]],
    *,
    timeout_sec: float | None = None,
    normalize_leaves: bool = True,
    steiner_hub_prefix: str = "steiner:hub",
    hub_offset_m: float = 0.0,
) -> SteinerTreeResult:
    """Exact Euclidean SMT via GeoSteiner (efst | bb). Requires native binaries."""
    n = len(ids)
    if n != len(points):
        raise ValueError("ids and points length mismatch")
    if n < 2:
        raise ValueError("need at least 2 terminals")
    if n == 2:
        w = math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1])
        return normalize_terminal_leaves(
            SteinerTreeResult(
                edges=[(ids[0], ids[1], points[0], points[1])],
                length_m=w,
            ),
            set(ids),
            enabled=normalize_leaves,
            hub_prefix=steiner_hub_prefix,
            hub_offset_m=hub_offset_m,
        )

    solution = solve_geosteiner_plane(points, timeout_sec=timeout_sec)
    return _tree_from_certificate(
        ids,
        points,
        solution,
        length_m=solution.length_m,
        normalize_leaves=normalize_leaves,
        steiner_hub_prefix=steiner_hub_prefix,
        hub_offset_m=hub_offset_m,
    )
