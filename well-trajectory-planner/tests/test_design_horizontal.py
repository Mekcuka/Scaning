"""Tests for horizontal (heel-toe) trajectory design."""

from well_trajectory.design import design_horizontal
from well_trajectory.schemas import ConnectorPoint, HorizontalDesignRequest


def test_design_horizontal_concatenates_segments():
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        entry_mode="heel",
    )
    result = design_horizontal(req)
    assert len(result.stations) >= 3
    mds = [s.md for s in result.stations]
    assert mds == sorted(mds)
    assert result.max_dls >= 0
    assert result.geometry.length_m > 0
    assert result.entry_mode == "heel"
    assert result.entry_offset_m == 0.0
    hold = [s for s in result.stations if s.e >= 200 and s.e <= 1200 and s.tvd > 2400]
    assert hold
    assert all(abs(s.tvd - 2500) < 1.0 for s in hold)
    assert all(abs(s.inc - 90) < 1.0 for s in hold)


def test_design_horizontal_toe_entry_has_hold_to_heel():
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        entry_mode="toe",
    )
    result = design_horizontal(req)
    assert result.entry_mode == "toe"
    assert len(result.stations) >= 3
    assert result.geometry.length_m > 0
    assert result.entry_offset_m == 1000.0
    hold = [s for s in result.stations if 200 <= s.e <= 1200 and s.tvd > 2400]
    assert hold
    assert all(abs(s.inc - 90) < 2.0 for s in hold)


def test_design_horizontal_toe_and_heel_comparable_quality():
    base = dict(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        inc_heel=90.0,
    )
    heel = design_horizontal(HorizontalDesignRequest(**base, entry_mode="heel"))
    toe = design_horizontal(HorizontalDesignRequest(**base, entry_mode="toe"))
    assert abs(heel.max_dls - toe.max_dls) < 5.0
    toe_heel = min(toe.stations, key=lambda s: abs(s.e - 200))
    assert abs(toe_heel.e - 200) < 30
    assert abs(toe_heel.tvd - 2500) < 10


def test_design_horizontal_any_picks_entry():
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=100,
        entry_mode="any",
        entry_search_step_m=100,
    )
    result = design_horizontal(req)
    assert result.entry_mode == "any"
    assert result.entry_plan is not None
    assert (result.entry_search_evaluated or 0) >= 1


def test_design_horizontal_entry_matches_hold_azi_at_heel():
    """Approach segment ends with inc/azi of horizontal hold, not wellhead azimuth."""
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=0),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=0),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=0),
        step_m=30,
        entry_mode="heel",
        inc_heel=90.0,
    )
    result = design_horizontal(req)
    entry_station = min(result.stations, key=lambda s: abs(s.e - 200))
    assert abs(entry_station.inc - 90) < 2.0
    azi_delta = (entry_station.azi - 90 + 180) % 360 - 180
    assert abs(azi_delta) < 2.0


def test_design_horizontal_interior_entry_covers_heel_and_toe():
    """Mid-line entry drills full lateral (entry→toe→heel), not only to toe."""
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        entry_mode="any",
        entry_search_step_m=500,
    )
    from well_trajectory.design import design_horizontal_at_offset

    result = design_horizontal_at_offset(req, 500.0)
    assert result.entry_offset_m == 500.0
    heel_near = min(result.stations, key=lambda s: abs(s.e - 200))
    toe_near = min(result.stations, key=lambda s: abs(s.e - 1200))
    assert abs(heel_near.e - 200) < 30
    assert abs(toe_near.e - 1200) < 30
    assert abs(heel_near.tvd - 2500) < 10
    assert abs(toe_near.tvd - 2500) < 10


def test_design_horizontal_any_prefers_endpoint_over_partial_lateral():
    """With full lateral at interior entries, min MD should match heel or toe quality."""
    base = dict(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        inc_heel=90.0,
    )
    heel = design_horizontal(HorizontalDesignRequest(**base, entry_mode="heel"))
    any_result = design_horizontal(
        HorizontalDesignRequest(**base, entry_mode="any", entry_search_step_m=100)
    )
    assert any_result.entry_mode == "any"
    assert abs(any_result.geometry.length_m - heel.geometry.length_m) < 50


def test_design_horizontal_dual_tvd_sloping_hold():
    """Heel/toe TVD differ: hold follows TVD ramp without failing to design."""
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2400, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        entry_mode="heel",
        inc_heel=90.0,
    )
    result = design_horizontal(req)
    assert len(result.stations) >= 3
    toe_near = [s for s in result.stations if s.e >= 1150]
    assert toe_near
    assert abs(toe_near[-1].tvd - 2500) < 10
    heel_near = [s for s in result.stations if 180 <= s.e <= 220 and s.tvd > 2000]
    assert heel_near
    assert abs(heel_near[0].tvd - 2400) < 50
