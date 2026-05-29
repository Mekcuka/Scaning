"""Default economic flow parameters (prices and OPEX) — values in thousand RUB."""

DEFAULT_ECONOMIC_PARAMS: dict[str, float] = {
    "oil_price_thousand_rub_per_t": 35.0,
    "gas_price_thousand_rub_per_m3": 8.0,
    "opex_oil_pipeline_per_km": 120.0,
    "opex_water_pipeline_per_km": 90.0,
    "opex_gas_pipeline_per_km": 100.0,
    "opex_pads_per_pad": 5000.0,
    "opex_eq_mkos": 8000.0,
    "opex_eq_bmupn": 9000.0,
    "opex_eq_cps": 10000.0,
    "opex_eq_upsv": 9500.0,
    "opex_eq_injection": 6000.0,
    "opex_refinery": 15000.0,
    "opex_gas_processing": 12000.0,
    "opex_gtes": 14000.0,
    "opex_gpes": 14000.0,
    "opex_vies": 14000.0,
    "opex_substation": 8000.0,
    "opex_ground_pumping_station": 7000.0,
}

OPEX_TERMINAL_KEYS = {
    "refinery": "opex_refinery",
    "gas_processing": "opex_gas_processing",
    "gtes": "opex_gtes",
    "gpes": "opex_gpes",
    "vies": "opex_vies",
    "substation": "opex_substation",
    "ground_pumping_station": "opex_ground_pumping_station",
    "oil_pumping_station": "opex_refinery",
}

OPEX_PIPELINE_KEYS = {
    "oil_pipeline": "opex_oil_pipeline_per_km",
    "water_pipeline": "opex_water_pipeline_per_km",
    "gas_pipeline": "opex_gas_pipeline_per_km",
}

OPEX_EQUIPMENT_KEYS = {
    "mkos": "opex_eq_mkos",
    "bmupn": "opex_eq_bmupn",
    "cps": "opex_eq_cps",
    "upsv": "opex_eq_upsv",
}

REVENUE_TERMINAL_SUBTYPES = frozenset(
    {"refinery", "oil_pumping_station", "gas_processing", "gtes", "gpes", "vies"}
)
