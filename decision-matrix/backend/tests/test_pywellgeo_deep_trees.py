"""PyWellGeo getLast with deep tree branches."""

from __future__ import annotations

import pytest

from app.services.well_trajectory.pywellgeo_ops import build_last_response

pytestmark = pytest.mark.pywellgeo


def _deep_tree(depth: int) -> dict:
    node: dict = {"name": "main", "x": 0, "y": 0, "z": -100, "radius": 0.1, "perforated": False, "color": "black", "branches": []}
    for i in range(depth - 1, 0, -1):
        node = {
            "name": "main",
            "x": 0,
            "y": 0,
            "z": -float(i * 10),
            "radius": 0.1,
            "perforated": False,
            "color": "black",
            "branches": [node],
        }
    return node


def test_build_last_response_deep_tree():
    depth = 90
    props = {
        "pad_pywellgeo_settings_json": {"default_radius_m": 0.1},
        "pad_pywellgeo_trees_json": [
            {
                "well_index": 0,
                "tree": _deep_tree(depth),
                "source": "lateral",
            }
        ],
    }
    resp = build_last_response(props)
    assert len(resp.trees) == 1
    assert resp.trees[0]["well_index"] == 0
    assert resp.trees[0]["tree"]["name"] == "main"
