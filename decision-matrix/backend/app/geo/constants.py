"""Infrastructure subtype and geometry constants (FR-2.3.9)."""

POINT_SUBTYPES = frozenset({"gas_processing", "gtes", "substation", "refinery", "node"})
LINE_SUBTYPES = frozenset({"autoroad", "oil_pipeline", "gas_pipeline", "water_pipeline", "power_line"})
ALL_INFRA_SUBTYPES = POINT_SUBTYPES | LINE_SUBTYPES

SUBTYPE_CATEGORY: dict[str, str] = {
    "autoroad": "road",
    "oil_pipeline": "pipeline",
    "gas_pipeline": "pipeline",
    "water_pipeline": "pipeline",
    "power_line": "electricity",
    "gas_processing": "area_facility",
    "gtes": "area_facility",
    "substation": "electricity",
    "refinery": "area_facility",
    "node": "network",
}

EXTERNAL_POINT_SUBTYPES = POINT_SUBTYPES
LINEAR_SUBTYPES = LINE_SUBTYPES
