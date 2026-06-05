"""Edge subdivision into waypoint chains."""

from __future__ import annotations

import math

import pytest

from network_planner.steiner.subdivide import subdivide_tree_edges
from network_planner.steiner.types import SteinerTreeResult


def test_subdivide_inserts_waypoints():
    tree = SteinerTreeResult(
        edges=[("a", "b", (0.0, 0.0), (100.0, 0.0))],
        length_m=100.0,
    )
    out = subdivide_tree_edges(tree, spacing_m=30.0)
    assert out.length_m == pytest.approx(100.0)
    assert len(out.edges) == 4
    assert len(out.steiner_points) == 3
    assert all(k.startswith("steiner:waypoint:") for k in out.steiner_points)


def test_short_edge_unchanged():
    tree = SteinerTreeResult(
        edges=[("a", "b", (0.0, 0.0), (10.0, 0.0))],
        length_m=10.0,
    )
    out = subdivide_tree_edges(tree, spacing_m=30.0)
    assert len(out.edges) == 1
    assert not out.steiner_points


def test_subdivide_preserves_endpoints():
    tree = SteinerTreeResult(
        edges=[("a", "b", (0.0, 0.0), (50.0, 0.0))],
        length_m=50.0,
    )
    out = subdivide_tree_edges(tree, spacing_m=20.0)
    assert out.edges[0][0] == "a"
    assert out.edges[-1][1] == "b"
    seg_sum = sum(
        math.hypot(ptb[0] - pta[0], ptb[1] - pta[1])
        for _, _, pta, ptb in out.edges
    )
    assert seg_sum == pytest.approx(50.0)


def test_zero_spacing_is_noop():
    tree = SteinerTreeResult(
        edges=[("a", "b", (0.0, 0.0), (100.0, 0.0))],
        length_m=100.0,
    )
    out = subdivide_tree_edges(tree, spacing_m=0.0)
    assert out.edges == tree.edges
    assert out.steiner_points == {}
