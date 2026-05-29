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


# Saaty random index for consistency ratio (n = 1..15)
_AHP_RANDOM_INDEX = [0.0, 0.0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51, 1.48, 1.56, 1.57, 1.59]


def calc_ahp_weights(pairwise: dict[str, dict[str, float]]) -> dict[str, float]:
    """Derive normalized weights from pairwise comparison matrix (row geometric mean method)."""
    import numpy as np

    ids = list(pairwise.keys())
    if not ids:
        return {}
    n = len(ids)
    mat = np.ones((n, n), dtype=float)
    for i, a in enumerate(ids):
        for j, b in enumerate(ids):
            if i == j:
                mat[i, j] = 1.0
            else:
                val = pairwise.get(a, {}).get(b)
                if val is None or val <= 0:
                    val = 1.0 / max(pairwise.get(b, {}).get(a, 1.0), 1e-9)
                mat[i, j] = float(val)
    row_products = np.prod(mat, axis=1) ** (1.0 / n)
    total = row_products.sum()
    if total <= 0:
        return {cid: 1.0 / n for cid in ids}
    weights = row_products / total
    return {ids[i]: float(weights[i]) for i in range(n)}


def calc_ahp_consistency_ratio(pairwise: dict[str, dict[str, float]]) -> float:
    """Consistency ratio; values > 0.1 indicate inconsistent judgments."""
    import numpy as np

    ids = list(pairwise.keys())
    n = len(ids)
    if n < 2:
        return 0.0
    weights = calc_ahp_weights(pairwise)
    w = np.array([weights[cid] for cid in ids], dtype=float)
    mat = np.ones((n, n), dtype=float)
    for i, a in enumerate(ids):
        for j, b in enumerate(ids):
            if i != j:
                val = pairwise.get(a, {}).get(b)
                if val is None or val <= 0:
                    val = 1.0 / max(pairwise.get(b, {}).get(a, 1.0), 1e-9)
                mat[i, j] = float(val)
    aw = mat @ w
    with np.errstate(divide="ignore", invalid="ignore"):
        lambdas = np.where(w > 1e-12, aw / w, 0.0)
    lambda_max = float(np.mean(lambdas))
    ci = (lambda_max - n) / max(n - 1, 1)
    ri = _AHP_RANDOM_INDEX[min(n, len(_AHP_RANDOM_INDEX) - 1)]
    if ri <= 0:
        return 0.0
    return float(ci / ri)


def rebalance_weights(base_weights: dict[str, float], target_id: str, delta: float) -> dict[str, float]:
    weights = {k: float(v) for k, v in base_weights.items()}
    if target_id not in weights:
        raise KeyError(target_id)
    old_target = weights[target_id]
    new_target = max(0.01, min(0.95, old_target + delta))
    remainder_old = max(1e-6, 1.0 - old_target)
    remainder_new = 1.0 - new_target
    for key in weights:
        if key == target_id:
            weights[key] = new_target
        else:
            weights[key] = max(0.0, weights[key] * (remainder_new / remainder_old))
    total = sum(weights.values())
    return {k: v / total for k, v in weights.items()}
