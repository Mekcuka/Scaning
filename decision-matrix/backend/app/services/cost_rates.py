"""Default cost rates (FR-4.1.2) — values in thousand RUB."""

DEFAULT_COST_RATES: dict[str, float] = {
    "autoroad": 5000,
    "oil_pipeline": 8000,
    "gas_pipeline": 7500,
    "water_pipeline": 6000,
    "power_line": 3000,
    "gas_processing": 500000,
    "gtes": 600000,
    "substation": 200000,
    "refinery": 0,
    "pads": 200000,
    "eq_power": 450000,
    "eq_injection": 150000,
    "eq_gas": 0,
    "eq_mkos": 100000,
    "eq_bmupn": 120000,
    "eq_cps": 150000,
    "eq_upsv": 130000,
}

OIL_PREP_RATE_MAP = {
    "mkos": "eq_mkos",
    "bmupn": "eq_bmupn",
    "cps": "eq_cps",
    "upsv": "eq_upsv",
    "mfns": None,
}

# FR-6.1.1: 4 internal linear subtypes in environment analysis (gas_pipeline — map/import only)
ANALYSIS_LINEAR_SUBTYPES = ("autoroad", "oil_pipeline", "water_pipeline", "power_line")
LINEAR_SUBTYPES = ANALYSIS_LINEAR_SUBTYPES
EXTERNAL_POINT_SUBTYPES = ("gas_processing", "gtes", "substation", "refinery")
ANALYSIS_SUBTYPES = (*ANALYSIS_LINEAR_SUBTYPES, *EXTERNAL_POINT_SUBTYPES, "pads")
