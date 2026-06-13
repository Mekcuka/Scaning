"""CSV import parser tests."""

from pathlib import Path

from well_trajectory.import_csv import parse_csv

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def test_parse_sample_survey_csv_three_wells():
    content = (FIXTURES / "sample_survey.csv").read_text(encoding="utf-8")
    result = parse_csv(content)
    assert not result.errors
    assert len(result.wells) == 3
    names = {w.name for w in result.wells}
    assert names == {"Скв-1", "Скв-2", "Скв-3"}
    for well in result.wells:
        assert len(well.stations) >= 2
        assert well.stations[0].md == 0.0
        assert well.geometry is not None
        assert well.geometry.length_m >= 0


def test_parse_csv_computes_ne_when_missing():
    content = """well_name,md,inc,azi
A,0,0,90
A,100,30,90
"""
    result = parse_csv(content)
    assert len(result.wells) == 1
    assert result.wells[0].stations[-1].e > 0
    assert any("welleng" in w.lower() for w in result.wells[0].warnings)


def test_parse_csv_missing_columns():
    result = parse_csv("well_name,md\nA,0\n")
    assert not result.wells
    assert result.errors


def test_parse_csv_semicolon_delimiter():
    content = "well_name;md;inc;azi\nB;0;0;90\nB;200;45;90\n"
    result = parse_csv(content)
    assert len(result.wells) == 1
    assert result.wells[0].name == "B"
