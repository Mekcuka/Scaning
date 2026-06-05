"""Star-tree fallback when library solvers exceed attachment limits."""

from __future__ import annotations

import math

from network_planner.steiner.constraints import (
    AttachmentLimits,
    tree_respects_attachment_limits,
)
from network_planner.steiner.types import SteinerTreeResult
from network_planner.steiner.validate import normalize_terminal_leaves


def _violations(
    tree: SteinerTreeResult,
    ids: list[str],
    points: list[tuple[float, float]],
    limits: AttachmentLimits,
) -> int:
    from network_planner.steiner.constraints import terminal_leaf_edge_length

    count = 0
    for gid, pt in zip(ids, points, strict=True):
        max_m = limits.get(gid, math.inf)
        if terminal_leaf_edge_length(tree, gid, pt) > max_m + 1e-6:
            count += 1
    return count


def _star_tree(
    ids: list[str],
    points: list[tuple[float, float]],
    hub: tuple[float, float],
    *,
    sid: str = "steiner:0",
) -> SteinerTreeResult:
    edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]] = []
    total = 0.0
    for pid, pt in zip(ids, points, strict=True):
        d = math.hypot(pt[0] - hub[0], pt[1] - hub[1])
        total += d
        edges.append((pid, sid, pt, hub))
    return SteinerTreeResult(
        edges=edges,
        steiner_points={sid: hub},
        length_m=total,
        heuristic=True,
    )


def constrained_attachment_tree(
    ids: list[str],
    points: list[tuple[float, float]],
    limits: AttachmentLimits,
    *,
    normalize_leaves: bool = True,
    steiner_hub_prefix: str = "steiner:hub",
    hub_offset_m: float = 0.0,
) -> SteinerTreeResult:
    """
    Hub-and-spoke tree tuned to minimize attachment-limit violations.

    Each terminal has one edge to a shared Steiner hub; hub position is
    searched near the centroid and along limit circles.
    """
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    tree = _star_tree(ids, points, (cx, cy))
    best_v = _violations(tree, ids, points, limits)

    candidates: list[tuple[float, float]] = [(cx, cy)]
    for gid, pt in zip(ids, points, strict=True):
        max_m = limits.get(gid, math.inf)
        if max_m == math.inf:
            continue
        for dx, dy in ((max_m, 0.0), (-max_m, 0.0), (0.0, max_m), (0.0, -max_m)):
            candidates.append((pt[0] + dx, pt[1] + dy))

    for hub in candidates:
        cand = _star_tree(ids, points, hub)
        v = _violations(cand, ids, points, limits)
        if v < best_v:
            best_v = v
            tree = cand

    if not tree_respects_attachment_limits(tree, ids, points, limits):
        tree.heuristic = True

    return normalize_terminal_leaves(
        tree,
        set(ids),
        enabled=normalize_leaves,
        hub_prefix=steiner_hub_prefix,
        hub_offset_m=hub_offset_m,
    )
