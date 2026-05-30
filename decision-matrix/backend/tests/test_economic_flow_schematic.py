"""Tests for economic flow schematic derived from technological PFD."""

from uuid import uuid4

from app.models import PointOfInterest
from app.services.economic_flow_schematic import build_economic_flow_schematic
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS


def _oil_poi(**kwargs) -> PointOfInterest:
    defaults = dict(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=1000.0,
        production_per_well=100.0,
        wells_per_pad=4,
        water_injection_volume=0,
        eng_oil_preparation="mkos",
        eng_transport="pipeline",
    )
    defaults.update(kwargs)
    return PointOfInterest(**defaults)


def _tech_schematic(nodes, edges=None, warnings=None):
    return {
        "poi_id": uuid4(),
        "nodes": nodes,
        "edges": edges or [],
        "warnings": warnings or [],
        "source": "auto",
    }


def test_oil_chain_capex_opex_revenue():
    poi = _oil_poi()
    tech = _tech_schematic(
        [
            {"id": "poi-1", "kind": "poi", "label": "Куст", "flow_annual": 1000.0, "flow_unit": "thousand_t_per_year"},
            {"id": "proc-1", "kind": "process", "label": "МКОС", "subtype": "mkos", "fluid": "oil"},
            {
                "id": "pipe-1",
                "kind": "network_segment",
                "label": "Нефтепровод (10 км)",
                "fluid": "oil",
                "subtype": "oil_pipeline",
                "length_km": 10.0,
                "flow_annual": 850.0,
                "flow_unit": "thousand_t_per_year",
            },
            {
                "id": "term-1",
                "kind": "terminal",
                "label": "НПЗ",
                "fluid": "oil",
                "subtype": "refinery",
                "flow_annual": 850.0,
                "flow_unit": "thousand_t_per_year",
            },
        ],
        edges=[
            {"id": "e1", "source": "poi-1", "target": "proc-1", "fluid": "oil"},
            {"id": "e2", "source": "proc-1", "target": "pipe-1", "fluid": "oil"},
            {"id": "e3", "source": "pipe-1", "target": "term-1", "fluid": "oil"},
        ],
    )
    cost_rates = {"pads": 200000, "eq_mkos": 100000, "oil_pipeline": 8000, "refinery": 500000}
    econ = dict(DEFAULT_ECONOMIC_PARAMS)

    result = build_economic_flow_schematic(tech, poi, cost_rates, econ)
    by_id = {n["id"]: n for n in result["nodes"]}

    assert by_id["poi-1"]["capex_thousand_rub"] == 600000.0
    assert by_id["proc-1"]["capex_thousand_rub"] == 100000.0
    assert by_id["pipe-1"]["capex_thousand_rub"] == 80000.0
    assert by_id["term-1"]["capex_thousand_rub"] == 500000.0
    assert by_id["term-1"]["revenue_thousand_rub_per_year"] == 850.0 * 35.0
    assert by_id["term-1"]["net_thousand_rub_per_year"] == by_id["term-1"]["revenue_thousand_rub_per_year"] - 15000.0

    assert result["summary"]["total_capex_mln"] == 1280.0
    assert result["summary"]["total_revenue_mln_per_year"] == 29.75


def test_gas_terminal_revenue():
    poi = PointOfInterest(
        name="Газ",
        longitude=30.0,
        latitude=60.0,
        fluid_type="gas",
        planned_production_volume=500.0,
    )
    tech = _tech_schematic(
        [
            {
                "id": "term-gas",
                "kind": "terminal",
                "label": "ГКС",
                "fluid": "gas",
                "subtype": "gas_processing",
                "flow_annual": 500.0,
                "flow_unit": "thousand_m3_per_year",
            },
        ]
    )
    result = build_economic_flow_schematic(tech, poi, {}, dict(DEFAULT_ECONOMIC_PARAMS))
    node = result["nodes"][0]
    assert node["revenue_thousand_rub_per_year"] == 500.0 * 8.0


def test_water_injection_opex():
    poi = _oil_poi(water_injection_volume=120.0, eng_injection="local")
    tech = _tech_schematic(
        [
            {
                "id": "util-1",
                "kind": "utilization",
                "label": "В пласт",
                "fluid": "water",
                "subtype": "local",
                "flow_annual": 120.0,
                "flow_unit": "thousand_t_per_year",
            },
        ]
    )
    cost_rates = {"eq_injection": 150000}
    result = build_economic_flow_schematic(tech, poi, cost_rates, dict(DEFAULT_ECONOMIC_PARAMS))
    node = result["nodes"][0]
    assert node["capex_thousand_rub"] == 150000.0
    assert node["opex_thousand_rub_per_year"] == 6000.0


def test_missing_oil_price_warning():
    poi = _oil_poi()
    tech = _tech_schematic(
        [
            {
                "id": "term-1",
                "kind": "terminal",
                "label": "НПЗ",
                "fluid": "oil",
                "subtype": "refinery",
                "flow_annual": 100.0,
                "flow_unit": "thousand_t_per_year",
            },
        ]
    )
    econ = dict(DEFAULT_ECONOMIC_PARAMS)
    econ["oil_price_thousand_rub_per_t"] = 0
    result = build_economic_flow_schematic(tech, poi, {}, econ)
    assert "missing_oil_price" in result["warnings"]


def test_bkns_terminal_capex():
    poi = _oil_poi(water_injection_volume=200.0, eng_injection="centralized")
    tech = _tech_schematic(
        [
            {
                "id": "term-bkns",
                "kind": "terminal",
                "label": "БКНС",
                "fluid": "water",
                "subtype": "ground_pumping_station",
                "flow_annual": 200.0,
                "flow_unit": "thousand_t_per_year",
            },
        ]
    )
    cost_rates = {"ground_pumping_station": 400000}
    result = build_economic_flow_schematic(tech, poi, cost_rates, dict(DEFAULT_ECONOMIC_PARAMS))
    node = result["nodes"][0]
    assert node["capex_thousand_rub"] == 400000.0
    assert node["opex_thousand_rub_per_year"] == 7000.0
    assert "CAPEX строительства: 400000" in (node["formula_label"] or "")
    assert "OPEX: 7000" in (node["formula_label"] or "")
    assert "no_bkns_capex_rate" not in result["warnings"]
