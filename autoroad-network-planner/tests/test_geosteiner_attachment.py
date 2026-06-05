"""Preserve GeoSteiner backbone when capping terminal attachments."""

from __future__ import annotations

from network_planner.steiner.constraints import tree_respects_attachment_limits
from network_planner.steiner.geosteiner.parser import GeoSteinerSolution
from network_planner.steiner.geosteiner.solver import _tree_from_certificate, solve_steiner_tree_geosteiner
from network_planner.steiner.geosteiner import is_geosteiner_available
from network_planner.steiner.terminal_attach import apply_attachment_limits
import pytest

pytestmark = pytest.mark.skipif(
    not is_geosteiner_available(),
    reason="geosteiner not installed",
)


def test_geosteiner_adjustment_respects_limits_and_stays_connected():
    ids = ["a", "b", "c", "d"]
    pts = [(0.0, 0.0), (1000.0, 0.0), (1000.0, 1000.0), (0.0, 1000.0)]
    tree = solve_steiner_tree_geosteiner(ids, pts, normalize_leaves=True)
    limits = {gid: 800.0 for gid in ids}
    adjusted = apply_attachment_limits(tree, ids, pts, limits)
    assert tree_respects_attachment_limits(adjusted, ids, pts, limits)
    assert len(adjusted.steiner_points) >= 2


def test_certificate_steiners_not_collapsed_to_star():
    ids = ["a", "b", "c", "d"]
    pts = [(0.0, 0.0), (1000.0, 0.0), (1000.0, 1000.0), (0.0, 1000.0)]
    steiner = [(500.0, 711.324865405187), (500.0, 288.675134594813)]
    tree = _tree_from_certificate(
        ids,
        pts,
        GeoSteinerSolution(length_m=2732.0, steiner_points=steiner),
        length_m=2732.0,
    )
    limits = {gid: 400.0 for gid in ids}
    adjusted = apply_attachment_limits(tree, ids, pts, limits)
    assert "steiner:0" in adjusted.steiner_points or "steiner:1" in adjusted.steiner_points
    assert len(adjusted.steiner_points) >= 2
