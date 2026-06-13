"""Tests for PyWellGeo geometry bridge."""

from well_trajectory.pywellgeo_bridge import enrich_survey_geometry
from well_trajectory.schemas import SurveyStation


def test_enrich_survey_geometry_vertical_stub():
    stations = [
        SurveyStation(md=0, inc=0, azi=90, tvd=0, n=0, e=0),
        SurveyStation(md=100, inc=0, azi=90, tvd=100, n=0, e=0),
    ]
    geo = enrich_survey_geometry(stations)
    assert geo.length_m == 100.0
    assert geo.md_max == 100.0
    assert geo.tvd_max == 100.0
