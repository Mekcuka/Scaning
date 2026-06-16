"""Unit tests for welleng lateral design (kick-off → bottomhole)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models import InfrastructureObject
from app.services.well_trajectory.design_lateral import (
    design_lateral_xyz,
    kickoff_connector_point,
    parse_bottomhole_ref,
    target_connector_point,
)

pytestmark = pytest.mark.pywellgeo


def _pad(**overrides) -> InfrastructureObject:
    obj = InfrastructureObject(
        id=uuid4(),
        layer_id=uuid4(),
        name="Куст-1",
        category="point",
        subtype="oil_pad",
        geometry="POINT(37.62 55.74)",
        longitude=37.62,
        latitude=55.74,
        properties={"pad_nds_deg": 90.0},
    )
    if overrides:
        for key, value in overrides.items():
            setattr(obj, key, value)
    return obj


def _well_with_survey() -> dict:
    return {
        "well_index": 0,
        "name": "Скв-1",
        "azi_reference": "grid",
        "survey": {
            "source": "calculated",
            "stations": [
                {"md": 0, "inc": 0, "azi": 90, "tvd": 0, "n": 0, "e": 0},
                {"md": 500, "inc": 30, "azi": 90, "tvd": 450, "n": 200, "e": 0},
                {"md": 1000, "inc": 60, "azi": 90, "tvd": 800, "n": 400, "e": 0},
            ],
        },
    }


def _nnb_bottomhole(pad: InfrastructureObject, *, east: float = 500, north: float = 400) -> InfrastructureObject:
    from app.services.well_trajectory.coord_transform import local_to_lonlat

    lon, lat = local_to_lonlat(pad.longitude, pad.latitude, east, north)
    return InfrastructureObject(
        id=uuid4(),
        layer_id=uuid4(),
        name="Забой-2",
        category="point",
        subtype="well_bottomhole_nnb",
        geometry=f"POINT({lon} {lat})",
        longitude=lon,
        latitude=lat,
        properties={
            "well_bottomhole_tvd_m": 1500,
            "well_bottomhole_target_inc": 90,
            "well_bottomhole_target_azi": 90,
        },
    )


def test_parse_bottomhole_ref_heel_toe():
    uid = uuid4()
    obj_id, endpoint = parse_bottomhole_ref(f"{uid}:heel")
    assert obj_id == uid
    assert endpoint == "heel"
    obj_id2, endpoint2 = parse_bottomhole_ref(str(uid))
    assert obj_id2 == uid
    assert endpoint2 is None


def test_kickoff_connector_point_from_survey():
    pad = _pad()
    well = _well_with_survey()
    point = kickoff_connector_point(well, [0, 0, 0], pad=pad)
    assert point.tvd == pytest.approx(0, abs=1.0)
    assert point.inc == pytest.approx(0, abs=1.0)
    deep = kickoff_connector_point(well, [0, 400, -800], pad=pad)
    assert deep.tvd > 500
    assert deep.inc > 30


def test_design_lateral_xyz_nnb_produces_polyline():
    pad = _pad()
    well = _well_with_survey()
    bottomhole = _nnb_bottomhole(pad)
    result = design_lateral_xyz(
        pad,
        well,
        [0, 400, -800],
        bottomhole,
        step_m=30.0,
    )
    assert len(result.xyz) >= 3
    assert result.xyz[0] == [0, 400, -800]
    assert result.max_dls >= 0


def test_design_lateral_xyz_dls_design_parameter():
    pad = _pad()
    well = _well_with_survey()
    bottomhole = _nnb_bottomhole(pad)
    result = design_lateral_xyz(
        pad,
        well,
        [0, 400, -800],
        bottomhole,
        step_m=30.0,
        dls_design=6.0,
    )
    assert result.max_dls == pytest.approx(6.0, abs=0.1)


def test_target_connector_point_gs_line_toe():
    pad = _pad()
    from app.services.well_trajectory.coord_transform import local_to_lonlat

    heel_lon, heel_lat = local_to_lonlat(pad.longitude, pad.latitude, 100, 200)
    toe_lon, toe_lat = local_to_lonlat(pad.longitude, pad.latitude, 500, 200)
    gs = InfrastructureObject(
        id=uuid4(),
        layer_id=uuid4(),
        name="ГС-1",
        category="line",
        subtype="well_bottomhole_gs",
        geometry="LINESTRING(...)",
        longitude=heel_lon,
        latitude=heel_lat,
        end_longitude=toe_lon,
        end_latitude=toe_lat,
        properties={
            "well_bottomhole_heel_tvd_m": 1400,
            "well_bottomhole_toe_tvd_m": 1500,
        },
    )
    toe = target_connector_point(pad, gs, "toe")
    heel = target_connector_point(pad, gs, "heel")
    assert toe.tvd == 1500
    assert heel.tvd == 1400
    assert toe.easting > heel.easting
