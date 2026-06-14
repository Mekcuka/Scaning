"""Tests for pad placement trajectory design helpers."""

from __future__ import annotations

from app.services.pad_placement.schemas import PadPlacementParams
from app.services.pad_placement.trajectory_design import pad_placement_gs_entry_search_step_m


def test_pad_placement_gs_entry_search_step_adaptive_full():
    target = {
        "profile": "gs",
        "gs_entry_mode": "any",
        "heel_plan": {"north_m": 0.0, "east_m": 0.0},
        "plan": {"north_m": 0.0, "east_m": 1200.0},
    }
    step = pad_placement_gs_entry_search_step_m(
        target,
        params=PadPlacementParams(),
        settings_step_m=30.0,
        mode="full",
    )
    assert step == 120.0


def test_pad_placement_gs_entry_search_step_coarser_than_full():
    target = {
        "profile": "gs",
        "gs_entry_mode": "any",
        "heel_plan": {"north_m": 0.0, "east_m": 0.0},
        "plan": {"north_m": 0.0, "east_m": 800.0},
    }
    full = pad_placement_gs_entry_search_step_m(
        target,
        params=PadPlacementParams(),
        settings_step_m=30.0,
        mode="full",
    )
    coarse = pad_placement_gs_entry_search_step_m(
        target,
        params=PadPlacementParams(),
        settings_step_m=30.0,
        mode="coarse",
    )
    assert coarse > full


def test_pad_placement_gs_entry_search_step_respects_explicit_override():
    target = {
        "profile": "gs",
        "gs_entry_mode": "any",
        "heel_plan": {"north_m": 0.0, "east_m": 0.0},
        "plan": {"north_m": 0.0, "east_m": 1000.0},
    }
    step = pad_placement_gs_entry_search_step_m(
        target,
        params=PadPlacementParams(gs_entry_search_step_m=75.0),
        settings_step_m=30.0,
        mode="full",
    )
    assert step == 75.0
