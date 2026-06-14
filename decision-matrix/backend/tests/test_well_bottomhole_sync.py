"""Tests for well bottomhole infra sync and validation."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models import InfrastructureLayer, InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import (
    GS_ENTRY_MODE,
    GS_HEEL_ID,
    GS_HEEL_TVD_M,
    GS_TOE_TVD_M,
    LINKED_PAD_ID,
    TVD_M,
    WELL_INDEX,
    nearest_well_index,
)
from app.services.well_trajectory.coord_transform import local_to_lonlat
from app.services.well_trajectory.bottomhole_sync import (
    bottomholes_for_pad_from_objects,
    sync_bottomholes_to_trajectories,
)
from app.services.well_trajectory.trajectory_store import store_trajectories_json


def _pad() -> InfrastructureObject:
    pad_id = uuid4()
    return InfrastructureObject(
        id=pad_id,
        layer_id=uuid4(),
        name="Куст-1",
        subtype="oil_pad",
        category="pad",
        geometry={"type": "Point", "coordinates": [37.62, 55.76]},
        longitude=37.62,
        latitude=55.76,
        properties={
            "pad_wells_local_json": [
                {"east_m": 0.0, "north_m": 0.0},
                {"east_m": 9.0, "north_m": 0.0},
            ],
            "pad_wells_trajectories_json": [
                {"well_index": 0, "name": "Скв-1", "survey": {"stations": [{"n": 0, "e": 0, "tvd": 0, "inc": 0, "azi": 90}]}},
                {"well_index": 1, "name": "Скв-2", "survey": {"stations": [{"n": 0, "e": 9, "tvd": 0, "inc": 0, "azi": 90}]}},
            ],
        },
    )


def test_nearest_well_index_picks_closest_wellhead():
    pad = _pad()
    lon, lat = local_to_lonlat(float(pad.longitude), float(pad.latitude), 0.5, 0.0)
    idx = nearest_well_index(pad, lon, lat)
    assert idx == 0


def test_sync_nnb_bottomhole_to_target():
    pad = _pad()
    bh = InfrastructureObject(
        id=uuid4(),
        layer_id=pad.layer_id,
        name="BH-1",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [37.621, 55.761]},
        longitude=37.621,
        latitude=55.761,
        properties={
            LINKED_PAD_ID: str(pad.id),
            WELL_INDEX: 0,
            TVD_M: 1500,
        },
    )
    trajectories, warnings = sync_bottomholes_to_trajectories(pad, [bh])
    assert not warnings
    assert trajectories[0]["target"]["profile"] == "nnb"
    assert trajectories[0]["target"]["tvd_m"] == 1500
    assert trajectories[0]["target"]["inc"] == 360.0


def test_sync_uses_pad_default_tvd_when_bottomhole_has_no_tvd():
    pad = _pad()
    pad.properties["well_trajectory_default_tvd_m"] = 2200.0
    bh = InfrastructureObject(
        id=uuid4(),
        layer_id=pad.layer_id,
        name="BH-no-tvd",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [37.621, 55.761]},
        longitude=37.621,
        latitude=55.761,
        properties={
            LINKED_PAD_ID: str(pad.id),
            WELL_INDEX: 0,
        },
    )
    trajectories, warnings = sync_bottomholes_to_trajectories(pad, [bh])
    assert not warnings
    assert trajectories[0]["target"]["tvd_m"] == 2200.0


def test_sync_assigns_sequential_indices_for_unassigned_nnb():
    pad = _pad()
    pad.properties["pad_wells_local_json"].append({"east_m": 18.0, "north_m": 0.0})
    pad.properties["pad_wells_trajectories_json"].append(
        {
            "well_index": 2,
            "name": "Скв-3",
            "survey": {"stations": [{"n": 0, "e": 18, "tvd": 0, "inc": 0, "azi": 90}]},
        }
    )
    bottomholes = []
    for i in range(3):
        bottomholes.append(
            InfrastructureObject(
                id=uuid4(),
                layer_id=pad.layer_id,
                name=f"BH-{i + 1}",
                subtype="well_bottomhole_nnb",
                category="well",
                geometry={"type": "Point", "coordinates": [37.621, 55.761]},
                longitude=37.621,
                latitude=55.761,
                properties={LINKED_PAD_ID: str(pad.id), TVD_M: 1500},
            )
        )
    trajectories, warnings = sync_bottomholes_to_trajectories(pad, bottomholes)
    assert not any("дубликат" in w.lower() for w in warnings)
    assert trajectories[0]["target"]["profile"] == "nnb"
    assert trajectories[1]["target"]["profile"] == "nnb"
    assert trajectories[2]["target"]["profile"] == "nnb"


def test_bottomholes_for_pad_includes_gs_toe_without_pad_link():
    pad = _pad()
    heel_id = uuid4()
    toe_id = uuid4()
    heel = InfrastructureObject(
        id=heel_id,
        layer_id=pad.layer_id,
        name="Heel",
        subtype="well_bottomhole_gs_heel",
        category="well",
        properties={LINKED_PAD_ID: str(pad.id), WELL_INDEX: 0},
    )
    toe = InfrastructureObject(
        id=toe_id,
        layer_id=pad.layer_id,
        name="Toe",
        subtype="well_bottomhole_gs_toe",
        category="well",
        properties={GS_HEEL_ID: str(heel_id), WELL_INDEX: 0},
    )
    linked = bottomholes_for_pad_from_objects([heel, toe], pad.id)
    assert {o.id for o in linked} == {heel_id, toe_id}


def test_bottomholes_for_pad_includes_gs_heel_without_pad_link_when_toe_linked():
    pad = _pad()
    heel_id = uuid4()
    toe_id = uuid4()
    heel = InfrastructureObject(
        id=heel_id,
        layer_id=pad.layer_id,
        name="Heel",
        subtype="well_bottomhole_gs_heel",
        category="well",
        properties={WELL_INDEX: 0},
    )
    toe = InfrastructureObject(
        id=toe_id,
        layer_id=pad.layer_id,
        name="Toe",
        subtype="well_bottomhole_gs_toe",
        category="well",
        properties={LINKED_PAD_ID: str(pad.id), GS_HEEL_ID: str(heel_id), WELL_INDEX: 0},
    )
    linked = bottomholes_for_pad_from_objects([heel, toe], pad.id)
    assert {o.id for o in linked} == {heel_id, toe_id}


def test_sync_gs_pair_to_target():
    pad = _pad()
    heel_id = uuid4()
    heel = InfrastructureObject(
        id=heel_id,
        layer_id=pad.layer_id,
        name="Heel",
        subtype="well_bottomhole_gs_heel",
        category="well",
        geometry={"type": "Point", "coordinates": [37.621, 55.761]},
        longitude=37.621,
        latitude=55.761,
        properties={LINKED_PAD_ID: str(pad.id), WELL_INDEX: 0, TVD_M: 2000, GS_ENTRY_MODE: "heel"},
    )
    toe = InfrastructureObject(
        id=uuid4(),
        layer_id=pad.layer_id,
        name="Toe",
        subtype="well_bottomhole_gs_toe",
        category="well",
        geometry={"type": "Point", "coordinates": [37.622, 55.761]},
        longitude=37.622,
        latitude=55.761,
        properties={
            LINKED_PAD_ID: str(pad.id),
            WELL_INDEX: 0,
            GS_HEEL_ID: str(heel_id),
            TVD_M: 2000,
        },
    )
    trajectories, warnings = sync_bottomholes_to_trajectories(pad, [heel, toe])
    assert any("without paired toe" not in w for w in warnings) or not warnings
    assert trajectories[0]["target"]["profile"] == "gs"
    assert "heel_plan" in trajectories[0]["target"]
    assert trajectories[0]["target"]["gs_entry_mode"] == "heel"


def test_sync_gs_target_default_entry_mode_any():
    pad = _pad()
    heel_id = uuid4()
    heel = InfrastructureObject(
        id=heel_id,
        layer_id=pad.layer_id,
        name="Heel",
        subtype="well_bottomhole_gs_heel",
        category="well",
        geometry={"type": "Point", "coordinates": [37.621, 55.761]},
        longitude=37.621,
        latitude=55.761,
        properties={LINKED_PAD_ID: str(pad.id), WELL_INDEX: 0, TVD_M: 2000},
    )
    toe = InfrastructureObject(
        id=uuid4(),
        layer_id=pad.layer_id,
        name="Toe",
        subtype="well_bottomhole_gs_toe",
        category="well",
        geometry={"type": "Point", "coordinates": [37.622, 55.761]},
        longitude=37.622,
        latitude=55.761,
        properties={LINKED_PAD_ID: str(pad.id), WELL_INDEX: 0, GS_HEEL_ID: str(heel_id), TVD_M: 2000},
    )
    trajectories, _ = sync_bottomholes_to_trajectories(pad, [heel, toe])
    assert trajectories[0]["target"]["gs_entry_mode"] == "any"


def test_sync_gs_pair_when_toe_has_no_pad_link():
    pad = _pad()
    heel_id = uuid4()
    heel = InfrastructureObject(
        id=heel_id,
        layer_id=pad.layer_id,
        name="Heel",
        subtype="well_bottomhole_gs_heel",
        category="well",
        geometry={"type": "Point", "coordinates": [37.621, 55.761]},
        longitude=37.621,
        latitude=55.761,
        properties={LINKED_PAD_ID: str(pad.id), WELL_INDEX: 0, TVD_M: 2000},
    )
    toe = InfrastructureObject(
        id=uuid4(),
        layer_id=pad.layer_id,
        name="Toe",
        subtype="well_bottomhole_gs_toe",
        category="well",
        geometry={"type": "Point", "coordinates": [37.622, 55.761]},
        longitude=37.622,
        latitude=55.761,
        properties={GS_HEEL_ID: str(heel_id), WELL_INDEX: 0, TVD_M: 2000},
    )
    linked = bottomholes_for_pad_from_objects([heel, toe], pad.id)
    trajectories, warnings = sync_bottomholes_to_trajectories(pad, linked)
    assert not warnings
    assert trajectories[0]["target"]["profile"] == "gs"


def test_sync_clears_designed_trajectory_when_bottomhole_removed():
    pad = _pad()
    bh = InfrastructureObject(
        id=uuid4(),
        layer_id=pad.layer_id,
        name="BH-1",
        subtype="well_bottomhole_nnb",
        category="well",
        geometry={"type": "Point", "coordinates": [37.621, 55.761]},
        longitude=37.621,
        latitude=55.761,
        properties={LINKED_PAD_ID: str(pad.id), WELL_INDEX: 0, TVD_M: 1500},
    )
    trajectories, _ = sync_bottomholes_to_trajectories(pad, [bh])
    trajectories[0]["survey"] = {
        "source": "calculated",
        "stations": [
            {"md": 0, "inc": 0, "azi": 90, "tvd": 0, "n": 0, "e": 0},
            {"md": 1500, "inc": 90, "azi": 90, "tvd": 1500, "n": 0, "e": 800},
        ],
    }
    trajectories[0]["geometry"] = {"length_m": 1500, "md_max": 1500, "tvd_max": 1500}
    trajectories[0]["design"] = {"source": "bottomhole_object", "profile": "connector"}
    pad.properties = store_trajectories_json(pad.properties, trajectories)

    cleared, _warnings = sync_bottomholes_to_trajectories(pad, [])
    assert "target" not in cleared[0]
    assert cleared[0]["survey"]["source"] == "stub"
    assert len(cleared[0]["survey"]["stations"]) == 2
    assert "geometry" not in cleared[0]


def test_sync_gs_unified_line_dual_tvd():
    pad = _pad()
    gs = InfrastructureObject(
        id=uuid4(),
        layer_id=pad.layer_id,
        name="GS line",
        subtype="well_bottomhole_gs",
        category="well",
        geometry={
            "type": "LineString",
            "coordinates": [[37.621, 55.761], [37.622, 55.761]],
        },
        longitude=37.621,
        latitude=55.761,
        end_longitude=37.622,
        end_latitude=55.761,
        properties={
            LINKED_PAD_ID: str(pad.id),
            WELL_INDEX: 0,
            TVD_M: 2000,
            GS_HEEL_TVD_M: 1800,
            GS_TOE_TVD_M: 2100,
            GS_ENTRY_MODE: "toe",
        },
    )
    trajectories, warnings = sync_bottomholes_to_trajectories(pad, [gs])
    assert not warnings
    target = trajectories[0]["target"]
    assert target["profile"] == "gs"
    assert target["heel_tvd_m"] == 1800
    assert target["toe_tvd_m"] == 2100
    assert target["tvd_m"] == 2100
    assert target["gs_entry_mode"] == "toe"


def test_sync_trims_trajectories_when_wells_local_shrinks():
    pad = _pad()
    pad.properties["pad_wells_local_json"] = [{"east_m": 0.0, "north_m": 0.0}]
    trajectories, _ = sync_bottomholes_to_trajectories(pad, [])
    assert len(trajectories) == 1
