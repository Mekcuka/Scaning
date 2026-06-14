"""Unit tests for pad placement in-memory evaluation helpers."""

from __future__ import annotations

from uuid import uuid4

from app.services.pad_placement.evaluate import snapshot_to_bottomhole
from app.services.pad_placement.schemas import BottomholeSnapshot
from app.services.well_trajectory.bottomhole_properties import read_gs_line_endpoints


def test_snapshot_to_bottomhole_preserves_gs_line_endpoints():
    snap = BottomholeSnapshot(
        id=uuid4(),
        subtype="well_bottomhole_gs",
        name="GS-1",
        longitude=37.621,
        latitude=55.761,
        end_longitude=37.622,
        end_latitude=55.762,
        properties={"well_bottomhole_tvd_m": 2000.0},
    )
    obj = snapshot_to_bottomhole(snap, well_index=0)
    assert obj.end_longitude == 37.622
    assert obj.end_latitude == 55.762
    assert read_gs_line_endpoints(obj) == (37.621, 55.761, 37.622, 55.762)


def test_snapshot_to_bottomhole_nnb_has_no_endpoints():
    snap = BottomholeSnapshot(
        id=uuid4(),
        subtype="well_bottomhole_nnb",
        name="NNB-1",
        longitude=37.62,
        latitude=55.76,
        properties={"well_bottomhole_tvd_m": 1500.0},
    )
    obj = snapshot_to_bottomhole(snap)
    assert obj.end_longitude is None
    assert obj.end_latitude is None
