"""Landmark .wbp import smoke tests."""

from pathlib import Path

from well_trajectory.import_landmark import parse_wbp

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_parse_sample_wbp_smoke():
    data = (FIXTURES / "sample.wbp").read_bytes()
    result = parse_wbp(data)
    assert len(result.wells) >= 1
    well = result.wells[0]
    assert well.name == "Test-1"
    assert len(well.stations) >= 2
    assert well.geometry is not None


def test_parse_wbp_rejects_xml():
    result = parse_wbp(b"<?xml version='1.0'?><survey/>")
    assert not result.wells
    assert any("xml" in err.lower() for err in result.errors)
