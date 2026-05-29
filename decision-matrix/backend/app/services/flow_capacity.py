"""Estimated annual throughput capacity for PFD schematic nodes (тыс. т/год or тыс. м³/год)."""

from __future__ import annotations

from typing import Any

from app.geo.fluid_routing import FluidKind
from app.models import PointOfInterest
from app.services.calculations import EngineeringState

# Упрощённые нормативные пропускные способности площадных объектов, тыс. т/год или тыс. м³/год
FACILITY_CAPACITY_THOUSAND_PER_YEAR: dict[str, tuple[float, str]] = {
    "refinery": (5000.0, "thousand_t_per_year"),
    "oil_pumping_station": (2500.0, "thousand_t_per_year"),
    "gas_processing": (1200.0, "thousand_m3_per_year"),
    "gtes": (400.0, "thousand_m3_per_year"),
    "gpes": (350.0, "thousand_m3_per_year"),
    "vies": (200.0, "thousand_m3_per_year"),
    "preliminary_water_discharge_station": (800.0, "thousand_t_per_year"),
    "booster_pumping_station": (600.0, "thousand_t_per_year"),
    "ground_pumping_station": (500.0, "thousand_t_per_year"),
    "mkos": (300.0, "thousand_t_per_year"),
    "bmupn": (400.0, "thousand_t_per_year"),
    "cps": (600.0, "thousand_t_per_year"),
    "upsv": (350.0, "thousand_t_per_year"),
}

PIPELINE_CAPACITY_THOUSAND_PER_YEAR: dict[FluidKind, float] = {
    "oil": 3000.0,
    "water": 1500.0,
    "gas": 2000.0,
}

# Доля фаз после сепарации (нефтяной куст), доли от дебита жидкости
OIL_PHASE_SHARE = 0.85
DEFAULT_SEPARATION_PERCENT = 85.0
DEFAULT_GAS_FACTOR = 120.0  # м³/т — газовый фактор попутного газа (нефтяной POI)


def resolve_separation_share(percent: float | None) -> float:
    if percent is None:
        return OIL_PHASE_SHARE
    p = float(percent)
    if p <= 0 or p > 100:
        return OIL_PHASE_SHARE
    return p / 100

# Ветки «Нефть / Вода / Газ» — фазовые метки, без пропускной способности
NO_CAPACITY_KINDS = frozenset({"fluid_branch"})


def resolve_gas_factor(poi: PointOfInterest) -> float:
    """Gas-oil ratio for associated gas, m³ per ton of oil (м³/т)."""
    gf = float(poi.gas_factor or 0)
    return gf if gf > 0 else DEFAULT_GAS_FACTOR


def node_has_throughput_capacity(kind: str) -> bool:
    return kind not in NO_CAPACITY_KINDS


def format_capacity(value: float | None, unit: str | None) -> str:
    if value is None:
        return "не задана"
    u = unit or "thousand_t_per_year"
    if u == "thousand_m3_per_year":
        return f"{value:,.1f} тыс. м³/год".replace(",", " ")
    return f"{value:,.1f} тыс. т/год".replace(",", " ")


