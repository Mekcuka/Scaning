"""Infrastructure subtype and geometry constants (FR-2.3.9)."""

from app.subtype_manifest import (
    EXCLUSIVE_POINT_SUBTYPES,
    EXTERNAL_POINT_SUBTYPES as _ANALYSIS_EXTERNAL_POINTS,
    FACILITY_POINT_SUBTYPES,
    GKS_CLUSTER_SUBTYPES,
    GTES_CLUSTER_SUBTYPES,
    BOTTOMHOLE_CLUSTER_SUBTYPES,
    IE_DERIVED_POINT_SUBTYPES,
    IMMUTABLE_POINT_SUBTYPES,
    IMPORT_ONLY_POINT_SUBTYPES,
    LEGACY_SUBTYPE_ALIASES,
    LINEAR_SUBTYPES as _MANIFEST_LINEAR_ALL,
    NODE_CLUSTER_SUBTYPES,
    NODE_DERIVED_POINT_SUBTYPES,
    PAD_CLUSTER_SUBTYPES,
    PAD_DERIVED_POINT_SUBTYPES,
    POINT_MAP_SUBTYPES,
    SPARK_EXCLUSIVE_POINT_SUBTYPES,
    SUBTYPE_CATEGORY,
    SUBTYPE_LABELS,
)

POINT_SUBTYPES = frozenset(POINT_MAP_SUBTYPES)
LINE_SUBTYPES = frozenset(_MANIFEST_LINEAR_ALL)
ALL_INFRA_SUBTYPES = POINT_SUBTYPES | LINE_SUBTYPES


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

# Autoroad network planner: no link/junction geometry inside this radius (km) around terminals.
TERMINAL_EXCLUSION_RADIUS_KM = 0.2

# Max point objects per autoroad connect / network build request.
MAX_AUTOROAD_NETWORK_OBJECTS = 200

# Terminals excluded from autoroad network planner (nodes/junctions + well bottomholes).
AUTOROAD_NETWORK_EXCLUDED_TERMINAL_SUBTYPES = NODE_CLUSTER_SUBTYPES | BOTTOMHOLE_CLUSTER_SUBTYPES


def is_autoroad_network_terminal_subtype(subtype: str) -> bool:
    st = subtype.lower().strip()
    return st not in AUTOROAD_NETWORK_EXCLUDED_TERMINAL_SUBTYPES
