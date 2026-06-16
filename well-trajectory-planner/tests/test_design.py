"""Tests for welleng connector design."""

import pytest

from well_trajectory.design import design_connector
from well_trajectory.schemas import ConnectorDesignRequest, ConnectorPoint


def test_design_connector_returns_monotonic_md():
    req = ConnectorDesignRequest(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=90),
        end=ConnectorPoint(northing=500, easting=800, tvd=2500, inc=90, azi=270),
        step_m=30,
    )
    result = design_connector(req)
    assert len(result.stations) >= 2
    mds = [s.md for s in result.stations]
    assert mds == sorted(mds)
    assert result.max_dls >= 0
    assert result.geometry.length_m > 0
    assert result.geometry.md_max == mds[-1]


def test_design_connector_dls_design_affects_max_dls():
    base = dict(
        start=ConnectorPoint(northing=0, easting=0, tvd=0, inc=0, azi=0),
        end=ConnectorPoint(northing=500, easting=500, tvd=2000, inc=90, azi=45),
        step_m=30,
    )
    low = design_connector(ConnectorDesignRequest(**base, dls_design=1.5))
    high = design_connector(ConnectorDesignRequest(**base, dls_design=5.0))
    assert low.max_dls == pytest.approx(1.5, abs=0.5)
    assert high.max_dls == pytest.approx(5.0, abs=0.5)
    assert low.max_dls < high.max_dls
