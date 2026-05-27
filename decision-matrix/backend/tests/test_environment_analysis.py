"""Tests for POI environment analysis (FR-6)."""

import pytest

from app.services.calculations import (
    EngineeringState,
    apply_engineering_rules,
    calc_distance_status_external,
    calc_distance_status_internal,
    calc_internal_line_distance_km,
    calc_overall_status,
    calc_pads_count,
    format_internal_formula_label,
    is_power_generation,
)


def test_oil_transport_auto_excludes_pipeline_and_refinery():
    st = apply_engineering_rules(
        EngineeringState(fluid_type="oil", eng_transport="auto")
    )
    assert st["oil_pipeline"] == "not_required"
    assert st["refinery"] == "not_required"


def test_oil_transport_marine_active_pipeline_only():
    st = apply_engineering_rules(
        EngineeringState(fluid_type="oil", eng_transport="marine")
    )
    assert st["oil_pipeline"] == "active"
    assert st["refinery"] == "not_required"


def test_oil_transport_pipeline_active_both():
    st = apply_engineering_rules(
        EngineeringState(fluid_type="oil", eng_transport="pipeline")
    )
    assert st["oil_pipeline"] == "active"
    assert st["refinery"] == "active"


def test_external_power_internal_gtes():
    st = apply_engineering_rules(EngineeringState(eng_power="external"))
    assert st["gtes"] == "not_required"
    assert st["power_line"] == "active"

    st2 = apply_engineering_rules(EngineeringState(eng_power="internal"))
    assert st2["gtes"] == "active"
    assert st2["power_line"] == "not_required"


def test_gas_fluid_refinery_not_required():
    st = apply_engineering_rules(EngineeringState(fluid_type="gas"))
    assert st["refinery"] == "not_required"


def test_is_power_generation_aliases():
    assert is_power_generation("power_generation")
    assert is_power_generation("generation")
    assert not is_power_generation("well")


def test_pads_count_and_internal_distance():
    pads = calc_pads_count(1000, 100, 10)
    assert pads == 1
    dist, src = calc_internal_line_distance_km(pads, 3.0)
    assert dist == 3.0
    assert src == "pads_per_pad_formula"


def test_internal_status_exceeds_and_within():
    assert (
        calc_distance_status_internal(60, 50, active=True) == "exceeds_limit"
    )
    assert calc_distance_status_internal(0, 50, active=True) == "within_limit"
    assert calc_distance_status_internal(10, 50, active=True, force_construction=True) == (
        "construction_required"
    )


def test_external_status_construction_when_not_found():
    assert (
        calc_distance_status_external(None, 80, object_found=False) == "construction_required"
    )
    assert calc_distance_status_external(90, 80, object_found=True) == "exceeds_limit"
    assert calc_distance_status_external(70, 80, object_found=True) == "within_limit"


def test_overall_status_priority():
    assert calc_overall_status(["within_limit", "exceeds_limit"]) == "exceeds_limit"
    assert (
        calc_overall_status(["within_limit", "construction_required"]) == "construction_required"
    )
    assert calc_overall_status(["not_required", "computed"]) == "not_required"


def test_formula_label():
    label = format_internal_formula_label(3.0, 2, 6.0)
    assert label == "3.0 км/КП × 2 КП = 6.0 км"


def test_gas_processing_distance_status_with_poi_threshold():
    """Порог ГКС с POI (например 20 км): 8.4 км — в пределах, 25 км — превышение."""
    assert (
        calc_distance_status_external(8.4, 20.0, object_found=True) == "within_limit"
    )
    assert (
        calc_distance_status_external(25.0, 20.0, object_found=True) == "exceeds_limit"
    )
    assert (
        calc_distance_status_external(None, 20.0, object_found=False) == "construction_required"
    )


def test_gas_processing_nearest_from_sample_coords():
    """Ближайшая GКС к типичному POI (центр карты) — Point из CSV, не узел сети ~16 км."""
    from app.services.spatial import haversine_km

    poi_lon, poi_lat = 37.6176, 55.7558
    candidates = [
        ("ГКС Северная", 37.648, 55.712),
        ("ГКС Южная (резерв)", 37.625, 55.678),
    ]
    name, lon, lat = min(
        candidates,
        key=lambda c: haversine_km(poi_lon, poi_lat, c[1], c[2]),
    )
    dist = haversine_km(poi_lon, poi_lat, lon, lat)
    assert name == "ГКС Северная"
    assert dist < 10.0
    assert dist != pytest.approx(16.4, abs=0.5)
