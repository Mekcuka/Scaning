"""Tests for well layout auto-generation."""



from __future__ import annotations



import math

import pytest

from fastapi.testclient import TestClient



from pad_earthwork.api.app import app

from pad_earthwork.well_layout import (

    PadLayoutMargins,

    WellLayoutParams,

    WellLayoutValidationError,

    compute_well_positions_east_m,

    generate_pad_polygon_from_wells,

)





def test_single_well_positions():

    assert compute_well_positions_east_m(1, 4, 30.0, 10.0) == [0.0]





def test_four_wells_one_group():

    assert compute_well_positions_east_m(4, 4, 30.0, 10.0) == [0.0, 30.0, 60.0, 90.0]





def test_eight_wells_two_groups():

    assert compute_well_positions_east_m(8, 4, 30.0, 10.0) == [

        0.0,

        30.0,

        60.0,

        90.0,

        100.0,

        130.0,

        160.0,

        190.0,

    ]





def test_generate_four_wells_default_margins():

    params = WellLayoutParams(

        well_count=4,

        wells_per_group=4,

        well_spacing_m=30.0,

        group_spacing_m=10.0,

        rotation_deg=90.0,

    )

    result = generate_pad_polygon_from_wells(params)

    assert result.length_m == 20.0 + 90.0 + 20.0

    assert result.width_m == 15.0 + 15.0

    assert len(result.sketch.vertices) == 4

    assert len(result.wells_local) == 4

    assert result.wells_local[0].east_m == 0.0

    assert result.wells_local[0].north_m == 0.0

    assert result.wells_local[-1].east_m == 90.0

    assert result.wells_local[-1].north_m == pytest.approx(0.0, abs=0.01)

    assert result.footprint_area_m2 == pytest.approx(result.length_m * result.width_m)





def test_generate_default_nds_90():

    params = WellLayoutParams(

        well_count=4,

        wells_per_group=4,

        well_spacing_m=30.0,

        group_spacing_m=10.0,

    )

    assert params.rotation_deg == 90.0

    result = generate_pad_polygon_from_wells(params)

    assert result.rotation_deg == 90.0

    assert result.wells_local[-1].east_m == pytest.approx(90.0, abs=0.01)

    assert result.wells_local[-1].north_m == pytest.approx(0.0, abs=0.01)





def test_generate_nds_0_north():

    params = WellLayoutParams(

        well_count=2,

        wells_per_group=2,

        well_spacing_m=40.0,

        group_spacing_m=0.0,

        margins=PadLayoutMargins(left_m=10, bottom_m=5, top_m=5, end_m=10),

        rotation_deg=0.0,

    )

    result = generate_pad_polygon_from_wells(params)

    assert result.wells_local[1].east_m == pytest.approx(0.0, abs=0.01)

    assert result.wells_local[1].north_m == pytest.approx(40.0, abs=0.01)





def test_generate_nds_180_south():

    params = WellLayoutParams(

        well_count=2,

        wells_per_group=2,

        well_spacing_m=40.0,

        group_spacing_m=0.0,

        margins=PadLayoutMargins(left_m=10, bottom_m=5, top_m=5, end_m=10),

        rotation_deg=180.0,

    )

    result = generate_pad_polygon_from_wells(params)

    assert result.wells_local[1].east_m == pytest.approx(0.0, abs=0.01)

    assert result.wells_local[1].north_m == pytest.approx(-40.0, abs=0.01)





def test_generate_rotation_90():

    """NDS 90° = East: row along +East."""

    params = WellLayoutParams(

        well_count=2,

        wells_per_group=2,

        well_spacing_m=40.0,

        group_spacing_m=0.0,

        margins=PadLayoutMargins(left_m=10, bottom_m=5, top_m=5, end_m=10),

        rotation_deg=90.0,

    )

    result = generate_pad_polygon_from_wells(params)

    assert result.wells_local[1].east_m == pytest.approx(40.0, abs=0.01)

    assert result.wells_local[1].north_m == pytest.approx(0.0, abs=0.01)





def test_exceeds_500m_raises():

    params = WellLayoutParams(

        well_count=20,

        wells_per_group=20,

        well_spacing_m=30.0,

        group_spacing_m=0.0,

        margins=PadLayoutMargins(left_m=0, bottom_m=1, top_m=1, end_m=0),

        rotation_deg=0.0,

    )

    with pytest.raises(WellLayoutValidationError, match="500"):

        generate_pad_polygon_from_wells(params)





def test_api_generate_from_wells():

    client = TestClient(app)

    res = client.post(

        "/v1/sketch/generate-from-wells",

        json={

            "well_count": 4,

            "wells_per_group": 4,

            "well_spacing_m": 30,

            "group_spacing_m": 10,

            "margins": {"left_m": 20, "bottom_m": 15, "top_m": 15, "end_m": 20},

            "rotation_deg": 90,

        },

    )

    assert res.status_code == 200

    body = res.json()

    assert body["sketch"]["kind"] == "plan_polygon"

    assert len(body["wells_local"]) == 4

    assert body["length_m"] == 130.0





def test_api_validation_error():

    client = TestClient(app)

    res = client.post(

        "/v1/sketch/generate-from-wells",

        json={

            "well_count": 64,

            "wells_per_group": 4,

            "well_spacing_m": 30,

            "group_spacing_m": 10,

            "margins": {"left_m": 0, "bottom_m": 1, "top_m": 1, "end_m": 0},

        },

    )

    assert res.status_code == 400

