"""Steiner tree via SteinerPy (NetworkX + HiGHS)."""

from __future__ import annotations

import logging
import math

from network_planner.steiner.constraints import AttachmentLimits
from network_planner.steiner.constrained_star import constrained_attachment_tree
from network_planner.steiner.geosteiner import (
    GeoSteinerRunError,
    is_geosteiner_available,
    solve_steiner_tree_geosteiner,
)
from network_planner.steiner.steinerpy.config import is_steinerpy_available
from network_planner.steiner.steinerpy.graph import (
    build_candidate_graph,
    tree_from_steinerpy_solution,
)
from network_planner.steiner.types import SteinerTreeResult
from network_planner.steiner.validate import normalize_terminal_leaves


class SteinerPyNotAvailableError(ImportError):
    """SteinerPy or highspy is not installed."""


class SteinerPyRunError(RuntimeError):
    """SteinerPy solver failed."""


def _steiner_candidates(
    ids: list[str],
    points: list[tuple[float, float]],
    *,
    steiner_hub_prefix: str,
    hub_offset_m: float,
) -> SteinerTreeResult | None:
    """Optional GeoSteiner tree for Steiner-point candidates in the MIP graph."""
    if not is_geosteiner_available():
        return None
    try:
        return solve_steiner_tree_geosteiner(
            ids,
            points,
            normalize_leaves=False,
            steiner_hub_prefix=steiner_hub_prefix,
            hub_offset_m=hub_offset_m,
        )
    except (GeoSteinerRunError, OSError):
        return None


def solve_steiner_tree_steinerpy(
    ids: list[str],
    points: list[tuple[float, float]],
    *,
    time_limit_sec: float = 300.0,
    attachment_limits: AttachmentLimits | None = None,
    angle_target_deg: float = 0.0,
    angle_penalty: float = 0.0,
    steiner_radius_m: float = 0.0,
    normalize_leaves: bool = True,
    steiner_hub_prefix: str = "steiner:hub",
    hub_offset_m: float = 0.0,
    steiner_candidates: SteinerTreeResult | None = None,
) -> SteinerTreeResult:
    """
    Euclidean Steiner tree via SteinerPy on a candidate graph.

    When attachment_limits is set, terminal edges in the candidate graph are
    capped and attachment-ring candidates are added. When steiner_candidates
    is provided, those Steiner points are added to the candidate graph (in
    addition to or instead of an automatic GeoSteiner query).
    """
    if not is_steinerpy_available():
        raise SteinerPyNotAvailableError(
            "SteinerPy is not installed. Run: pip install steinerpy"
        )

    n = len(ids)
    if n != len(points):
        raise ValueError("ids and points length mismatch")
    if n < 2:
        raise ValueError("need at least 2 terminals")

    norm_kwargs = {
        "enabled": normalize_leaves,
        "hub_prefix": steiner_hub_prefix,
        "hub_offset_m": hub_offset_m,
    }

    if n == 2:
        w = math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1])
        if attachment_limits is not None:
            over = any(
                w > attachment_limits.get(gid, math.inf) + 1e-6 for gid in ids
            )
            if over:
                return constrained_attachment_tree(
                    ids,
                    points,
                    attachment_limits,
                    normalize_leaves=normalize_leaves,
                    steiner_hub_prefix=steiner_hub_prefix,
                    hub_offset_m=hub_offset_m,
                )
        return normalize_terminal_leaves(
            SteinerTreeResult(
                edges=[(ids[0], ids[1], points[0], points[1])],
                length_m=w,
            ),
            set(ids),
            **norm_kwargs,
        )

    logging.getLogger("steinerpy").setLevel(logging.WARNING)
    logging.getLogger("root").setLevel(logging.WARNING)

    if steiner_candidates is None:
        steiner_candidates = _steiner_candidates(
            ids,
            points,
            steiner_hub_prefix=steiner_hub_prefix,
            hub_offset_m=hub_offset_m,
        )
    graph, positions = build_candidate_graph(
        ids,
        points,
        steiner_candidates=steiner_candidates,
        attachment_limits=attachment_limits,
        angle_target_deg=angle_target_deg,
        angle_penalty=angle_penalty,
        steiner_radius_m=steiner_radius_m,
    )

    try:
        from steinerpy import SteinerProblem
    except ImportError as exc:
        raise SteinerPyNotAvailableError(str(exc)) from exc

    try:
        problem = SteinerProblem(graph, [ids], preprocess=True)
        solution = problem.get_solution(time_limit=time_limit_sec, solver="highs")
    except Exception as exc:
        raise SteinerPyRunError(str(exc)) from exc

    tree = tree_from_steinerpy_solution(
        ids,
        positions,
        list(solution.selected_edges),
        objective=float(solution.objective),
    )
    return normalize_terminal_leaves(tree, set(ids), **norm_kwargs)
