"""Tests for horizontal (heel-toe) trajectory design."""

import math

from well_trajectory.design import (
    design_horizontal,
    design_horizontal_at_offset,
    gs_entry_endpoint_offsets,
)
from well_trajectory.schemas import ConnectorPoint, HorizontalDesignRequest


def _azi_delta_deg(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def test_design_horizontal_passes_dls_design_to_connector_segments(monkeypatch):
    import well_trajectory.design as design_mod

    captured: list[float] = []
    original = design_mod.design_connector

    def spy(request):
        captured.append(request.dls_design)
        return original(request)

    monkeypatch.setattr(design_mod, "design_connector", spy)
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        entry_mode="heel",
        dls_design=6.5,
    )
    design_horizontal(req)
    assert captured
    assert all(d == 6.5 for d in captured)


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
    assert result.entry_search_evaluated == 2
    assert result.entry_offset_m in (0.0, 1000.0)


def test_gs_entry_endpoint_offsets_returns_heel_and_toe_only():
    heel = ConnectorPoint(northing=0, easting=0, tvd=2500, inc=90, azi=90)
    toe = ConnectorPoint(northing=0, easting=1000, tvd=2500, inc=90, azi=90)
    assert gs_entry_endpoint_offsets(heel, toe) == [0.0, 1000.0]


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


def test_design_horizontal_interior_offset_snaps_to_endpoint():
    """Mid-line offset snaps to nearest endpoint — no entry→toe→heel U-turn."""
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        entry_mode="any",
        entry_search_step_m=500,
    )
    heel_result = design_horizontal_at_offset(req, 200.0)
    toe_result = design_horizontal_at_offset(req, 800.0)
    assert heel_result.entry_offset_m == 0.0
    assert toe_result.entry_offset_m == 1000.0
    assert heel_result.entry_mode == "heel"
    assert toe_result.entry_mode == "toe"


def test_design_horizontal_any_prefers_endpoint_over_partial_lateral():
    """Mode any compares only T1 and T3; result matches one of the endpoint designs."""
    base = dict(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
        inc_heel=90.0,
    )
    heel = design_horizontal(HorizontalDesignRequest(**base, entry_mode="heel"))
    toe = design_horizontal(HorizontalDesignRequest(**base, entry_mode="toe"))
    any_result = design_horizontal(
        HorizontalDesignRequest(**base, entry_mode="any", entry_search_step_m=100)
    )
    assert any_result.entry_mode == "any"
    assert any_result.entry_offset_m in (0.0, 1000.0)
    best_endpoint_md = min(heel.geometry.length_m, toe.geometry.length_m)
    assert abs(any_result.geometry.length_m - best_endpoint_md) < 1e-3


def test_no_180_azi_flip_at_toe_for_offset_lateral():
    """Oblique pad-to-lateral geometry: no ~180° azimuth jump at T3."""
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=9, tvd=0, inc=0, azi=0),
        heel=ConnectorPoint(northing=-39.5, easting=-491.3, tvd=1280.9, inc=90, azi=268.1),
        toe=ConnectorPoint(northing=-72.7, easting=-1492.8, tvd=1277.0, inc=90, azi=268.1),
        step_m=30,
        entry_mode="any",
        inc_heel=90.0,
        dls_design=3.0,
    )
    result = design_horizontal(req)
    assert result.entry_offset_m in (0.0, math.hypot(-33.2, -1001.5))
    toe_e, toe_n = -1492.8, -72.7
    near_toe = sorted(
        result.stations,
        key=lambda s: math.hypot(s.e - toe_e, s.n - toe_n),
    )[:5]
    for prev, nxt in zip(near_toe, near_toe[1:]):
        assert _azi_delta_deg(prev.azi, nxt.azi) < 90.0


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
