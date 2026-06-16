"""Tests for project-wide clearance coordinate unification."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models import InfrastructureObject
from app.services.well_trajectory.clearance_coords import (
    all_pair_indices,
    collect_project_wells_for_clearance,
    intra_pad_pair_indices,
)


def _pad(lon: float, lat: float, trajectories: list[dict]) -> InfrastructureObject:
    return InfrastructureObject(
        id=uuid4(),
        name="Pad",
        subtype="oil_pad",
        longitude=lon,
        latitude=lat,
        properties={"pad_wells_trajectories_json": trajectories},
    )


def _well(well_index: int, east_offset: float = 0.0) -> dict:
    return {
        "well_index": well_index,
        "name": f"W{well_index}",
        "survey": {
            "stations": [
                {"md": 0, "inc": 0, "azi": 90, "n": 0, "e": east_offset, "tvd": 0},
                {"md": 500, "inc": 30, "azi": 90, "n": 200, "e": east_offset + 50, "tvd": 400},
                {"md": 2000, "inc": 90, "azi": 90, "n": 500, "e": east_offset + 800, "tvd": 2500},
            ]
        },
    }


def test_collect_project_wells_unifies_enu():
    pad_a = _pad(37.62, 55.76, [_well(0, 0), _well(1, 9)])
    pad_b = _pad(37.63, 55.77, [_well(0, 0)])
    collection = collect_project_wells_for_clearance([pad_a, pad_b])
    assert len(collection.surveys) == 3
    assert len(collection.meta) == 3
    assert collection.meta[0].well_key == f"{pad_a.id}:0"
    # Different pads → different E at same local offset after project transform
    assert collection.surveys[0]["e"] != collection.surveys[2]["e"]


def test_all_pair_indices_cross_pad():
    assert len(all_pair_indices(3)) == 3
    assert all_pair_indices(2) == [[0, 1]]


def test_intra_pad_pair_indices():
    from app.services.well_trajectory.clearance_coords import ProjectWellMeta

    pad_id = uuid4()
    meta = [
        ProjectWellMeta(pad_id, "A", 0, "a:0", "W0", "m", "grid"),
        ProjectWellMeta(pad_id, "A", 1, "a:1", "W1", "m", "grid"),
        ProjectWellMeta(uuid4(), "B", 0, "b:0", "W0", "m", "grid"),
    ]
    pairs = intra_pad_pair_indices(meta)
    assert pairs == [[0, 1]]


def test_collect_skips_stub_wells_for_clearance():
    trajectories = []
    for i in range(4):
        if i < 2:
            stations = [
                {"md": 0, "inc": 0, "azi": 90, "n": 0, "e": i * 9, "tvd": 0},
                {"md": 500, "inc": 30, "azi": 90, "n": 200, "e": i * 9 + 50, "tvd": 400},
                {"md": 2000, "inc": 90, "azi": 90, "n": 500, "e": i * 9 + 800, "tvd": 2500},
            ]
            src = "calculated"
        else:
            stations = [
                {"md": 0, "inc": 0, "azi": 90, "n": 0, "e": i * 9, "tvd": 0},
                {"md": 50, "inc": 0, "azi": 90, "n": 0, "e": i * 9, "tvd": 50},
            ]
            src = "stub"
        trajectories.append(
            {"well_index": i, "name": f"W{i}", "survey": {"source": src, "stations": stations}}
        )
    pad = _pad(37.62, 55.76, trajectories)
    collection = collect_project_wells_for_clearance([pad])
    assert len(collection.surveys) == 2
    assert len(collection.meta) == 2
    assert len(collection.skips) == 2
    assert intra_pad_pair_indices(collection.meta) == [[0, 1]]
