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
    assert by_id["branch-oil"]["flow_annual"] == 850.0
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


def test_propagate_uses_separator_percent():
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
    assert by_id["branch-oil"]["flow_annual"] == 700.0
