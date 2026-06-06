"""Default cost rates (FR-4.1.2) — values in thousand RUB."""

from app.subtype_manifest import (
    ANALYSIS_LINEAR_SUBTYPES,
    ANALYSIS_SUBTYPES,
    EXTERNAL_LINEAR_SUBTYPES,
    EXTERNAL_POINT_SUBTYPES,
    LINEAR_SUBTYPES,
)

DEFAULT_COST_RATES: dict[str, float] = {
    "autoroad": 5000,
    "oil_pipeline": 8000,
    "gas_pipeline": 7500,
    "water_pipeline": 6000,
    "power_line": 3000,
    "methanol_pipeline": 5500,
    "additional_line": 5000,
    "gas_processing": 500000,
    "ukg": 500000,
    "tsg": 500000,
    "gtes": 600000,
    "gpes": 600000,
    "vies": 600000,
    "substation": 200000,
    "refinery": 500000,
    "oil_pumping_station": 400000,
    "preliminary_water_discharge_station": 300000,
    "booster_pumping_station": 350000,
    "ground_pumping_station": 400000,
    "sand_quarry": 150000,
    "methanol_facility": 200000,
    "offplot": 150000,
    "additional_facility": 200000,
    "pads": 200000,
    "eq_power": 450000,
    "eq_injection": 150000,
    "eq_gas": 450000,
    "eq_mkos": 100000,
    "eq_bmupn": 120000,
    "eq_cps": 150000,
    "eq_upsv": 130000,
}


def merge_project_cost_rates(stored: dict[str, float] | None) -> dict[str, float]:
    """Apply project overrides; explicit 0 must not mask non-zero defaults."""
    merged = dict(DEFAULT_COST_RATES)
    if not stored:
        return merged
    for key, value in stored.items():
        if key in DEFAULT_COST_RATES and value == 0:
            continue
        merged[key] = value
    return merged


OIL_PREP_RATE_MAP = {
    "mkos": "eq_mkos",
    "bmupn": "eq_bmupn",
    "cps": "eq_cps",
    "upsv": "eq_upsv",
    "mfns": None,
}
