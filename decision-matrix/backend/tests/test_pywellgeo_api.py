"""BFF tests for PyWellGeo pad properties."""

from __future__ import annotations

import pytest

from app.services.well_trajectory.pywellgeo_ops import (
    build_last_response,
    compute_tree,
    merge_trees_put,
    plot_data_for_well,
    sync_from_survey,
)
from app.services.well_trajectory.pywellgeo_schemas import (
    PyWellGeoSettings,
    PyWellGeoTreeRecord,
    PyWellGeoTreesPutRequest,
)
from app.services.well_trajectory.pywellgeo_store import PAD_PYWELLGEO_TREES_JSON

pytestmark = pytest.mark.pywellgeo


def test_build_last_response_defaults():
    resp = build_last_response({})
    assert resp.settings.default_radius_m == 0.10795
    assert resp.trees == []


def test_merge_trees_put():
    tree = PyWellGeoTreeRecord(
        well_index=0,
        tree={
            "x": 0,
            "y": 0,
            "z": 0,
            "radius": 0.1,
            "perforated": False,
            "color": "black",
            "name": "main",
            "branches": [],
        },
    )
    body = PyWellGeoTreesPutRequest(
        settings=PyWellGeoSettings(default_radius_m=0.2),
        trees=[tree],
    )
    props = merge_trees_put({}, body)
    assert PAD_PYWELLGEO_TREES_JSON in props
    assert props["pad_pywellgeo_settings_json"]["default_radius_m"] == 0.2


def test_sync_from_survey_requires_stations():
    props = {
        "pad_wells_trajectories_json": [
            {
                "well_index": 0,
                "survey": {
                    "stations": [{"md": 0, "tvd": 0, "n": 0, "e": 0, "inc": 0, "azi": 0}],
                },
            }
        ]
    }
    with pytest.raises(ValueError, match="at least two"):
        sync_from_survey(props, well_index=0, radius_m=0.1)


def test_compute_and_plot_with_tree_override():
    tree = {
        "x": 0,
        "y": 0,
        "z": 0,
        "radius": 0.1,
        "perforated": False,
        "color": "black",
        "name": "main",
        "branches": [
            {
                "x": 0,
                "y": 0,
                "z": -100,
                "radius": 0.1,
                "perforated": False,
                "color": "black",
                "name": "main",
                "branches": [],
            }
        ],
    }
    props = {"pad_pywellgeo_trees_json": []}
    comp = compute_tree(props, well_index=0, tsurface_c=10.0, tgrad_c_per_m=0.03, tree_override=tree)
    assert comp.tree.geometry is not None
    plot = plot_data_for_well(props, 0, tree_override=tree)
    assert len(plot.segments) >= 1
