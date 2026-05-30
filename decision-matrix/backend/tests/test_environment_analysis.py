"""Tests for POI environment analysis (FR-6)."""

import pytest

from app.services.calculations import (
    EngineeringState,
    apply_engineering_rules,
    calc_distance_status_external,
    calc_distance_status_internal,
    calc_internal_line_distance_km,
    internal_analysis_status,
    calc_overall_status,
    calc_pads_count,
    format_internal_formula_label,
    is_power_generation,
)


def test_oil_transport_does_not_disable_pipeline_or_refinery():
    """Транспорт (FR-5.4.1) не отключает подтипы — стоимость считается по ставкам/анализу."""
    for transport in ("auto", "marine", "pipeline"):
        st = apply_engineering_rules(
            EngineeringState(fluid_type="oil", eng_transport=transport)
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


def test_centralized_injection_activates_bkns():
    st = apply_engineering_rules(
        EngineeringState(
            fluid_type="oil",
            eng_injection="centralized",
            water_injection_volume=120.0,
        )
    )
    assert st["ground_pumping_station"] == "active"
    assert st["water_pipeline"] == "active"

    st_local = apply_engineering_rules(
        EngineeringState(
            fluid_type="oil",
            eng_injection="local",
            water_injection_volume=120.0,
        )
    )
    assert st_local["ground_pumping_station"] == "not_required"


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


def test_run_project_pois_analysis_empty(monkeypatch):
    """Batch helper returns zero results when project has no POIs."""

    async def _run():
        from unittest.mock import AsyncMock, MagicMock

        from app.services.infrastructure_analysis import run_project_pois_analysis

        db = AsyncMock()
        scalars = MagicMock()
        scalars.all.return_value = []
        db.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=scalars)))
        return await run_project_pois_analysis(db, "00000000-0000-0000-0000-000000000001")

    import asyncio

    payload = asyncio.run(_run())
    assert payload["analyzed_count"] == 0
    assert payload["results"] == []


def test_internal_analysis_status_uses_computed_not_limits():
    assert internal_analysis_status(active=False) == "not_required"
    assert internal_analysis_status(active=True) == "computed"


def test_legacy_internal_limit_status_helper():
    assert (
        calc_distance_status_internal(60, 50, active=True) == "exceeds_limit"
    )
    assert calc_distance_status_internal(0, 50, active=True) == "within_limit"


def test_external_status_construction_when_not_found():
    assert (
        calc_distance_status_external(None, 80, object_found=False) == "construction_required"
    )
    assert calc_distance_status_external(90, 80, object_found=True) == "exceeds_limit"
    assert calc_distance_status_external(70, 80, object_found=True) == "within_limit"


def test_external_point_cost_only_when_construction_or_exceeds():
    from app.services.calculations import calc_external_point_cost_thousand
    from app.services.infrastructure_analysis import _subtype_cost_thousand

    rate = 150_000.0
    assert calc_external_point_cost_thousand("within_limit", rate=rate) == 0.0
    assert calc_external_point_cost_thousand("not_required", rate=rate) == 0.0
    assert calc_external_point_cost_thousand("construction_required", rate=rate) == rate
    assert calc_external_point_cost_thousand("exceeds_limit", rate=rate) == rate
    assert (
        _subtype_cost_thousand(
            None,
            subtype="sand_quarry",
            param_type="external",
            status="within_limit",
            distance_km=1.4,
            rates={"sand_quarry": rate},
            pads_count=0,
        )
        == 0.0
    )
    assert (
        _subtype_cost_thousand(
            None,
            subtype="sand_quarry",
            param_type="external",
            status="construction_required",
            distance_km=None,
            rates={"sand_quarry": rate},
            pads_count=0,
        )
        == rate
    )


def test_overall_status_priority():
    assert calc_overall_status(["within_limit", "exceeds_limit"]) == "exceeds_limit"
    assert (
        calc_overall_status(["within_limit", "construction_required"]) == "construction_required"
    )
    assert calc_overall_status(["not_required", "computed"]) == "not_required"


def test_formula_label():
    label = format_internal_formula_label(3.0, 2, 6.0)
    assert label == "3.0 км/КП × 2 КП = 6.0 км"


def test_get_distance_maps_covers_all_external_linear():
    from types import SimpleNamespace

    from app.services.cost_rates import EXTERNAL_LINEAR_SUBTYPES
    from app.services.infrastructure_analysis import get_distance_maps

    poi = SimpleNamespace(
        km_per_pad_autoroad=None,
        km_per_pad_oil_pipeline=None,
        km_per_pad_gas_pipeline=None,
        km_per_pad_water_pipeline=None,
        km_per_pad_power_line=None,
        max_total_line_autoroad_km=None,
        max_total_line_oil_pipeline_km=None,
        max_total_line_gas_pipeline_km=None,
        max_total_line_water_pipeline_km=None,
        max_total_line_power_line_km=None,
        threshold_gas_processing_km=None,
        threshold_gtes_km=None,
        threshold_substation_km=None,
        threshold_refinery_km=None,
    )
    _, max_line_map, _ = get_distance_maps(poi, None)
    for subtype in EXTERNAL_LINEAR_SUBTYPES:
        assert subtype in max_line_map
        assert max_line_map[subtype] > 0


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


def test_sand_quarry_external_analysis_enabled():
    """Matrix row «Карьер песка» requires sand_quarry in EXTERNAL_POINT_SUBTYPES."""
    from app.geo.constants import EXTERNAL_POINT_SUBTYPES
    from app.services.cost_rates import EXTERNAL_POINT_SUBTYPES as CR_EXTERNAL

    assert "sand_quarry" in EXTERNAL_POINT_SUBTYPES
    assert "sand_quarry" in CR_EXTERNAL
    st = apply_engineering_rules(EngineeringState())
    assert st["sand_quarry"] == "active"


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
