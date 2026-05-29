"""Default cost rates (FR-4.1.2) — values in thousand RUB."""

DEFAULT_COST_RATES: dict[str, float] = {
    "autoroad": 5000,
    "oil_pipeline": 8000,
    "gas_pipeline": 7500,
    "water_pipeline": 6000,
    "power_line": 3000,
    "methanol_pipeline": 5500,
    "additional_line": 5000,
    "gas_processing": 500000,
    "gtes": 600000,
    "gpes": 600000,
    "vies": 600000,
    "substation": 200000,
    "refinery": 500000,
    "ground_pumping_station": 400000,
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

# FR-6.1.1: 4 internal linear — formula km/КП×кусты; all drawable lines also in external_linear search
ANALYSIS_LINEAR_SUBTYPES = ("autoroad", "oil_pipeline", "water_pipeline", "power_line")
LINEAR_SUBTYPES = (
    "autoroad",
    "oil_pipeline",
    "gas_pipeline",
    "water_pipeline",
    "power_line",
    "methanol_pipeline",
    "additional_line",
)
EXTERNAL_LINEAR_SUBTYPES = LINEAR_SUBTYPES
EXTERNAL_POINT_SUBTYPES = (
    "gas_processing",
    "gtes",
    "substation",
    "refinery",
    "ground_pumping_station",
)
ANALYSIS_SUBTYPES = (
    *ANALYSIS_LINEAR_SUBTYPES,
    *EXTERNAL_LINEAR_SUBTYPES,
    *EXTERNAL_POINT_SUBTYPES,
    "pads",
)
