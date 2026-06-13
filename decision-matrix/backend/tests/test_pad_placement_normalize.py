"""Tests for pad placement bottomhole normalization."""

from __future__ import annotations

from uuid import uuid4

from app.services.pad_placement.normalize import normalize_bottomholes
from app.services.pad_placement.schemas import BottomholeSnapshot
from app.services.well_trajectory.bottomhole_properties import GS_HEEL_ID, TVD_M


def _snap(subtype: str, *, tvd: float = 2000.0, gs_heel: str | None = None) -> BottomholeSnapshot:
    props = {TVD_M: tvd}
    if gs_heel:
        props[GS_HEEL_ID] = gs_heel
    sid = uuid4()
    return BottomholeSnapshot(
        id=sid,
        subtype=subtype,
        name=subtype,
        longitude=37.62,
        latitude=55.76,
        properties=props,
    )


def test_normalize_two_nnb_and_one_gs():
    nnb1 = _snap("well_bottomhole_nnb")
    nnb2 = _snap("well_bottomhole_nnb", tvd=2100)
    heel = _snap("well_bottomhole_gs_heel", tvd=1800)
    toe = BottomholeSnapshot(
        id=uuid4(),
        subtype="well_bottomhole_gs_toe",
        name="toe",
        longitude=37.621,
        latitude=55.761,
        properties={GS_HEEL_ID: str(heel.id), TVD_M: 1800},
    )
    logical, warnings = normalize_bottomholes([nnb1, nnb2, heel, toe])
    assert not warnings
    assert len(logical) == 3
    profiles = {lw.profile for lw in logical}
    assert profiles == {"nnb", "gs"}


def test_normalize_rejects_gs_toe_without_heel():
    toe = _snap("well_bottomhole_gs_toe")
    logical, warnings = normalize_bottomholes([toe])
    assert not logical
    assert warnings
