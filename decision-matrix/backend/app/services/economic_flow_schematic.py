"""Build economic flow schematic from technological PFD and project rates."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointOfInterest, ProjectCostRates, ProjectEconomicParams
from app.services.calculations import (
    calc_pads_cost_thousand_rub,
    calc_pads_count,
    thousand_to_million_rub,
)
from app.services.cost_rates import DEFAULT_COST_RATES, EXTERNAL_POINT_SUBTYPES, OIL_PREP_RATE_MAP
from app.services.economic_rates import (
    DEFAULT_ECONOMIC_PARAMS,
    OPEX_EQUIPMENT_KEYS,
    OPEX_PIPELINE_KEYS,
    OPEX_TERMINAL_KEYS,
    REVENUE_TERMINAL_SUBTYPES,
)
from app.services.flow_schematic_store import get_flow_schematic


def _parse_length_km(node: dict[str, Any]) -> float | None:
    raw = node.get("length_km")
    if raw is not None:
        try:
            return float(raw)
        except (TypeError, ValueError):
            pass
    if node.get("kind") != "network_segment":
        return None
    label = node.get("label") or ""
    m = re.search(r"\(([\d.,]+)\s*км\)", label)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


def _merged_cost_rates(row: ProjectCostRates | None) -> dict[str, float]:
    return {**DEFAULT_COST_RATES, **(row.rates if row else {})}


def _merged_economic_params(row: ProjectEconomicParams | None) -> dict[str, float]:
    return {**DEFAULT_ECONOMIC_PARAMS, **(row.params if row else {})}


def _node_capex_thousand(
    node: dict[str, Any],
    poi: PointOfInterest,
    cost_rates: dict[str, float],
) -> tuple[float | None, str | None]:
    kind = node.get("kind", "")
    subtype = (node.get("subtype") or "").lower()
    label = node.get("label") or ""

    if kind == "poi":
        pads = calc_pads_count(
            poi.planned_production_volume or 0,
            poi.production_per_well or 0,
            poi.wells_per_pad or 0,
        )
        if pads <= 0:
            return 0.0, "Кусты: 0"
        capex = calc_pads_cost_thousand_rub(pads, cost_rates.get("pads", 0))
        return capex, f"{pads} КП × {cost_rates.get('pads', 0)} тыс. ₽"

    if kind == "process" and subtype in OIL_PREP_RATE_MAP:
        rate_key = OIL_PREP_RATE_MAP.get(subtype)
        if not rate_key:
            return 0.0, None
        val = cost_rates.get(rate_key, 0)
        return val, f"CAPEX: {val:g} тыс. ₽"

    if kind == "network_segment":
        length_km = _parse_length_km(node)
        pipe_subtype = subtype or f"{node.get('fluid', 'oil')}_pipeline"
        rate = cost_rates.get(pipe_subtype, 0)
        if length_km is None or length_km <= 0:
            return 0.0, "Длина сегмента не задана"
        capex = length_km * rate
        return capex, f"{length_km:.1f} км × {rate} тыс. ₽/км"

    if kind == "terminal" and subtype in EXTERNAL_POINT_SUBTYPES:
        val = cost_rates.get(subtype, 0)
        return val, f"CAPEX: {val:g} тыс. ₽"

    if kind == "utilization" and label == "В пласт" and (poi.water_injection_volume or 0) > 0:
        if poi.eng_injection == "local":
            val = cost_rates.get("eq_injection", 0)
            return val, f"Локальная закачка: {val} тыс. ₽"
        return 0.0, None

    return 0.0, None


def _node_opex_thousand_per_year(
    node: dict[str, Any],
    poi: PointOfInterest,
    econ: dict[str, float],
) -> tuple[float | None, str | None]:
    kind = node.get("kind", "")
    subtype = (node.get("subtype") or "").lower()
    label = node.get("label") or ""

    if kind == "poi":
        pads = calc_pads_count(
            poi.planned_production_volume or 0,
            poi.production_per_well or 0,
            poi.wells_per_pad or 0,
        )
        rate = econ.get("opex_pads_per_pad", 0)
        if pads <= 0 or rate <= 0:
            return 0.0, None
        val = pads * rate
        return val, f"{pads} КП × {rate} тыс. ₽/год"

    if kind == "process" and subtype in OPEX_EQUIPMENT_KEYS:
        key = OPEX_EQUIPMENT_KEYS[subtype]
        val = econ.get(key, 0)
        return val, f"OPEX: {val:g} тыс. ₽/год"

    if kind == "network_segment":
        length_km = _parse_length_km(node)
        pipe_subtype = subtype or f"{node.get('fluid', 'oil')}_pipeline"
        key = OPEX_PIPELINE_KEYS.get(pipe_subtype)
        if not key or length_km is None or length_km <= 0:
            return 0.0, None
        rate = econ.get(key, 0)
        val = length_km * rate
        return val, f"{length_km:.1f} км × {rate} тыс. ₽/км·год"

    if kind == "terminal" and subtype in OPEX_TERMINAL_KEYS:
        key = OPEX_TERMINAL_KEYS[subtype]
        val = econ.get(key, 0)
        return val, f"OPEX: {val:g} тыс. ₽/год"

    if kind == "utilization" and label == "В пласт" and (poi.water_injection_volume or 0) > 0:
        val = econ.get("opex_eq_injection", 0)
        return val, f"OPEX закачка: {val} тыс. ₽/год"

    return 0.0, None


def _node_revenue_thousand_per_year(
    node: dict[str, Any],
    poi: PointOfInterest,
    econ: dict[str, float],
) -> tuple[float | None, str | None]:
    kind = node.get("kind", "")
    subtype = (node.get("subtype") or "").lower()
    label = node.get("label") or ""
    fluid = node.get("fluid")
    flow = node.get("flow_annual")
    if flow is None or flow <= 0:
        return 0.0, None

    if kind == "terminal" and subtype in REVENUE_TERMINAL_SUBTYPES:
        if fluid == "oil" or subtype in ("refinery", "oil_pumping_station"):
            price = econ.get("oil_price_thousand_rub_per_t", 0)
            if price <= 0:
                return 0.0, "Цена нефти не задана"
            val = flow * price
            return val, f"{flow} × {price} тыс. ₽/т"
        if fluid == "gas" or subtype in ("gas_processing", "gtes", "gpes", "vies"):
            price = econ.get("gas_price_thousand_rub_per_m3", 0)
            if price <= 0:
                return 0.0, "Цена газа не задана"
            val = flow * price
            return val, f"{flow} × {price} тыс. ₽/тыс. м³"

    if kind == "utilization" and label == "Автовывоз" and poi.fluid_type == "oil":
        price = econ.get("oil_price_thousand_rub_per_t", 0)
        if price <= 0:
            return 0.0, "Цена нефти не задана"
        val = flow * price
        return val, f"Автовывоз: {flow} × {price} тыс. ₽/т"

    return 0.0, None


def build_economic_flow_schematic(
    tech: dict[str, Any],
    poi: PointOfInterest,
    cost_rates: dict[str, float],
    econ_params: dict[str, float],
) -> dict[str, Any]:
    warnings: list[str] = list(tech.get("warnings") or [])
    economic_nodes: list[dict[str, Any]] = []

    total_capex = 0.0
    total_opex = 0.0
    total_revenue = 0.0

    oil_price = econ_params.get("oil_price_thousand_rub_per_t", 0)
    gas_price = econ_params.get("gas_price_thousand_rub_per_m3", 0)

    for node in tech.get("nodes") or []:
        capex, capex_formula = _node_capex_thousand(node, poi, cost_rates)
        opex, opex_formula = _node_opex_thousand_per_year(node, poi, econ_params)
        revenue, revenue_formula = _node_revenue_thousand_per_year(node, poi, econ_params)

        capex_val = capex or 0.0
        opex_val = opex or 0.0
        revenue_val = revenue or 0.0
        net_val = revenue_val - opex_val

        total_capex += capex_val
        total_opex += opex_val
        total_revenue += revenue_val

        formulas = [f for f in (capex_formula, opex_formula, revenue_formula) if f]
        formula_label = "; ".join(formulas) if formulas else None

        flow = node.get("flow_annual")
        if flow and flow > 0:
            if node.get("fluid") == "oil" and oil_price <= 0 and (
                node.get("kind") == "terminal"
                or (node.get("kind") == "utilization" and node.get("label") == "Автовывоз")
            ):
                if "missing_oil_price" not in warnings:
                    warnings.append("missing_oil_price")
            if node.get("fluid") == "gas" and gas_price <= 0 and node.get("kind") == "terminal":
                if "missing_gas_price" not in warnings:
                    warnings.append("missing_gas_price")

        if node.get("kind") == "terminal" and node.get("subtype") == "ground_pumping_station":
            if cost_rates.get("ground_pumping_station", 0) == 0 and capex_val == 0:
                if "no_bkns_capex_rate" not in warnings:
                    warnings.append("no_bkns_capex_rate")

        economic_nodes.append(
            {
                "id": node["id"],
                "kind": node.get("kind", ""),
                "label": node.get("label", ""),
                "fluid": node.get("fluid"),
                "position_x": node.get("position_x"),
                "position_y": node.get("position_y"),
                "flow_annual": flow,
                "flow_unit": node.get("flow_unit"),
                "capex_thousand_rub": round(capex_val, 2) if capex_val else None,
                "opex_thousand_rub_per_year": round(opex_val, 2) if opex_val else None,
                "revenue_thousand_rub_per_year": round(revenue_val, 2) if revenue_val else None,
                "net_thousand_rub_per_year": round(net_val, 2) if (opex_val or revenue_val) else None,
                "formula_label": formula_label,
            }
        )

    summary = {
        "total_capex_mln": thousand_to_million_rub(total_capex),
        "total_opex_mln_per_year": thousand_to_million_rub(total_opex),
        "total_revenue_mln_per_year": thousand_to_million_rub(total_revenue),
        "net_mln_per_year": thousand_to_million_rub(total_revenue - total_opex),
    }

    return {
        "poi_id": tech["poi_id"],
        "nodes": economic_nodes,
        "edges": tech.get("edges") or [],
        "summary": summary,
        "warnings": warnings,
    }


async def get_economic_flow_schematic(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
) -> dict[str, Any]:
    tech = await get_flow_schematic(db, project_id, poi)
    cost_row = await db.scalar(
        select(ProjectCostRates).where(ProjectCostRates.project_id == project_id)
    )
    econ_row = await db.scalar(
        select(ProjectEconomicParams).where(ProjectEconomicParams.project_id == project_id)
    )
    return build_economic_flow_schematic(
        tech,
        poi,
        _merged_cost_rates(cost_row),
        _merged_economic_params(econ_row),
    )
