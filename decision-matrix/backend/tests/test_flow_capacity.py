"""Tests for flow schematic throughput capacity estimates."""

from app.models import PointOfInterest
from app.services.calculations import EngineeringState
from app.services.flow_capacity import enrich_nodes_capacity, estimate_node_capacity, format_capacity


def test_format_capacity_units():
    assert "тыс. т/год" in format_capacity(1000.5, "thousand_t_per_year")
    assert "тыс. м³/год" in format_capacity(200.0, "thousand_m3_per_year")
    assert format_capacity(None, None) == "не задана"


def test_fluid_branch_has_no_capacity():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=1000.0,
        water_injection_volume=200.0,
    )
    state = EngineeringState(fluid_type="oil", eng_injection="centralized")
    for fluid in ("oil", "water", "gas"):
        cap, _ = estimate_node_capacity(
            poi, state, kind="fluid_branch", fluid=fluid, subtype=None
        )
        assert cap is None


def test_enrich_strips_fluid_branch_capacity():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=500.0,
    )
    state = EngineeringState()
    nodes = [
        {
            "id": "b-oil",
            "kind": "fluid_branch",
            "label": "Нефть",
            "fluid": "oil",
            "throughput_capacity_annual": 999.0,
        }
    ]
    enriched = enrich_nodes_capacity(nodes, poi, state)
    assert enriched[0]["throughput_capacity_annual"] is None


def test_enrich_fills_missing():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=500.0,
        water_injection_volume=0,
    )
    state = EngineeringState()
    nodes = [{"id": "poi-1", "kind": "poi", "label": "POI", "fluid": None, "subtype": None, "status": None}]
    enriched = enrich_nodes_capacity(nodes, poi, state)
    assert enriched[0]["throughput_capacity_annual"] == 500.0
