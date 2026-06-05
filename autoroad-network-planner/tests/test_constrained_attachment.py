"""Constrained attachment fallback and SteinerPy graph limits."""

from __future__ import annotations

import pytest

from network_planner.steiner.constrained_star import constrained_attachment_tree
from network_planner.steiner.constraints import tree_respects_attachment_limits
from network_planner.steiner.steinerpy import is_steinerpy_available
from network_planner.steiner.steinerpy.graph import build_candidate_graph
from network_planner.steiner.steinerpy.solver import solve_steiner_tree_steinerpy

pytestmark = pytest.mark.skipif(
    not is_steinerpy_available(),
    reason="steinerpy not installed",
)


def test_candidate_graph_filters_long_terminal_edges():
    ids = ["a", "b", "c"]
    pts = [(0.0, 0.0), (5000.0, 0.0), (2500.0, 4000.0)]
    limits = {gid: 500.0 for gid in ids}
    graph, positions = build_candidate_graph(ids, pts, attachment_limits=limits)
    assert "steiner:candidate:attach:0" in positions
    assert not graph.has_edge("a", "b")
    assert graph.has_edge("a", "steiner:candidate:attach:0")


def test_steinerpy_respects_tight_limits():
    ids = ["a", "b", "c"]
    pts = [(0.0, 0.0), (5000.0, 0.0), (2500.0, 4000.0)]
    limits = {gid: 800.0 for gid in ids}
    tree = solve_steiner_tree_steinerpy(ids, pts, attachment_limits=limits)
    assert tree_respects_attachment_limits(tree, ids, pts, limits)


def test_constrained_star_respects_limits():
    ids = ["a", "b", "c"]
    pts = [(0.0, 0.0), (400.0, 0.0), (200.0, 300.0)]
    limits = {gid: 500.0 for gid in ids}
    tree = constrained_attachment_tree(ids, pts, limits, normalize_leaves=True)
    assert tree_respects_attachment_limits(tree, ids, pts, limits)
