import math
from dataclasses import dataclass


def calc_wells_total(planned_production: float, production_per_well: float) -> float:
    if (
        planned_production is None
        or production_per_well is None
        or production_per_well <= 0
    ):
        return 0
    return planned_production / production_per_well


def calc_pads_count(planned_production: float, production_per_well: float, wells_per_pad: int) -> int:
    if (
        planned_production is None
        or production_per_well is None
        or wells_per_pad is None
        or planned_production <= 0
        or production_per_well <= 0
        or wells_per_pad <= 0
    ):
        return 0
    wells = calc_wells_total(planned_production, production_per_well)
    return math.ceil(wells / wells_per_pad)


def calc_internal_line_distance_km(pads_count: int, km_per_pad: float, override: float | None = None) -> tuple[float, str]:
    if override is not None:
        return override, "manual_override"
    return pads_count * km_per_pad, "pads_per_pad_formula"


def calc_linear_cost_thousand_rub(distance_km: float, rate_per_km: float) -> float:
    return distance_km * rate_per_km


def calc_pads_cost_thousand_rub(pads_count: int, rate_pads: float) -> float:
    return pads_count * rate_pads


def calc_external_point_cost_thousand(status: str, *, rate: float) -> float:
    """CAPEX внешней площадки: только если объект не найден или вне порога доступности."""
    if status in ("construction_required", "exceeds_limit"):
        return rate
    return 0.0


def thousand_to_million_rub(value_thousand: float) -> float:
    return round(value_thousand / 1000, 2)


def calc_distance_status_external(
    distance_km: float | None,
    max_distance_km: float,
    *,
    object_found: bool,
    force_construction: bool = False,
) -> str:
    if force_construction or not object_found or distance_km is None:
        return "construction_required"
    if distance_km > max_distance_km:
        return "exceeds_limit"
    return "within_limit"


def calc_distance_status_internal(
    distance_km: float,
    max_total_line_km: float,
    *,
    active: bool,
    force_construction: bool = False,
) -> str:
    """Legacy limit check (external environment analysis only)."""
    if not active:
        return "not_required"
    if force_construction:
        return "construction_required"
    if distance_km > max_total_line_km:
        return "exceeds_limit"
    return "within_limit"


def internal_analysis_status(*, active: bool) -> str:
    """Internal linear/pads rows: cost via unit rates, not environment distance limits."""
    return "not_required" if not active else "computed"


def calc_overall_status(statuses: list[str]) -> str:
    priority = {
        "exceeds_limit": 1,
        "construction_required": 2,
        "within_limit": 3,
        "not_required": 4,
        "computed": 5,
    }
    active = [s for s in statuses if s != "not_required" and s != "computed"]
    if not active:
        return "not_required"
    return min(active, key=lambda s: priority.get(s, 99))


@dataclass
class EngineeringState:
    fluid_type: str = "oil"
    eng_power: str = "external"
    eng_injection: str = "centralized"
    eng_gas: str = "well"
    eng_oil_preparation: str = "mkos"
    eng_transport: str = "auto"
    water_injection_volume: float = 0


def is_power_generation(eng_gas: str) -> bool:
    return eng_gas in ("power_generation", "generation")


def format_internal_formula_label(km_per_pad: float, pads_count: int, distance_km: float | None = None) -> str:
    dist = distance_km if distance_km is not None else pads_count * km_per_pad
    return f"{km_per_pad} км/КП × {pads_count} КП = {round(dist, 1)} км"


def apply_engineering_rules(state: EngineeringState) -> dict[str, str]:
    """Returns subtype -> status: active | not_required."""
    statuses: dict[str, str] = {
        "autoroad": "active",
        "oil_pipeline": "active",
        "water_pipeline": "active",
        "power_line": "active",
        "gas_processing": "active",
        "gtes": "active",
        "substation": "active",
        "refinery": "active",
        "ground_pumping_station": "not_required",
        "sand_quarry": "active",
        "pads": "active",
    }

    if state.eng_power == "external":
        statuses["gtes"] = "not_required"
        statuses["power_line"] = "active"
    else:
        statuses["power_line"] = "not_required"
        statuses["gtes"] = "active"

    if state.eng_injection == "centralized":
        statuses["water_pipeline"] = "active"
        if state.water_injection_volume > 0:
            statuses["ground_pumping_station"] = "active"
    elif state.water_injection_volume > 0 and state.eng_injection == "local":
        statuses["water_pipeline"] = "active"
    else:
        statuses["water_pipeline"] = "not_required"

    if state.eng_gas in ("well", "flare"):
        if state.eng_power != "internal":
            statuses["gtes"] = "not_required"

    if state.fluid_type == "gas":
        statuses["refinery"] = "not_required"

    return statuses


def calc_engineering_equipment_cost(
    state: EngineeringState, rates: dict[str, float]
) -> float:
    total = 0.0
    if state.eng_power == "internal":
        total += rates.get("eq_power", 0)
    if state.eng_injection == "local" and state.water_injection_volume > 0:
        total += rates.get("eq_injection", 0)
    if is_power_generation(state.eng_gas) and state.eng_power == "internal":
        total += rates.get("eq_gas", 0)
    if state.fluid_type == "oil" and state.eng_oil_preparation != "mfns":
        from app.services.cost_rates import OIL_PREP_RATE_MAP

        rate_key = OIL_PREP_RATE_MAP.get(state.eng_oil_preparation)
        if rate_key:
            total += rates.get(rate_key, 0)
    return total

