"""Tests for trajectory derived-state reset on pad persist."""

from __future__ import annotations

from app.services.well_trajectory.properties import (
    PAD_PYWELLGEO_TREES_JSON,
    WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT,
    WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON,
)
from app.services.well_trajectory.trajectory_store import (
    clear_pad_clearance,
    clear_pywellgeo_trees_for_wells,
    finalize_pad_trajectories,
    trajectory_changed_indices,
)


def test_clear_pad_clearance_strips_pad_and_well_level():
    props = {
        WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON: [{"well_a": 0, "well_b": 1}],
        WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT: "2026-01-01T00:00:00Z",
        "pad_wells_trajectories_json": [
            {"well_index": 0, "clearance": {"min_sf": 1.5}},
            {"well_index": 1, "clearance": {"min_sf": 2.0}},
        ],
    }
    out = clear_pad_clearance(props)
    assert WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON not in out
    assert WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT not in out
    for well in out["pad_wells_trajectories_json"]:
        assert "clearance" not in well


def test_clear_pywellgeo_trees_for_wells():
    props = {
        PAD_PYWELLGEO_TREES_JSON: [
            {"well_index": 0, "name": "Скв-1", "tree": {"name": "main", "branches": []}},
            {"well_index": 1, "name": "Скв-2", "tree": {"name": "main", "branches": []}},
        ],
    }
    out = clear_pywellgeo_trees_for_wells(props, {0})
    trees = out[PAD_PYWELLGEO_TREES_JSON]
    assert len(trees) == 1
    assert trees[0]["well_index"] == 1


def test_finalize_pad_trajectories_clears_derived_state():
    props = {
        WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT: "2026-01-01T00:00:00Z",
        PAD_PYWELLGEO_TREES_JSON: [
            {"well_index": 0, "name": "Скв-1", "tree": {"name": "main", "branches": []}},
        ],
    }
    trajectories = [{"well_index": 0, "clearance": {"min_sf": 1.2}}]
    out = finalize_pad_trajectories(
        props,
        trajectories,
        clear_clearance=True,
        clear_pywellgeo_indices={0},
    )
    assert WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT not in out
    assert PAD_PYWELLGEO_TREES_JSON not in out
    assert "clearance" not in out["pad_wells_trajectories_json"][0]


def test_trajectory_changed_indices_detects_target_and_survey():
    before = [
        {"well_index": 0, "target": {"tvd_m": 100}, "survey": {"stations": [{"md": 0}]}},
        {"well_index": 1, "survey": {"stations": [{"md": 0}]}},
    ]
    after_target = [
        {"well_index": 0, "target": {"tvd_m": 200}, "survey": {"stations": [{"md": 0}]}},
        {"well_index": 1, "survey": {"stations": [{"md": 0}]}},
    ]
    after_survey = [
        {"well_index": 0, "target": {"tvd_m": 100}, "survey": {"stations": [{"md": 0}, {"md": 100}]}},
        {"well_index": 1, "survey": {"stations": [{"md": 0}]}},
    ]
    assert trajectory_changed_indices(before, after_target) == {0}
    assert trajectory_changed_indices(before, after_survey) == {0}
    assert trajectory_changed_indices(before, before) == set()


def test_props_for_infra_merge_nulls_removed_clearance_keys():
    from app.services.well_trajectory.api_common import _props_for_infra_merge

    old = {
        "well_trajectory_clearance_computed_at": "2026-01-01T00:00:00Z",
        "well_trajectory_clearance_pairs_json": [{"min_sf": 1.0}],
        "pad_wells_trajectories_json": [],
    }
    finalized = {"pad_wells_trajectories_json": [{"well_index": 0}]}
    patch = _props_for_infra_merge(old, finalized)
    assert patch["well_trajectory_clearance_computed_at"] is None
    assert patch["well_trajectory_clearance_pairs_json"] is None

    from app.geo.render_3d_properties import merge_infra_properties_patch

    merged = merge_infra_properties_patch(old, patch)
    assert "well_trajectory_clearance_computed_at" not in merged
    assert "well_trajectory_clearance_pairs_json" not in merged
