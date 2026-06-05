"""Shorten terminal leaf edges while preserving the Steiner backbone."""

from __future__ import annotations

import math

from network_planner.steiner.constraints import (
    AttachmentLimits,
    terminal_leaf_edge_length,
    tree_respects_attachment_limits,
)
from network_planner.steiner.types import SteinerTreeResult
from network_planner.steiner.union_find import UnionFind


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _leaf_path(
    edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]],
    terminal_id: str,
    terminal_pt: tuple[float, float],
) -> list[tuple[str, tuple[float, float]]]:
    """Nodes from terminal through zero-length hops to the first backbone hop."""
    path: list[tuple[str, tuple[float, float]]] = [(terminal_id, terminal_pt)]
    current_id = terminal_id
    current_pt = terminal_pt
    seen: set[str] = {terminal_id}

    for _ in range(len(edges) + 2):
        found = False
        for a, b, pta, ptb in edges:
            if a == current_id:
                nxt, npt = b, ptb
            elif b == current_id:
                nxt, npt = a, pta
            else:
                continue
            if nxt in seen:
                continue
            found = True
            path.append((nxt, npt))
            seg = _dist(current_pt, npt)
            if seg > 1e-6:
                return path
            current_id, current_pt = nxt, npt
            seen.add(nxt)
            break
        if not found:
            break
    return path


def _first_edge_from_terminal(
    edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]],
    terminal_id: str,
) -> tuple[str, str, tuple[float, float], tuple[float, float]] | None:
    """Return edge (terminal_id, neighbor_id, terminal_pt, neighbor_pt) regardless of edge orientation."""
    for a, b, pta, ptb in edges:
        if a == terminal_id:
            return a, b, pta, ptb
        if b == terminal_id:
            return b, a, ptb, pta
    return None


def _tree_is_connected(tree: SteinerTreeResult) -> bool:
    nodes: set[str] = set()
    for a, b, _, _ in tree.edges:
        nodes.add(a)
        nodes.add(b)
    if len(nodes) <= 1:
        return len(nodes) == 1
    index = {v: i for i, v in enumerate(nodes)}
    uf = UnionFind(len(index))
    for a, b, _, _ in tree.edges:
        uf.union(index[a], index[b])
    roots = {uf.find(i) for i in range(len(index))}
    return len(roots) == 1


def _shorten_one_terminal(
    tree: SteinerTreeResult,
    terminal_id: str,
    terminal_pt: tuple[float, float],
    max_m: float,
    *,
    attach_prefix: str,
    attach_counter: int,
) -> tuple[SteinerTreeResult, int, bool]:
    total = terminal_leaf_edge_length(tree, terminal_id, terminal_pt)
    if total <= max_m + 1e-6:
        return tree, attach_counter, False

    path = _leaf_path(tree.edges, terminal_id, terminal_pt)
    if len(path) < 2:
        return tree, attach_counter, False

    first_edge = _first_edge_from_terminal(tree.edges, terminal_id)
    if first_edge is None:
        return tree, attach_counter, False

    # _first_edge_from_terminal always returns (terminal_id, neighbor_id, terminal_pt, neighbor_pt)
    _, first_neighbor_id, _, first_neighbor_pt = first_edge
    target_id, target_pt = path[-1][0], path[-1][1]
    span = _dist(terminal_pt, target_pt)
    if span < 1e-9:
        return tree, attach_counter, False

    step = min(max_m, span * 0.999)
    attach_pt = (
        terminal_pt[0] + (target_pt[0] - terminal_pt[0]) * (step / span),
        terminal_pt[1] + (target_pt[1] - terminal_pt[1]) * (step / span),
    )
    attach_id = f"{attach_prefix}:{attach_counter}"
    attach_counter += 1

    drop = frozenset({terminal_id, first_neighbor_id})
    edges = [
        (a, b, pta, ptb)
        for a, b, pta, ptb in tree.edges
        if frozenset({a, b}) != drop
    ]
    edges.append((terminal_id, attach_id, terminal_pt, attach_pt))
    edges.append((attach_id, first_neighbor_id, attach_pt, first_neighbor_pt))

    candidate = SteinerTreeResult(
        edges=edges,
        steiner_points={**tree.steiner_points, attach_id: attach_pt},
        length_m=tree.length_m + step + _dist(attach_pt, first_neighbor_pt) - total,
        heuristic=tree.heuristic,
    )
    if not _tree_is_connected(candidate):
        return tree, attach_counter - 1, False

    return candidate, attach_counter, True


def adjust_terminal_attachments(
    tree: SteinerTreeResult,
    terminal_ids: list[str],
    terminal_pts: list[tuple[float, float]],
    limits: AttachmentLimits,
    *,
    attach_prefix: str = "steiner:attach",
) -> SteinerTreeResult:
    """
    Cap each terminal leaf edge by inserting a Steiner node on the attachment ray.

    Only the first edge at each terminal is rewired; backbone edges are preserved.
    """
    current = tree
    counter = 0
    for tid, pt in zip(terminal_ids, terminal_pts, strict=True):
        max_m = limits.get(tid, math.inf)
        if max_m == math.inf:
            continue
        for _ in range(8):
            if terminal_leaf_edge_length(current, tid, pt) <= max_m + 1e-6:
                break
            current, counter, changed = _shorten_one_terminal(
                current,
                tid,
                pt,
                max_m,
                attach_prefix=attach_prefix,
                attach_counter=counter,
            )
            if not changed:
                break
    return current


def apply_attachment_limits(
    tree: SteinerTreeResult,
    terminal_ids: list[str],
    terminal_pts: list[tuple[float, float]],
    limits: AttachmentLimits | None,
) -> SteinerTreeResult:
    """Prefer backbone-preserving adjustment; star fallback only if still violated."""
    if limits is None or tree_respects_attachment_limits(
        tree, terminal_ids, terminal_pts, limits
    ):
        return tree

    adjusted = adjust_terminal_attachments(tree, terminal_ids, terminal_pts, limits)
    if tree_respects_attachment_limits(adjusted, terminal_ids, terminal_pts, limits):
        return adjusted

    from network_planner.steiner.constrained_star import constrained_attachment_tree

    return constrained_attachment_tree(
        terminal_ids,
        terminal_pts,
        limits,
        normalize_leaves=False,
    )
