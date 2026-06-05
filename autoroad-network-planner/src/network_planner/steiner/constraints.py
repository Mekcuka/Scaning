"""Max length of the terminal leaf edge (terminal → tree)."""

from __future__ import annotations

import math
from uuid import UUID

from network_planner.schemas.io import PlanRequest
from network_planner.steiner.types import SteinerTreeResult

AttachmentLimits = dict[str, float]


def _id_terminal(uid: UUID) -> str:
    return f"terminal:{uid}"


def build_attachment_limits_from_request(
    graph_ids: list[str],
    req: PlanRequest,
) -> AttachmentLimits:
    default_m = req.options.connector_max_km * 1000.0
    by_gid = {_id_terminal(t.id): t for t in req.terminals}
    limits: AttachmentLimits = {}
    for gid in graph_ids:
        t = by_gid.get(gid)
        if t is not None and t.attachment_max_km is not None:
            limits[gid] = t.attachment_max_km * 1000.0
        else:
            limits[gid] = default_m
    return limits


def terminal_leaf_edge_length(
    tree: SteinerTreeResult,
    terminal_id: str,
    terminal_pt: tuple[float, float],
) -> float:
    """Length of the path from terminal to the backbone (skips zero-length hub hops)."""
    current_id = terminal_id
    current_pt = terminal_pt
    total = 0.0
    seen: set[str] = set()

    for _ in range(len(tree.edges) + 2):
        if current_id in seen:
            break
        seen.add(current_id)
        next_hop: tuple[str, tuple[float, float], float] | None = None
        for a, b, pta, ptb in tree.edges:
            if a == current_id:
                seg = math.hypot(current_pt[0] - ptb[0], current_pt[1] - ptb[1])
                next_hop = (b, ptb, seg)
                break
            if b == current_id:
                seg = math.hypot(current_pt[0] - pta[0], current_pt[1] - pta[1])
                next_hop = (a, pta, seg)
                break
        if next_hop is None:
            break
        nxt_id, nxt_pt, seg = next_hop
        total += seg
        if seg > 1e-6:
            return total
        current_id = nxt_id
        current_pt = nxt_pt

    return total


def tree_respects_attachment_limits(
    tree: SteinerTreeResult,
    graph_ids: list[str],
    local_pts: list[tuple[float, float]],
    limits: AttachmentLimits,
) -> bool:
    for gid, pt in zip(graph_ids, local_pts, strict=True):
        max_m = limits.get(gid, math.inf)
        if terminal_leaf_edge_length(tree, gid, pt) > max_m + 1e-6:
            return False
    return True


def attachment_radius_warnings(
    tree: SteinerTreeResult,
    graph_ids: list[str],
    local_pts: list[tuple[float, float]],
    terminal_uuids: list[UUID],
    limits: AttachmentLimits,
) -> list[str]:
    violations = 0
    for gid, pt in zip(graph_ids, local_pts, strict=True):
        max_m = limits.get(gid, math.inf)
        if terminal_leaf_edge_length(tree, gid, pt) > max_m + 1e-6:
            violations += 1
    if violations:
        return [f"attachment_radius_violations:{violations}"]
    return []
