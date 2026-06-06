"""Smoke tests for services.analysis package (SOLID phase 2)."""

from types import SimpleNamespace

from app.services.analysis import (
    build_analysis_summary,
    engineering_state_from_poi,
    get_distance_maps,
    subtype_cost_thousand,
)
from app.services.analysis.compute import subtype_cost_thousand as compute_subtype_cost
from app.services.infrastructure_analysis import (
    _subtype_cost_thousand,
    get_distance_maps as legacy_get_distance_maps,
    run_project_pois_analysis,
)


def test_barrel_reexports_legacy_names():
    assert _subtype_cost_thousand is compute_subtype_cost
    assert legacy_get_distance_maps is get_distance_maps


def test_engineering_state_from_poi_maps_fields():
    poi = SimpleNamespace(
        fluid_type="oil",
        eng_power="internal",
        eng_injection="local",
        eng_gas="none",
        eng_oil_preparation="central",
        eng_transport="pipeline",
        water_injection_volume=10.0,
    )
    eng = engineering_state_from_poi(poi)
    assert eng.fluid_type == "oil"
    assert eng.eng_power == "internal"


def test_build_analysis_summary_includes_pads_row():
    poi = SimpleNamespace(
        id="00000000-0000-0000-0000-000000000001",
        planned_production_volume=1000,
        production_per_well=100,
        wells_per_pad=10,
        fluid_type="oil",
        eng_power="external",
        eng_injection="local",
        eng_gas="none",
        eng_oil_preparation="central",
        eng_transport="pipeline",
        water_injection_volume=0,
    )
    summary = build_analysis_summary(
        poi,
        [
            {
                "subtype": "autoroad",
                "param_type": "internal",
                "status": "computed",
                "distance_km": 3.0,
            }
        ],
        rates={"pads": 1000, "autoroad": 500, "gtes": 0, "substation": 0},
    )
    assert summary["poi_id"] == str(poi.id)
    assert any(row["subtype"] == "pads" for row in summary["rows"])


def test_subtype_cost_thousand_external_within_limit_is_zero():
    assert (
        subtype_cost_thousand(
            None,
            subtype="sand_quarry",
            param_type="external",
            status="within_limit",
            distance_km=1.0,
            rates={"sand_quarry": 100_000},
            pads_count=0,
        )
        == 0.0
    )
