"""Welleng connector from intermediate kick-off (not surface)."""

from well_trajectory.design import design_connector
from well_trajectory.schemas import ConnectorDesignRequest, ConnectorPoint


def test_design_connector_from_kickoff_not_surface():
    req = ConnectorDesignRequest(
        start=ConnectorPoint(northing=400, easting=0, tvd=800, inc=60, azi=90),
        end=ConnectorPoint(northing=400, easting=500, tvd=1500, inc=90, azi=90),
        step_m=30,
    )
    result = design_connector(req)
    assert len(result.stations) >= 3
    assert result.geometry.length_m > 0
    assert result.stations[0].n == 400
