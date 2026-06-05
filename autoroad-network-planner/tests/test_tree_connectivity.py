"""Tests for _ensure_tree_connected in pipeline."""

from __future__ import annotations

import math

from network_planner.plan.pipeline import _connected_components, _ensure_tree_connected
from network_planner.steiner.types import SteinerTreeResult


def _edge(a, b):
    return (a, b, (0.0, 0.0), (0.0, 0.0))


def test_connected_components_single():
    tree = SteinerTreeResult(
        edges=[("a", "b", (0, 0), (1, 0)), ("b", "c", (1, 0), (2, 0))],
        steiner_points={"b": (1, 0)},
    )
    comps = _connected_components(tree)
    assert len(comps) == 1


def test_connected_components_multi():
    tree = SteinerTreeResult(
        edges=[
            ("a", "b", (0, 0), (1, 0)),
            ("c", "d", (10, 0), (11, 0)),
        ],
    )
    comps = _connected_components(tree)
    assert len(comps) == 2


def test_ensure_connected_already_connected():
    tree = SteinerTreeResult(
        edges=[("a", "b", (0, 0), (1, 0))],
        steiner_points={},
        length_m=1.0,
    )
    warnings: list[str] = []
    result = _ensure_tree_connected(tree, solver_tag="geosteiner", warnings=warnings)
    assert result is tree
    assert warnings == []


def test_ensure_connected_merges_two_components():
    tree = SteinerTreeResult(
        edges=[
            ("a", "b", (0, 0), (1, 0)),
            ("c", "d", (10, 0), (11, 0)),
        ],
        steiner_points={},
        length_m=2.0,
    )
    warnings: list[str] = []
    result = _ensure_tree_connected(tree, solver_tag="geosteiner", warnings=warnings)

    assert "geosteiner_disconnected_components_fixed" in warnings
    assert len(result.edges) == 3
    assert math.isclose(result.length_m, 2.0 + 9.0)  # closest pair: b(1,0)-c(10,0)

    comps = _connected_components(result)
    assert len(comps) == 1


def test_ensure_connected_merges_three_components():
    tree = SteinerTreeResult(
        edges=[
            ("a", "b", (0, 0), (1, 0)),
            ("c", "d", (10, 0), (11, 0)),
            ("e", "f", (20, 0), (21, 0)),
        ],
        steiner_points={},
        length_m=3.0,
    )
    warnings: list[str] = []
    result = _ensure_tree_connected(tree, solver_tag="geosteiner", warnings=warnings)

    assert "geosteiner_disconnected_components_fixed" in warnings
    comps = _connected_components(result)
    assert len(comps) == 1
    assert len(result.edges) == 5


def test_ensure_connected_with_steiner_points():
    tree = SteinerTreeResult(
        edges=[
            ("a", "s1", (0, 0), (1, 1)),
            ("c", "s2", (20, 0), (21, 1)),
        ],
        steiner_points={"s1": (1, 1), "s2": (21, 1)},
        length_m=math.hypot(1, 1) * 2,
    )
    warnings: list[str] = []
    result = _ensure_tree_connected(tree, solver_tag="geosteiner", warnings=warnings)

    assert "geosteiner_disconnected_components_fixed" in warnings
    comps = _connected_components(result)
    assert len(comps) == 1


def test_ensure_connected_uses_closest_pair():
    """When multiple components exist, the closest pair must be chosen first."""
    tree = SteinerTreeResult(
        edges=[
            ("a", "b", (0, 0), (1, 0)),    # component 1
            ("c", "d", (5, 0), (6, 0)),    # component 2 - close to 1
            ("e", "f", (100, 0), (101, 0)),  # component 3 - far
        ],
        steiner_points={},
        length_m=2.0,
    )
    warnings: list[str] = []
    result = _ensure_tree_connected(tree, solver_tag="geosteiner", warnings=warnings)

    assert len(comps := _connected_components(result)) == 1
    # The first added edge must be b(1,0) — c(5,0) at distance 4
    added = [e for e in result.edges if e not in tree.edges]
    assert len(added) >= 1
    _, _, pa, pb = added[0]
    d = math.hypot(pa[0] - pb[0], pa[1] - pb[1])
    assert math.isclose(d, 4.0)
