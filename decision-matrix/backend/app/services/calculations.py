import math
from dataclasses import dataclass
from typing import Any


def calc_wells_total(planned_production: float, production_per_well: float) -> float:
    if production_per_well <= 0:
        return 0
    return planned_production / production_per_well


def calc_pads_count(planned_production: float, production_per_well: float, wells_per_pad: int) -> int:
    if planned_production <= 0 or production_per_well <= 0 or wells_per_pad <= 0:
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
    if not active:
        return "not_required"
    if force_construction:
        return "construction_required"
    if distance_km > max_total_line_km:
        return "exceeds_limit"
    return "within_limit"


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


def apply_engineering_rules(state: EngineeringState) -> dict[str, str]:
    """Returns subtype -> status: active | not_required | excluded."""
    statuses: dict[str, str] = {
        "autoroad": "active",
        "oil_pipeline": "active",
        "gas_pipeline": "active",
        "water_pipeline": "active",
        "power_line": "active",
        "gas_processing": "active",
        "gtes": "active",
        "substation": "active",
        "refinery": "active",
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
    elif state.water_injection_volume > 0 and state.eng_injection == "local":
        statuses["water_pipeline"] = "active"
    else:
        statuses["water_pipeline"] = "not_required"

    if state.eng_gas in ("well", "flare"):
        if state.eng_power != "internal":
            statuses["gtes"] = "not_required"

    if state.fluid_type == "gas":
        if state.eng_transport == "auto":
            statuses["oil_pipeline"] = "not_required"
        statuses["refinery"] = "not_required"
    else:
        statuses["gas_pipeline"] = "not_required"

    return statuses


def calc_engineering_equipment_cost(
    state: EngineeringState, rates: dict[str, float]
) -> float:
    total = 0.0
    if state.eng_power == "internal":
        total += rates.get("eq_power", 0)
    if state.eng_injection == "local" and state.water_injection_volume > 0:
        total += rates.get("eq_injection", 0)
    if state.eng_gas == "generation" and state.eng_power == "internal":
        total += rates.get("eq_gas", 0)
    if state.fluid_type == "oil" and state.eng_oil_preparation != "mfns":
        from app.services.cost_rates import OIL_PREP_RATE_MAP

        rate_key = OIL_PREP_RATE_MAP.get(state.eng_oil_preparation)
        if rate_key:
            total += rates.get(rate_key, 0)
    return total


def normalize_matrix(values: list[list[float]], criterion_types: list[str]) -> list[list[float]]:
    """Min-max normalization per column."""
    if not values or not values[0]:
        return values
    cols = len(values[0])
    result = [[0.0] * cols for _ in values]
    for j in range(cols):
        col = [row[j] for row in values]
        mn, mx = min(col), max(col)
        for i, v in enumerate(col):
            if mx == mn:
                result[i][j] = 1.0
            elif criterion_types[j] == "cost":
                result[i][j] = (mx - v) / (mx - mn)
            else:
                result[i][j] = (v - mn) / (mx - mn)
    return result


def calc_wsm_scores(normalized: list[list[float]], weights: list[float]) -> list[float]:
    return [sum(v * w for v, w in zip(row, weights)) for row in normalized]


def calc_topsis_scores(normalized: list[list[float]], weights: list[float]) -> list[float]:
    import numpy as np

    mat = np.array(normalized, dtype=float)
    w = np.array(weights, dtype=float)
    weighted = mat * w
    ideal = weighted.max(axis=0)
    nadir = weighted.min(axis=0)
    d_plus = np.sqrt(((weighted - ideal) ** 2).sum(axis=1))
    d_minus = np.sqrt(((weighted - nadir) ** 2).sum(axis=1))
    with np.errstate(divide="ignore", invalid="ignore"):
        scores = d_minus / (d_plus + d_minus)
        scores = np.nan_to_num(scores, nan=0.0)
    return scores.tolist()


def rank_alternatives(scores: list[float]) -> list[dict[str, Any]]:
    indexed = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
    return [{"index": i, "score": round(s, 4), "rank": r + 1} for r, (i, s) in enumerate(indexed)]
