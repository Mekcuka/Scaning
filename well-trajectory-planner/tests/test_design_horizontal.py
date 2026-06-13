"""Tests for horizontal (heel-toe) trajectory design."""

from well_trajectory.design import design_horizontal
from well_trajectory.schemas import ConnectorPoint, HorizontalDesignRequest


def test_design_horizontal_concatenates_segments():
    req = HorizontalDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        heel=ConnectorPoint(northing=500, easting=200, tvd=2500, inc=90, azi=90),
        toe=ConnectorPoint(northing=500, easting=1200, tvd=2500, inc=90, azi=90),
        step_m=30,
    )
    result = design_horizontal(req)
    assert len(result.stations) >= 3
    mds = [s.md for s in result.stations]
    assert mds == sorted(mds)
    assert result.max_dls >= 0
    assert result.geometry.length_m > 0
    hold = [s for s in result.stations if s.e >= 200 and s.e <= 1200 and s.tvd > 2400]
    assert hold
    assert all(abs(s.tvd - 2500) < 1.0 for s in hold)
    assert all(abs(s.inc - 90) < 1.0 for s in hold)
