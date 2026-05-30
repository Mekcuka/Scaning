"""Tests for one-pager snapshot builder."""

from app.services.one_pager_builder import (
    DEFAULT_ROADMAP,
    _count_exceeds,
    default_recommendation,
    poi_engineering_snapshot,
)


class _Poi:
    eng_power = "external"
    eng_injection = "centralized"
    eng_gas = "well"
    eng_oil_preparation = "mkos"
    eng_well_gathering = "single_tube"
    eng_transport = "auto"
    fluid_type = "oil"
    water_injection_volume = 0
    planned_production_volume = 100
    production_per_well = 10
    wells_per_pad = 4


def test_default_roadmap_has_six_stages():
    assert len(DEFAULT_ROADMAP) == 6
    assert DEFAULT_ROADMAP[0]["stage"] == "Разведка"


def test_count_exceeds():
    rows = [{"status": "within_limit"}, {"status": "exceeds_limit"}, {"status": "exceeds_limit"}]
    assert _count_exceeds(rows) == 2


def test_default_recommendation_includes_cost():
    poi = _Poi()
    text = default_recommendation(poi, 123.4, 1)
    assert "123.4" in text
    assert "Превышений: 1" in text


def test_poi_engineering_snapshot():
    snap = poi_engineering_snapshot(_Poi())
    assert snap["eng_power"] == "external"
    assert snap["pads_count"] == 3
