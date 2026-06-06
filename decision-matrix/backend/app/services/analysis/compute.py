"""Pure analysis computations — no database access."""

from __future__ import annotations

from typing import Any

from app.models import PoiInfrastructureAnalysis, PointOfInterest, ProjectDistanceDefaults
from app.services.calculations import (
    EngineeringState,
    apply_engineering_rules,
    calc_engineering_equipment_cost,
    calc_external_point_cost_thousand,
    calc_linear_cost_thousand_rub,
    calc_overall_status,
    calc_pads_cost_thousand_rub,
    calc_pads_count,
    calc_wells_total,
    thousand_to_million_rub,
)
from app.services.cost_rates import EXTERNAL_LINEAR_SUBTYPES


def engineering_state_from_poi(poi: PointOfInterest) -> EngineeringState:
    return EngineeringState(
        fluid_type=poi.fluid_type,
        eng_power=poi.eng_power,
        eng_injection=poi.eng_injection,
        eng_gas=poi.eng_gas,
        eng_oil_preparation=poi.eng_oil_preparation,
        eng_transport=poi.eng_transport,
        water_injection_volume=poi.water_injection_volume,
    )


def get_distance_maps(
    poi: PointOfInterest, defaults: ProjectDistanceDefaults | None
) -> tuple[dict[str, float], dict[str, float], dict[str, float]]:
    km_per_pad_map = {
        "autoroad": poi.km_per_pad_autoroad or (defaults.km_per_pad_autoroad if defaults else 3.0),
        "oil_pipeline": poi.km_per_pad_oil_pipeline or (defaults.km_per_pad_oil_pipeline if defaults else 3.0),
        "gas_pipeline": poi.km_per_pad_gas_pipeline or (defaults.km_per_pad_gas_pipeline if defaults else 3.0),
        "water_pipeline": poi.km_per_pad_water_pipeline or (defaults.km_per_pad_water_pipeline if defaults else 3.0),
        "power_line": poi.km_per_pad_power_line or (defaults.km_per_pad_power_line if defaults else 3.0),
    }
    max_line_map = {
        "autoroad": poi.max_total_line_autoroad_km or (defaults.max_total_line_autoroad_km if defaults else 50),
        "oil_pipeline": poi.max_total_line_oil_pipeline_km
        or (defaults.max_total_line_oil_pipeline_km if defaults else 40),
        "gas_pipeline": poi.max_total_line_gas_pipeline_km
        or (defaults.max_total_line_gas_pipeline_km if defaults else 40),
        "water_pipeline": poi.max_total_line_water_pipeline_km
        or (defaults.max_total_line_water_pipeline_km if defaults else 30),
        "power_line": poi.max_total_line_power_line_km or (defaults.max_total_line_power_line_km if defaults else 30),
    }
    _external_linear_limit_km = {
        "methanol_pipeline": defaults.max_total_line_methanol_pipeline_km if defaults else 40.0,
        "additional_line": defaults.max_total_line_additional_line_km if defaults else 50.0,
    }
    for subtype in EXTERNAL_LINEAR_SUBTYPES:
        if subtype not in max_line_map:
            max_line_map[subtype] = _external_linear_limit_km.get(subtype, 40.0)
    threshold_map = {
        "gas_processing": poi.threshold_gas_processing_km
        or (defaults.threshold_gas_processing_km if defaults else 80),
        "gtes": poi.threshold_gtes_km or (defaults.threshold_gtes_km if defaults else 60),
        "substation": poi.threshold_substation_km or (defaults.threshold_substation_km if defaults else 25),
        "refinery": poi.threshold_refinery_km or (defaults.threshold_refinery_km if defaults else 100),
        "ground_pumping_station": (
            defaults.threshold_ground_pumping_station_km if defaults else 50.0
        ),
        "sand_quarry": defaults.threshold_sand_quarry_km if defaults else 50.0,
    }
    return km_per_pad_map, max_line_map, threshold_map


def subtype_cost_thousand(
    row: PoiInfrastructureAnalysis | None,
    *,
    subtype: str,
    param_type: str,
    status: str,
    distance_km: float | None,
    rates: dict[str, float],
    pads_count: int,
) -> float:
    if status == "not_required":
        return 0.0
    if subtype == "pads":
        return calc_pads_cost_thousand_rub(pads_count, rates.get("pads", 0))
    if param_type in ("internal", "external_linear"):
        dist = distance_km or 0.0
        return calc_linear_cost_thousand_rub(dist, rates.get(subtype, 0))
    if param_type == "external":
        return calc_external_point_cost_thousand(status, rate=rates.get(subtype, 0))
    return rates.get(subtype, 0) if status != "not_required" else 0.0


def build_pads_analysis_item(poi: PointOfInterest, pads: int, rates: dict[str, float]) -> dict[str, Any]:
    cost = calc_pads_cost_thousand_rub(pads, rates.get("pads", 0))
    return {
        "subtype": "pads",
        "param_type": "internal",
        "status": "computed",
        "pads_count": pads,
        "wells_total": calc_wells_total(poi.planned_production_volume, poi.production_per_well),
        "distance_km": None,
        "limit_km": None,
        "cost_mln": thousand_to_million_rub(cost),
    }


def build_analysis_summary(
    poi: PointOfInterest,
    items: list[dict[str, Any]],
    *,
    rates: dict[str, float],
    eng: EngineeringState | None = None,
    overall_status_override: str | None = None,
) -> dict[str, Any]:
    eng = eng or engineering_state_from_poi(poi)
    pads = calc_pads_count(poi.planned_production_volume, poi.production_per_well, poi.wells_per_pad)
    equipment_thousand = calc_engineering_equipment_cost(eng, rates)
    subtype_status = apply_engineering_rules(eng)
    statuses_for_overall: list[str] = []
    total_thousand = equipment_thousand
    rows: list[dict[str, Any]] = []

    for raw in items:
        if raw.get("subtype") == "pads":
            continue
        item = dict(raw)
        st = str(item.get("status", ""))
        if st not in ("not_required", "computed"):
            statuses_for_overall.append(st)
        param_type = str(item.get("param_type", ""))
        dist = item.get("distance_km")
        subtype = str(item.get("subtype", ""))
        cost_th = subtype_cost_thousand(
            None,
            subtype=subtype,
            param_type=param_type,
            status=st,
            distance_km=float(dist) if dist is not None else None,
            rates=rates,
            pads_count=pads,
        )
        item["cost_mln"] = thousand_to_million_rub(cost_th)
        if st != "not_required":
            total_thousand += cost_th
        rows.append(item)

    rows.append(build_pads_analysis_item(poi, pads, rates))
    total_thousand += calc_pads_cost_thousand_rub(pads, rates.get("pads", 0))

    overall = overall_status_override or calc_overall_status(statuses_for_overall)
    return {
        "poi_id": str(poi.id),
        "total_cost_mln": thousand_to_million_rub(total_thousand),
        "overall_status": overall,
        "rows": rows,
        "analysis": rows,
        "engineering_status": subtype_status,
    }