def estimate_node_capacity(
    poi: PointOfInterest,
    state: EngineeringState,
    *,
    kind: str,
    fluid: str | None,
    subtype: str | None,
) -> tuple[float | None, str]:
    production = float(poi.planned_production_volume or 0)
    water = float(poi.water_injection_volume or 0)

    if kind == "poi":
        if poi.fluid_type == "gas":
            return (production if production > 0 else None, "thousand_m3_per_year")
        total = production if production > 0 else None
        return (total, "thousand_t_per_year")

    if kind == "separator":
        if poi.fluid_type == "gas":
            return (production if production > 0 else None, "thousand_m3_per_year")
        return (production if production > 0 else None, "thousand_t_per_year")

    if kind in NO_CAPACITY_KINDS:
        return (None, "thousand_t_per_year")

    if kind == "process":
        if subtype and subtype in FACILITY_CAPACITY_THOUSAND_PER_YEAR:
            v, u = FACILITY_CAPACITY_THOUSAND_PER_YEAR[subtype]
            return (v, u)
        cap, u = _branch_capacity(poi, production, water, "oil")
        return (cap, u)

    if kind == "network_segment" and fluid in ("oil", "water", "gas"):
        branch_cap, unit = _branch_capacity(poi, production, water, fluid)  # type: ignore[arg-type]
        pipe = PIPELINE_CAPACITY_THOUSAND_PER_YEAR.get(fluid)  # type: ignore[arg-type]
        if branch_cap is not None and pipe is not None:
            return (min(branch_cap, pipe), unit)
        return (branch_cap or pipe, unit or "thousand_t_per_year")

    if kind == "terminal" and subtype:
        entry = FACILITY_CAPACITY_THOUSAND_PER_YEAR.get(subtype)
        if entry:
            return entry
        if fluid == "gas":
            return (PIPELINE_CAPACITY_THOUSAND_PER_YEAR["gas"], "thousand_m3_per_year")
        return (PIPELINE_CAPACITY_THOUSAND_PER_YEAR.get("oil"), "thousand_t_per_year")  # type: ignore[return-value]

    if kind == "utilization":
        if fluid == "gas":
            return _branch_capacity(poi, production, water, "gas")
        if subtype == "auto":
            cap, u = _branch_capacity(poi, production, water, "oil")
            return (cap, u)

    if kind == "custom":
        return (None, "thousand_t_per_year")

    return (None, "thousand_t_per_year")


def _branch_capacity(
    poi: PointOfInterest,
    production: float,
    water: float,
    fluid: FluidKind,
    separation_share: float | None = None,
) -> tuple[float | None, str]:
    share = separation_share if separation_share is not None else OIL_PHASE_SHARE
    if fluid == "oil":
        if poi.fluid_type != "oil" or production <= 0:
            return (None, "thousand_t_per_year")
        return (round(production * share, 1), "thousand_t_per_year")
    if fluid == "water":
        if water <= 0:
            return (None, "thousand_t_per_year")
        return (round(water, 1), "thousand_t_per_year")
    if fluid == "gas":
        if poi.fluid_type == "gas":
            return (production if production > 0 else None, "thousand_m3_per_year")
        if production <= 0:
            return (None, "thousand_m3_per_year")
        gf = resolve_gas_factor(poi)
        return (round(production * share * gf / 1000, 1), "thousand_m3_per_year")
    return (None, "thousand_t_per_year")


def enrich_nodes_capacity(
    nodes: list[dict[str, Any]],
    poi: PointOfInterest,
    state: EngineeringState,
) -> list[dict[str, Any]]:
    """Fill throughput_capacity_annual where missing."""
    out: list[dict[str, Any]] = []
    for node in nodes:
        n = dict(node)
        if n.get("kind") in NO_CAPACITY_KINDS:
            n["throughput_capacity_annual"] = None
            n["capacity_unit"] = None
            out.append(n)
            continue
        if n.get("kind") == "poi":
            cap, unit = estimate_node_capacity(
                poi,
                state,
                kind="poi",
                fluid=n.get("fluid"),
                subtype=n.get("subtype"),
            )
            n["throughput_capacity_annual"] = cap
            n["capacity_unit"] = unit
        elif n.get("throughput_capacity_annual") is None:
            cap, unit = estimate_node_capacity(
                poi,
                state,
                kind=n.get("kind", "custom"),
                fluid=n.get("fluid"),
                subtype=n.get("subtype"),
            )
            if cap is not None:
                n["throughput_capacity_annual"] = cap
                n["capacity_unit"] = unit
        elif not n.get("capacity_unit"):
            n["capacity_unit"] = "thousand_t_per_year"
        out.append(n)
    return out
