"""Terminals must always be tree leaves (degree 1)."""



from __future__ import annotations



import math



import pytest



from network_planner.steiner.geosteiner.parser import GeoSteinerSolution
from network_planner.steiner.geosteiner.solver import _tree_from_certificate

from network_planner.steiner.steinerpy import is_steinerpy_available

from network_planner.steiner.steinerpy.solver import solve_steiner_tree_steinerpy

from network_planner.steiner.types import SteinerTreeResult

from network_planner.steiner.validate import (

    leaf_degree_violations,

    normalize_terminal_leaves,

)





def test_normalize_splits_terminal_hub():

    tree = SteinerTreeResult(

        edges=[

            ("a", "b", (0.0, 0.0), (10.0, 0.0)),

            ("b", "c", (10.0, 0.0), (20.0, 0.0)),

        ],

        length_m=20.0,

    )

    fixed = normalize_terminal_leaves(tree, {"a", "b", "c"})

    assert not leaf_degree_violations(fixed.edges, {"a", "b", "c"})

    assert "steiner:hub:0" in fixed.steiner_points





def test_normalize_hub_offset_sets_terminal_hub_edge_length():

    tree = SteinerTreeResult(

        edges=[

            ("b", "a", (0.0, 0.0), (100.0, 0.0)),

            ("b", "c", (0.0, 0.0), (0.0, 100.0)),

        ],

        length_m=200.0,

    )

    offset_m = 3.0

    fixed = normalize_terminal_leaves(

        tree,

        {"a", "b", "c"},

        hub_offset_m=offset_m,

    )

    hub = fixed.steiner_points["steiner:hub:0"]

    assert hub != (0.0, 0.0)

    assert fixed.length_m == pytest.approx(200.0 + offset_m)

    for a, b, pta, ptb in fixed.edges:

        if a == "b" and b == "steiner:hub:0":

            assert math.hypot(pta[0] - ptb[0], pta[1] - ptb[1]) == pytest.approx(offset_m)

            break

    else:

        pytest.fail("expected terminal→hub edge")





def test_geosteiner_certificate_terminals_are_leaves():

    ids = ["a", "b", "c"]

    pts = [(0.0, 0.0), (10.0, 0.0), (20.0, 0.0)]

    tree = _tree_from_certificate(
        ids,
        pts,
        GeoSteinerSolution(length_m=20.0, steiner_points=[(5.0, 1.0)]),
        length_m=20.0,
    )

    assert not leaf_degree_violations(tree.edges, set(ids))





@pytest.mark.skipif(not is_steinerpy_available(), reason="steinerpy not installed")

@pytest.mark.parametrize("n", range(2, 13))

def test_steinerpy_terminals_are_leaves(n: int):

    ids = [f"t{i}" for i in range(n)]

    pts = [(float(i), float(i % 3)) for i in range(n)]

    tree = solve_steiner_tree_steinerpy(ids, pts)

    assert not leaf_degree_violations(tree.edges, set(ids))

