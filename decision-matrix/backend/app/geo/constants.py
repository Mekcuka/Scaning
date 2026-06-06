"""Infrastructure subtype and geometry constants (FR-2.3.9)."""

from app.subtype_manifest import (
    EXTERNAL_POINT_SUBTYPES as _ANALYSIS_EXTERNAL_POINTS,
    GKS_CLUSTER_SUBTYPES,
    GTES_CLUSTER_SUBTYPES,
    LEGACY_SUBTYPE_ALIASES,
    LINEAR_SUBTYPES as _MANIFEST_LINEAR_ALL,
    NODE_CLUSTER_SUBTYPES,
    PAD_CLUSTER_SUBTYPES,
    POINT_MAP_SUBTYPES,
)

POINT_SUBTYPES = frozenset(POINT_MAP_SUBTYPES)
LINE_SUBTYPES = frozenset(_MANIFEST_LINEAR_ALL)
ALL_INFRA_SUBTYPES = POINT_SUBTYPES | LINE_SUBTYPES

# Cluster groups — from shared manifest (clusters.*)
IE_DERIVED_POINT_SUBTYPES = frozenset({"gpes", "vies"})

# Point subtypes that cannot be reclassified after creation (UI + API).
IMMUTABLE_POINT_SUBTYPES = frozenset({
    "sand_quarry",
    "ground_pumping_station",
    "oil_pumping_station",
    "methanol_facility",
    "offplot",
    "additional_facility",
})

# Подтипы, которые нельзя назначить другому объекту через смену подтипа (создание — отдельные правила).
SPARK_EXCLUSIVE_POINT_SUBTYPES: frozenset[str] = frozenset()

# Нельзя назначить другому объекту (создание карьера — «Точка» или импорт Искра).
EXCLUSIVE_POINT_SUBTYPES = frozenset(
    {"sand_quarry", "offplot", "additional_facility", "methanol_facility"}
)

# НПЗ / НПС — отдельный POST .../facility-objects (subtype обязателен в теле).
FACILITY_POINT_SUBTYPES = frozenset({"refinery", "oil_pumping_station"})

# Не в меню «Точка»; создаются импортом Искра, facility-objects API, сменой у базового подтипа или вставкой.
IMPORT_ONLY_POINT_SUBTYPES = frozenset({
    "ukg",
    "tsg",
    "oil_pumping_station",
    "methanol_joint",
    "power_line_node",
    "gas_pad",
})

# Подтип узла без отдельного пункта «Точка» — импорт Искра или смена у объекта «Узел».
NODE_DERIVED_POINT_SUBTYPES = frozenset({"methanol_joint", "power_line_node"})

# Подтип куста без пункта «Точка» — импорт Искра или смена у объекта «Куст» (oil_pad).
PAD_DERIVED_POINT_SUBTYPES = frozenset({"gas_pad"})

# Устаревшие коды подтипов → актуальные (Искра/БД до миграции) — shared manifest.
def normalize_infra_subtype(subtype: str) -> str:
    st = subtype.lower().strip()
    return LEGACY_SUBTYPE_ALIASES.get(st, st)


def subtypes_for_nearest_search(subtype: str) -> frozenset[str]:
    """Analysis row «gtes» ищет ближайший объект любого подтипа кластера ГТЭС."""
    st = subtype.lower().strip()
    if st == "gtes":
        return GTES_CLUSTER_SUBTYPES
    return frozenset({st})


# FR-6.1.2 autosearch — only classic external facilities (from shared manifest)
EXTERNAL_POINT_SUBTYPES = frozenset(_ANALYSIS_EXTERNAL_POINTS)

LINEAR_SUBTYPES = LINE_SUBTYPES

SUBTYPE_CATEGORY: dict[str, str] = {
    "autoroad": "road",
    "oil_pipeline": "pipeline",
    "gas_pipeline": "pipeline",
    "water_pipeline": "pipeline",
    "power_line": "electricity",
    "methanol_pipeline": "pipeline",
    "additional_line": "other",
    "gas_processing": "area_facility",
    "ukg": "area_facility",
    "tsg": "area_facility",
    "gtes": "area_facility",
    "gpes": "area_facility",
    "vies": "area_facility",
    "substation": "electricity",
    "refinery": "area_facility",
    "node": "network",
    "oil_pad": "pad",
    "gas_pad": "pad",
    "preliminary_water_discharge_station": "area_facility",
    "booster_pumping_station": "area_facility",
    "oil_pumping_station": "area_facility",
    "ground_pumping_station": "area_facility",
    "sand_quarry": "area_facility",
    "methanol_facility": "area_facility",
    "methanol_joint": "network",
    "power_line_node": "electricity",
    "offplot": "area_facility",
    "additional_facility": "area_facility",
}

SUBTYPE_LABELS: dict[str, str] = {
    "autoroad": "Автодорога",
    "oil_pipeline": "Нефтепровод",
    "gas_pipeline": "Газопровод",
    "water_pipeline": "Водопровод",
    "power_line": "ЛЭП",
    "methanol_pipeline": "Метанолопровод",
    "gas_processing": "ГКС",
    "ukg": "УКГ",
    "tsg": "ТСГ",
    "gtes": "ГТЭС",
    "gpes": "ГПЭС",
    "vies": "ВИЭС",
    "substation": "ПС/ТП",
    "refinery": "НПЗ",
    "node": "Узел",
    "oil_pad": "Нефтяной куст",
    "gas_pad": "Газовый куст",
    "preliminary_water_discharge_station": "УПСВ",
    "booster_pumping_station": "ДНС",
    "oil_pumping_station": "НПС",
    "ground_pumping_station": "БКНС",
    "sand_quarry": "Карьер песка",
    "methanol_facility": "Объект метанола",
    "methanol_joint": "Узел метанола",
    "power_line_node": "Узел ЛЭП",
    "additional_line": "Доп. линия",
    "additional_facility": "Доп. объект",
    "offplot": "ВО",
}

# Autoroad network planner: no link/junction geometry inside this radius (km) around terminals.
TERMINAL_EXCLUSION_RADIUS_KM = 0.2
