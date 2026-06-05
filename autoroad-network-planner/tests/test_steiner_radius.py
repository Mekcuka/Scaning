"""Tests for steiner_radius.repel_steiner_points."""

from __future__ import annotations

import math

from network_planner.steiner.steiner_radius import repel_steiner_points
from network_planner.steiner.types import SteinerTreeResult


def _make_tree(
    steiner_points: dict[str, tuple[float, float]],
    edges: list[tuple[str, str, tuple[float, float], tuple[float, float]]],
    *,
    length_m: float = 0.0,
) -> SteinerTreeResult:
    return SteinerTreeResult(
        edges=edges,
        steiner_points=steiner_points,
        length_m=length_m or sum(math.hypot(pa[0]-pb[0], pa[1]-pb[1]) for _, _, pa, pb in edges),
        heuristic=False,
    )


def test_radius_zero_returns_tree_unchanged():
    sp = {"steiner:0": (50.0, 0.0)}
    tree = _make_tree(sp, [("terminal:0", "steiner:0", (0.0, 0.0), (50.0, 0.0))])
    result = repel_steiner_points(tree, [(0.0, 0.0)], radius_m=0.0)
    assert result is tree


def test_radius_pushes_steiner_outside_zone():
    sp = {"steiner:0": (50.0, 0.0)}
    tree = _make_tree(sp, [("terminal:0", "steiner:0", (0.0, 0.0), (50.0, 0.0))])
    result = repel_steiner_points(tree, [(0.0, 0.0)], radius_m=100.0)
    new_pt = result.steiner_points["steiner:0"]
    new_dist = math.hypot(new_pt[0], new_pt[1])
    assert new_dist >= 100.0 - 1e-6
    assert new_pt[0] > 50.0  # pushed along +x


def test_radius_keeps_outside_points_untouched():
    sp = {"steiner:0": (500.0, 0.0)}
    tree = _make_tree(sp, [("terminal:0", "steiner:0", (0.0, 0.0), (500.0, 0.0))])
    result = repel_steiner_points(tree, [(0.0, 0.0)], radius_m=100.0)
    assert result.steiner_points["steiner:0"] == (500.0, 0.0)


def test_radius_handles_coincident_point():
    sp = {"steiner:0": (0.0, 0.0)}
    tree = _make_tree(sp, [("terminal:0", "steiner:0", (0.0, 0.0), (0.0, 0.0))])
    result = repel_steiner_points(tree, [(0.0, 0.0)], radius_m=100.0)
    new_pt = result.steiner_points["steiner:0"]
    new_dist = math.hypot(new_pt[0], new_pt[1])
    assert new_dist >= 100.0 - 1e-6


def test_radius_skips_hub_and_attach_prefixes():
    sp = {
        "steiner:0": (50.0, 0.0),       # should be pushed
        "steiner:hub:0": (10.0, 0.0),    # should be kept
        "steiner:attach:0": (5.0, 0.0),  # should be kept
    }
    edges = [
        ("terminal:0", "steiner:hub:0", (0.0, 0.0), (10.0, 0.0)),
        ("steiner:hub:0", "steiner:attach:0", (10.0, 0.0), (5.0, 0.0)),
        ("steiner:attach:0", "steiner:0", (5.0, 0.0), (50.0, 0.0)),
    ]
    tree = _make_tree(sp, edges)
    result = repel_steiner_points(tree, [(0.0, 0.0)], radius_m=100.0)
    assert result.steiner_points["steiner:hub:0"] == (10.0, 0.0)
    assert result.steiner_points["steiner:attach:0"] == (5.0, 0.0)
    pushed = result.steiner_points["steiner:0"]
    assert math.hypot(pushed[0], pushed[1]) >= 100.0 - 1e-6


def test_radius_multiple_terminals():
    sp = {"steiner:0": (50.0, 0.0)}  # close to terminal at (0,0)
    tree = _make_tree(sp, [
        ("terminal:0", "steiner:0", (0.0, 0.0), (50.0, 0.0)),
        ("steiner:0", "terminal:1", (50.0, 0.0), (1000.0, 0.0)),
    ])
    result = repel_steiner_points(tree, [(0.0, 0.0), (1000.0, 0.0)], radius_m=200.0)
    pt = result.steiner_points["steiner:0"]
    dist_to_t0 = math.hypot(pt[0], pt[1])
    dist_to_t1 = math.hypot(pt[0]-1000.0, pt[1])
    assert dist_to_t0 >= 200.0 - 1e-6
    assert dist_to_t1 >= 200.0 - 1e-6


def test_radius_recomputes_edge_lengths():
    sp = {"steiner:0": (50.0, 0.0)}
    tree = _make_tree(sp, [("terminal:0", "steiner:0", (0.0, 0.0), (50.0, 0.0))])
    original_length = tree.length_m
    result = repel_steiner_points(tree, [(0.0, 0.0)], radius_m=200.0)
    assert result.length_m > original_length
    expected = math.hypot(result.steiner_points["steiner:0"][0], result.steiner_points["steiner:0"][1])
    assert abs(result.length_m - expected) < 1e-6


def test_radius_empty_tree_unchanged():
    tree = SteinerTreeResult(edges=[], steiner_points={}, length_m=0.0)
    result = repel_steiner_points(tree, [(0.0, 0.0)], radius_m=100.0)
    assert result is tree


def test_radius_no_steiner_points_unchanged():
    tree = SteinerTreeResult(
        edges=[("terminal:0", "terminal:1", (0.0, 0.0), (100.0, 0.0))],
        steiner_points={},
        length_m=100.0,
    )
    result = repel_steiner_points(tree, [(0.0, 0.0), (100.0, 0.0)], radius_m=50.0)
    assert result is tree
