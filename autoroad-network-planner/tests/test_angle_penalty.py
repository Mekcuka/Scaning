"""Angle penalty in SteinerPy candidate graph."""

from __future__ import annotations

import math

import pytest

from network_planner.steiner.steinerpy import is_steinerpy_available
from network_planner.steiner.steinerpy.graph import build_candidate_graph
from network_planner.steiner.steinerpy.solver import solve_steiner_tree_steinerpy

pytestmark = pytest.mark.skipif(
    not is_steinerpy_available(),
    reason="steinerpy not installed",
)


def test_angle_penalty_changes_weight():
    ids = ["a", "b", "c"]
    pts = [(0.0, 0.0), (2000.0, 0.0), (1000.0, 1000.0)]
    limits = {gid: 300.0 for gid in ids}

    g0, _ = build_candidate_graph(ids, pts, attachment_limits=limits)
    g1, _ = build_candidate_graph(
        ids,
        pts,
        attachment_limits=limits,
        angle_target_deg=90.0,
        angle_penalty=1.0,
    )

    found_diff = False
    for a, b in g0.edges():
        w0 = g0[a][b]["weight"]
        w1 = g1[a][b]["weight"]
        if abs(w0 - w1) > 1e-6:
            found_diff = True
            assert w1 >= w0
    assert found_diff


@pytest.mark.parametrize("penalty", [0.0, 0.5, 1.5])
def test_solver_accepts_angle_options(penalty: float):
    ids = ["a", "b", "c"]
    pts = [(0.0, 0.0), (2000.0, 0.0), (1000.0, 1000.0)]
    tree = solve_steiner_tree_steinerpy(
        ids,
        pts,
        angle_target_deg=90.0,
        angle_penalty=penalty,
    )
    assert tree.length_m > 0
