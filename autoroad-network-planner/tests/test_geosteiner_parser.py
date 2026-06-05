"""GeoSteiner output parsing and certificate reconstruction."""

from __future__ import annotations

import math
from pathlib import Path

import pytest

from network_planner.steiner.geosteiner import is_geosteiner_available
from network_planner.steiner.geosteiner.parser import GeoSteinerSolution, parse_bb_postscript
from network_planner.steiner.geosteiner.runner import run_efst_bb
from network_planner.steiner.geosteiner.solver import _tree_from_certificate
from network_planner.steiner.validate import leaf_degree_violations

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_parse_bb_postscript_unit_square():
    raw = (FIXTURES / "geosteiner_unit_square.ps").read_text(encoding="utf-8")
    sol = parse_bb_postscript(raw)
    assert sol.length_m == pytest.approx(2 + math.sqrt(3), rel=1e-6)
    assert len(sol.steiner_points) == 2


@pytest.mark.skipif(not is_geosteiner_available(), reason="geosteiner not installed")
def test_parse_bb_postscript_includes_certificate_edges():
    raw = run_efst_bb([(0, 0), (1000, 0), (1000, 1000), (0, 1000)])
    sol = parse_bb_postscript(raw)
    assert len(sol.certificate_edges) == 5
    assert len(sol.steiner_points) == 2


def test_tree_from_certificate_unit_square():
    ids = ["a", "b", "c", "d"]
    pts = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    steiner = [(0.211324865405187, 0.5), (0.788675134594813, 0.5)]
    solution = GeoSteinerSolution(
        length_m=2 + math.sqrt(3),
        steiner_points=steiner,
    )
    tree = _tree_from_certificate(ids, pts, solution, length_m=2 + math.sqrt(3))
    assert len(tree.steiner_points) == 2
    assert tree.length_m == pytest.approx(2 + math.sqrt(3), rel=1e-3)
    assert not tree.heuristic
    assert not leaf_degree_violations(tree.edges, set(ids))


@pytest.mark.skipif(not is_geosteiner_available(), reason="geosteiner not installed")
def test_geosteiner_terminals_are_degree_one():
    ids = ["a", "b", "c", "d"]
    pts = [(0.0, 0.0), (1000.0, 0.0), (1000.0, 1000.0), (0.0, 1000.0)]
    raw = run_efst_bb(pts)
    sol = parse_bb_postscript(raw)
    tree = _tree_from_certificate(ids, pts, sol, length_m=sol.length_m)
    assert not leaf_degree_violations(tree.edges, set(ids))
