"""SteinerPy graph builder and solver."""

from __future__ import annotations

import pytest

from network_planner.steiner.steinerpy import is_steinerpy_available
from network_planner.steiner.steinerpy.graph import build_candidate_graph
from network_planner.steiner.steinerpy.solver import solve_steiner_tree_steinerpy
from network_planner.steiner.types import SteinerTreeResult
from network_planner.steiner.validate import leaf_degree_violations

pytestmark = pytest.mark.skipif(
    not is_steinerpy_available(),
    reason="steinerpy not installed",
)


def test_build_candidate_graph_includes_terminals_and_centroid():
    ids = ["a", "b", "c", "d"]
    pts = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    graph, positions = build_candidate_graph(ids, pts)
    assert set(ids).issubset(graph.nodes)
    assert "steiner:candidate:centroid" in positions
    assert len(positions) >= len(ids) + 1


def test_build_candidate_graph_merges_geosteiner_steiner_points():
    ids = ["a", "b", "c", "d"]
    pts = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    candidates = SteinerTreeResult(
        edges=[],
        steiner_points={"steiner:0": (0.5, 0.5)},
        length_m=0.0,
    )
    _, positions = build_candidate_graph(ids, pts, steiner_candidates=candidates)
    assert "steiner:0" in positions


@pytest.mark.parametrize("n", [3, 4, 6])
def test_steinerpy_terminals_are_leaves(n: int):
    ids = [f"t{i}" for i in range(n)]
    pts = [(float(i * 100), float((i % 2) * 50)) for i in range(n)]
    tree = solve_steiner_tree_steinerpy(ids, pts)
    assert not leaf_degree_violations(tree.edges, set(ids))
    assert tree.length_m > 0


def test_steinerpy_square_reasonable_length():
    ids = ["a", "b", "c", "d"]
    pts = [(0.0, 0.0), (1000.0, 0.0), (1000.0, 1000.0), (0.0, 1000.0)]
    tree = solve_steiner_tree_steinerpy(ids, pts)
    mst = 3000.0
    assert tree.length_m < mst
