"""Tests for auto bootstrap of pad_wells_local_json in trajectory workflows."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models import InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import LINKED_PAD_ID, TVD_M
from app.services.well_trajectory.pad_wells_bootstrap import (
    ensure_pad_wells_local_on_object,
    required_well_count_from_bottomholes,
    trajectory_stub_well_count,
)
from app.services.well_trajectory.service import generate_trajectories_from_layout

pytest.importorskip("well_trajectory")
pytest.importorskip("pad_earthwork")


def _pad(**props) -> InfrastructureObject:
    return InfrastructureObject(
        id=uuid4(),
        layer_id=uuid4(),
        name="Куст-1",
        subtype="oil_pad",
        category="pad",
        geometry={"type": "Point", "coordinates": [37.62, 55.76]},
        longitude=37.62,
        latitude=55.76,
        properties=props,
    )


def test_required_well_count_from_six_unassigned_nnb():
    pad = _pad(pad_well_count=1)
    bottomholes = [
        InfrastructureObject(
            id=uuid4(),
            layer_id=pad.layer_id,
            name=f"BH-{i}",
            subtype="well_bottomhole_nnb",
            category="well",
            geometry={"type": "Point", "coordinates": [37.62, 55.76]},
            longitude=37.62,
            latitude=55.76,
            properties={LINKED_PAD_ID: str(pad.id), TVD_M: 1500},
        )
        for i in range(6)
    ]
    assert required_well_count_from_bottomholes(pad, bottomholes) == 6


def test_ensure_pad_wells_local_generates_from_well_count():
    pad = _pad(pad_well_count=3)
    wells, auto = ensure_pad_wells_local_on_object(pad, min_well_count=1)
    assert auto is True
    assert len(wells) == 3
    assert pad.properties is not None
    assert len(pad.properties.get("pad_wells_local_json") or []) == 3


def test_ensure_pad_wells_local_expands_when_bottomholes_need_more():
    pad = _pad(
        pad_wells_local_json=[{"east_m": 0.0, "north_m": 0.0}],
        pad_well_count=1,
    )
    wells, auto = ensure_pad_wells_local_on_object(pad, min_well_count=6)
    assert auto is True
    assert len(wells) == 6


def test_generate_from_layout_without_saved_sketch():
    pad = _pad(pad_well_count=2)
    response = generate_trajectories_from_layout(pad)
    assert len(response.trajectories) == 2
    assert pad.properties is not None
    assert len(pad.properties.get("pad_wells_local_json") or []) == 2


def test_trajectory_stub_well_count_prefers_linked_bottomholes_over_pad_well_count():
    pad = _pad(pad_well_count=8)
    bottomholes = [
        InfrastructureObject(
            id=uuid4(),
            layer_id=pad.layer_id,
            name="GS-1",
            subtype="well_bottomhole_gs",
            category="well",
            geometry={"type": "LineString", "coordinates": [[37.62, 55.76], [37.621, 55.76]]},
            longitude=37.62,
            latitude=55.76,
            properties={LINKED_PAD_ID: str(pad.id), TVD_M: 2000},
        ),
        InfrastructureObject(
            id=uuid4(),
            layer_id=pad.layer_id,
            name="GS-2",
            subtype="well_bottomhole_gs",
            category="well",
            geometry={"type": "LineString", "coordinates": [[37.62, 55.761], [37.621, 55.761]]},
            longitude=37.62,
            latitude=55.761,
            properties={LINKED_PAD_ID: str(pad.id), TVD_M: 2000},
        ),
    ]
    assert trajectory_stub_well_count(pad, bottomholes) == 2


def test_generate_from_layout_uses_linked_bottomhole_count():
    pad = _pad(
        pad_well_count=8,
        pad_wells_local_json=[{"east_m": float(i * 9), "north_m": 0.0} for i in range(8)],
    )
    bottomholes = [
        InfrastructureObject(
            id=uuid4(),
            layer_id=pad.layer_id,
            name=f"BH-{i}",
            subtype="well_bottomhole_nnb",
            category="well",
            geometry={"type": "Point", "coordinates": [37.62, 55.76]},
            longitude=37.62,
            latitude=55.76,
            properties={LINKED_PAD_ID: str(pad.id), TVD_M: 1500},
        )
        for i in range(2)
    ]
    response = generate_trajectories_from_layout(pad, bottomholes=bottomholes)
    assert len(response.trajectories) == 2
    assert len(pad.properties.get("pad_wells_local_json") or []) == 2


def test_ensure_pad_wells_local_trims_to_exact_count():
    pad = _pad(
        pad_well_count=8,
        pad_wells_local_json=[{"east_m": float(i * 9), "north_m": 0.0} for i in range(8)],
    )
    wells, changed = ensure_pad_wells_local_on_object(pad, exact_well_count=2)
    assert changed is True
    assert len(wells) == 2
