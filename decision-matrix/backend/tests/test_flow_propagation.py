"""Tests for flow propagation along PFD chains."""

from app.models import PointOfInterest
from app.services.flow_propagation import propagate_flows


def _mini_chain_nodes():
    return [
        {"id": "poi-1", "kind": "poi", "label": "Куст", "throughput_capacity_annual": 1000.0, "capacity_unit": "thousand_t_per_year"},
        {"id": "sep-1", "kind": "separator", "label": "Сепарация", "throughput_capacity_annual": 1000.0, "capacity_unit": "thousand_t_per_year"},
        {"id": "branch-oil", "kind": "fluid_branch", "label": "Нефть", "fluid": "oil"},
        {"id": "pipe-1", "kind": "network_segment", "label": "Нефтепровод", "fluid": "oil", "throughput_capacity_annual": 500.0, "capacity_unit": "thousand_t_per_year"},
        {"id": "term-1", "kind": "terminal", "label": "НПЗ", "fluid": "oil", "subtype": "refinery", "throughput_capacity_annual": 5000.0, "capacity_unit": "thousand_t_per_year"},
    ]


def _mini_chain_edges():
    return [
        {"id": "e1", "source": "poi-1", "target": "sep-1", "fluid": "oil"},
        {"id": "e2", "source": "sep-1", "target": "branch-oil", "fluid": "oil"},
        {"id": "e3", "source": "branch-oil", "target": "pipe-1", "fluid": "oil"},
        {"id": "e4", "source": "pipe-1", "target": "term-1", "fluid": "oil"},
    ]


def test_propagate_flags_overloaded_branch():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=1000.0,
        water_injection_volume=0,
    )
    result = propagate_flows(_mini_chain_nodes(), _mini_chain_edges(), poi)
    by_id = {n["id"]: n for n in result}
    assert by_id["poi-1"]["flow_annual"] == 1000.0
    assert by_id["branch-oil"]["flow_annual"] == 1000.0
    assert by_id["branch-oil"]["over_capacity"] is False
    assert by_id["pipe-1"]["over_capacity"] is True
    assert by_id["term-1"]["over_capacity"] is False


def test_poi_source_uses_planned_production_not_saved_capacity():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=250.0,
        water_injection_volume=0,
    )
    nodes = [
        {
            "id": "poi-1",
            "kind": "poi",
            "label": "Куст",
            "throughput_capacity_annual": 297.0,
            "capacity_unit": "thousand_t_per_year",
        },
        {"id": "sep-1", "kind": "separator", "label": "Сепарация", "throughput_capacity_annual": 1000.0, "capacity_unit": "thousand_t_per_year"},
    ]
    edges = [{"id": "e1", "source": "poi-1", "target": "sep-1", "fluid": "oil"}]
    result = propagate_flows(nodes, edges, poi)
    by_id = {n["id"]: n for n in result}
    assert by_id["poi-1"]["flow_annual"] == 250.0


def test_propagate_oil_branch_ignores_separator_percent():
    """Дебит POI — нефть; доля сепарации не уменьшает ветку нефти."""
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=1000.0,
        water_injection_volume=0,
    )
    nodes = _mini_chain_nodes()
    nodes[1]["separation_percent"] = 70.0
    result = propagate_flows(nodes, _mini_chain_edges(), poi)
    by_id = {n["id"]: n for n in result}
    assert by_id["branch-oil"]["flow_annual"] == 1000.0


def test_propagate_separator_produced_water_not_oil_fallback():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=500.0,
        water_injection_volume=0,
    )
    nodes = [
        {"id": "poi-1", "kind": "poi", "label": "Куст"},
        {"id": "sep-1", "kind": "separator", "label": "Сепарация", "separation_percent": 85.0},
        {"id": "branch-oil", "kind": "fluid_branch", "label": "Нефть", "fluid": "oil"},
        {"id": "branch-water", "kind": "fluid_branch", "label": "Вода", "fluid": "water"},
    ]
    edges = [
        {"id": "e1", "source": "poi-1", "target": "sep-1", "fluid": "oil"},
        {"id": "e2", "source": "sep-1", "target": "branch-oil", "fluid": "oil"},
        {"id": "e3", "source": "sep-1", "target": "branch-water", "fluid": "water"},
    ]
    result = propagate_flows(nodes, edges, poi)
    by_id = {n["id"]: n for n in result}
    assert by_id["sep-1"]["flow_annual"] == round(500.0 / 0.85, 1)
    assert by_id["branch-oil"]["flow_annual"] == 500.0
    assert by_id["branch-water"]["flow_annual"] == round(500.0 * 0.15 / 0.85, 1)


def test_propagate_associated_gas_from_oil_debit():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=500.0,
        gas_factor=120.0,
        water_injection_volume=0,
    )
    nodes = [
        {"id": "poi-1", "kind": "poi", "label": "Куст"},
        {"id": "sep-1", "kind": "separator", "label": "Сепарация"},
        {"id": "branch-gas", "kind": "fluid_branch", "label": "Газ", "fluid": "gas"},
    ]
    edges = [
        {"id": "e1", "source": "poi-1", "target": "sep-1", "fluid": "oil"},
        {"id": "e2", "source": "sep-1", "target": "branch-gas", "fluid": "gas"},
    ]
    result = propagate_flows(nodes, edges, poi)
    by_id = {n["id"]: n for n in result}
    assert by_id["branch-gas"]["flow_annual"] == 60.0
    assert by_id["branch-gas"]["flow_unit"] == "thousand_m3_per_year"
