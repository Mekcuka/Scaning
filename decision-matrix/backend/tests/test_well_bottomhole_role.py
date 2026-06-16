"""Tests for well bottomhole main/lateral role chain."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models import InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import (
    LINKED_PAD_ID,
    PARENT_ID,
    WELL_INDEX,
    apply_lateral_inheritance_from_parent,
    is_lateral_bottomhole,
    is_main_bottomhole,
    read_bottomhole_role,
)
from app.services.well_trajectory.bottomhole_sync import _assign_bottomhole_well_indices
from app.services.well_trajectory.pad_wells_bootstrap import slot_demand_from_bottomholes


def _main_bh(**props) -> InfrastructureObject:
    return InfrastructureObject(
        id=uuid4(),
        layer_id=uuid4(),
        name="Main",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [0, 0]},
        longitude=0,
        latitude=0,
        properties={"well_bottomhole_role": "main", **props},
    )


def test_read_bottomhole_role_defaults_to_main():
    assert read_bottomhole_role({}) == "main"
    assert is_main_bottomhole({})
    assert not is_lateral_bottomhole({})


def test_lateral_inherits_pad_and_well_index_from_parent():
    pad_id = uuid4()
    parent = _main_bh(**{LINKED_PAD_ID: str(pad_id), WELL_INDEX: 2})
    merged = apply_lateral_inheritance_from_parent(
        {"well_bottomhole_role": "lateral", PARENT_ID: str(parent.id)},
        parent,
    )
    assert merged[LINKED_PAD_ID] == str(pad_id)
    assert merged[WELL_INDEX] == 2


def test_assign_well_index_lateral_follows_parent():
    pad_id = uuid4()
    main = _main_bh(**{LINKED_PAD_ID: str(pad_id), WELL_INDEX: 1})
    lateral = InfrastructureObject(
        id=uuid4(),
        layer_id=main.layer_id,
        name="Lat",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [0, 0]},
        longitude=0,
        latitude=0,
        properties={
            "well_bottomhole_role": "lateral",
            PARENT_ID: str(main.id),
        },
    )
    index_map = _assign_bottomhole_well_indices([main, lateral])
    assert index_map[main.id] == 1
    assert index_map[lateral.id] == 1


def test_slot_demand_ignores_lateral_bottomholes():
    pad_id = uuid4()
    main = _main_bh(**{LINKED_PAD_ID: str(pad_id)})
    lateral = InfrastructureObject(
        id=uuid4(),
        layer_id=main.layer_id,
        name="Lat",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [0, 0]},
        longitude=0,
        latitude=0,
        properties={"well_bottomhole_role": "lateral", PARENT_ID: str(main.id)},
    )
    assert slot_demand_from_bottomholes([main, lateral]) == 1
