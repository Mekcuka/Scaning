"""PyWellGeo add-branch JSON serialization with deep main-bore chains."""

from __future__ import annotations

import json

from app.services.well_trajectory.pywellgeo_public import add_branch_response_json


def _deep_tree(depth: int) -> dict:
    node: dict = {
        "name": "main",
        "x": 0,
        "y": 0,
        "z": -100,
        "radius": 0.1,
        "perforated": False,
        "color": "black",
        "branches": [],
    }
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


def test_add_branch_response_json_deep_tree():
    depth = 90
    record = {
        "well_index": 0,
        "name": "Скв-1",
        "tree": _deep_tree(depth),
        "source": "lateral",
    }
    # Pydantic model_dump may hit depth guard (version-dependent); public JSON path must not.
    payload = add_branch_response_json(record, ["max DLS lateral: 2.50 °/30m"])
    text = json.dumps(payload)
    assert payload["tree"]["well_index"] == 0
    assert payload["warnings"] == ["max DLS lateral: 2.50 °/30m"]
    assert '"name": "main"' in text
