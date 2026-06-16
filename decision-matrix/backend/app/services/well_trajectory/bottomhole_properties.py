"""Property keys and parsing for well bottomhole infrastructure objects."""

from __future__ import annotations

import math
from typing import Any
from uuid import UUID

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import read_nds_deg, read_wells_local
from app.services.well_trajectory.coord_transform import lonlat_to_local
from app.subtype_manifest import BOTTOMHOLE_CLUSTER_SUBTYPES, PAD_CLUSTER_SUBTYPES

LINKED_PAD_ID = "well_bottomhole_linked_pad_id"
WELL_INDEX = "well_bottomhole_well_index"
TVD_M = "well_bottomhole_tvd_m"
GS_HEEL_TVD_M = "well_bottomhole_heel_tvd_m"
GS_TOE_TVD_M = "well_bottomhole_toe_tvd_m"
TARGET_INC = "well_bottomhole_target_inc"
TARGET_AZI = "well_bottomhole_target_azi"
GS_HEEL_ID = "well_bottomhole_gs_heel_id"
GS_ENTRY_MODE = "well_bottomhole_gs_entry_mode"
BOTTOMHOLE_ROLE = "well_bottomhole_role"
PARENT_ID = "well_bottomhole_parent_id"

DEFAULT_NNB_INC = 360.0
DEFAULT_BOTTOMHOLE_ROLE = "main"
BOTTOMHOLE_ROLES = frozenset({"main", "lateral"})
DEFAULT_TVD_M = 1500.0
DEFAULT_GS_ENTRY_MODE = "any"
GS_ENTRY_MODES = frozenset({"any", "heel", "toe"})

# User-facing labels for GS horizontal ends (Т1 = kick-off side, Т3 = toe side).
GS_HEEL_LABEL = "Т1"
GS_TOE_LABEL = "Т3"

BOTTOMHOLE_SUBTYPES = frozenset(BOTTOMHOLE_CLUSTER_SUBTYPES)


def is_bottomhole_subtype(subtype: str) -> bool:
    return subtype.lower().strip() in BOTTOMHOLE_SUBTYPES


def _read_optional_int(props: dict[str, Any], key: str) -> int | None:
    raw = props.get(key)
    if raw is None or raw == "":
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if value < 0 or value > 63:
        return None
    return value


def _read_float(props: dict[str, Any], key: str, default: float | None = None) -> float | None:
    raw = props.get(key)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


def read_linked_pad_id(props: dict[str, Any]) -> UUID | None:
    raw = props.get(LINKED_PAD_ID)
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def read_bottomhole_role(props: dict[str, Any]) -> str:
    raw = str(props.get(BOTTOMHOLE_ROLE) or DEFAULT_BOTTOMHOLE_ROLE).lower().strip()
    if raw in BOTTOMHOLE_ROLES:
        return raw
    return DEFAULT_BOTTOMHOLE_ROLE


def is_lateral_bottomhole(props: dict[str, Any]) -> bool:
    return read_bottomhole_role(props) == "lateral"


def is_main_bottomhole(props: dict[str, Any]) -> bool:
    return read_bottomhole_role(props) == "main"


def read_parent_id(props: dict[str, Any]) -> UUID | None:
    raw = props.get(PARENT_ID)
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def apply_lateral_inheritance_from_parent(
    props: dict[str, Any],
    parent: InfrastructureObject | None,
) -> dict[str, Any]:
    """For role=lateral: inherit linked_pad_id and well_index from parent main bottomhole."""
    merged = dict(props)
    if not is_lateral_bottomhole(merged):
        if is_main_bottomhole(merged):
            merged.pop(PARENT_ID, None)
        return merged
    if parent is None:
        return merged
    parent_props = parent.properties or {}
    parent_pad = read_linked_pad_id(parent_props)
    if parent_pad is not None:
        merged[LINKED_PAD_ID] = str(parent_pad)
    parent_idx = _read_optional_int(parent_props, WELL_INDEX)
    if parent_idx is not None:
        merged[WELL_INDEX] = parent_idx
    return merged


def read_gs_heel_id(props: dict[str, Any]) -> UUID | None:
    raw = props.get(GS_HEEL_ID)
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def read_gs_entry_mode(props: dict[str, Any]) -> str:
    raw = str(props.get(GS_ENTRY_MODE) or DEFAULT_GS_ENTRY_MODE).lower().strip()
    if raw in GS_ENTRY_MODES:
        return raw
    return DEFAULT_GS_ENTRY_MODE


def nearest_well_index(pad: InfrastructureObject, lon: float, lat: float) -> int:
    wells = read_wells_local(pad.properties or {})
    if not wells:
        return 0
    anchor_lon = float(pad.longitude)
    anchor_lat = float(pad.latitude)
    east_m, north_m = lonlat_to_local(anchor_lon, anchor_lat, lon, lat)
    best_i = 0
    best_d = float("inf")
    for i, well in enumerate(wells):
        de = well.east_m - east_m
        dn = well.north_m - north_m
        dist_sq = de * de + dn * dn
        if dist_sq < best_d:
            best_d = dist_sq
            best_i = i
    return best_i


def resolve_well_index(
    pad: InfrastructureObject,
    obj: InfrastructureObject,
    *,
    explicit_index: int | None = None,
) -> int:
    if explicit_index is not None:
        return explicit_index
    props = obj.properties or {}
    stored = _read_optional_int(props, WELL_INDEX)
    if stored is not None:
        return stored
    return nearest_well_index(pad, float(obj.longitude), float(obj.latitude))


def default_tvd_m_for_bottomhole(
    pad: InfrastructureObject | None,
    props: dict[str, Any],
) -> float:
    raw = props.get(TVD_M)
    if raw is not None and raw != "":
        parsed = _read_float(props, TVD_M, DEFAULT_TVD_M)
        if parsed is not None:
            return parsed
    if pad is not None:
        from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad

        return well_trajectory_settings_for_pad(pad).default_target_tvd_m or DEFAULT_TVD_M
    return DEFAULT_TVD_M


def read_gs_heel_tvd_m(pad: InfrastructureObject | None, props: dict[str, Any]) -> float:
    parsed = _read_float(props, GS_HEEL_TVD_M)
    if parsed is not None and parsed > 0:
        return parsed
    return default_tvd_m_for_bottomhole(pad, props)


def read_gs_toe_tvd_m(pad: InfrastructureObject | None, props: dict[str, Any]) -> float:
    parsed = _read_float(props, GS_TOE_TVD_M)
    if parsed is not None and parsed > 0:
        return parsed
    return default_tvd_m_for_bottomhole(pad, props)


def apply_bottomhole_defaults(
    subtype: str,
    props: dict[str, Any],
    *,
    pad: InfrastructureObject | None = None,
) -> dict[str, Any]:
    from app.geo.sand_properties import strip_sand_volume_properties

    merged = strip_sand_volume_properties(props)
    if BOTTOMHOLE_ROLE not in merged:
        merged[BOTTOMHOLE_ROLE] = DEFAULT_BOTTOMHOLE_ROLE
    if TVD_M not in merged:
        merged[TVD_M] = default_tvd_m_for_bottomhole(pad, merged)
    st = subtype.lower().strip()
    if st == "well_bottomhole_nnb" and TARGET_INC not in merged:
        merged[TARGET_INC] = DEFAULT_NNB_INC
    if st == "well_bottomhole_gs_heel" and GS_ENTRY_MODE not in merged:
        merged[GS_ENTRY_MODE] = DEFAULT_GS_ENTRY_MODE
    if st == "well_bottomhole_gs" and GS_ENTRY_MODE not in merged:
        merged[GS_ENTRY_MODE] = DEFAULT_GS_ENTRY_MODE
    if st == "well_bottomhole_gs":
        base_tvd = default_tvd_m_for_bottomhole(pad, merged)
        if GS_HEEL_TVD_M not in merged:
            merged[GS_HEEL_TVD_M] = base_tvd
        if GS_TOE_TVD_M not in merged:
            merged[GS_TOE_TVD_M] = base_tvd
    return merged


def is_gs_bottomhole_line(obj: InfrastructureObject) -> bool:
    return (obj.subtype or "").lower().strip() == "well_bottomhole_gs"


def read_gs_line_endpoints(
    obj: InfrastructureObject,
) -> tuple[float, float, float, float] | None:
    if not is_gs_bottomhole_line(obj):
        return None
    props = obj.properties or {}
    raw_coords = props.get("coordinates")
    coords: list[list[float]] | None = None
    if isinstance(raw_coords, list) and len(raw_coords) >= 2:
        coords = [[float(c[0]), float(c[1])] for c in raw_coords]

    if obj.end_longitude is not None and obj.end_latitude is not None:
        heel_lon = float(obj.longitude)
        heel_lat = float(obj.latitude)
        toe_lon = float(obj.end_longitude)
        toe_lat = float(obj.end_latitude)
        if coords is not None and len(coords) == 2:
            c0, c1 = coords[0], coords[1]
            scalars_match = (
                abs(c0[0] - heel_lon) < 1e-9
                and abs(c0[1] - heel_lat) < 1e-9
                and abs(c1[0] - toe_lon) < 1e-9
                and abs(c1[1] - toe_lat) < 1e-9
            )
            if not scalars_match:
                return heel_lon, heel_lat, toe_lon, toe_lat
        return heel_lon, heel_lat, toe_lon, toe_lat

    if coords is not None:
        c0, c1 = coords[0], coords[-1]
        return c0[0], c0[1], c1[0], c1[1]
    return None


def bottomhole_plan_local(
    pad: InfrastructureObject,
    obj: InfrastructureObject,
) -> tuple[float, float, float, float, float]:
    anchor_lon = float(pad.longitude)
    anchor_lat = float(pad.latitude)
    lon = float(obj.longitude)
    lat = float(obj.latitude)
    east_m, north_m = lonlat_to_local(anchor_lon, anchor_lat, lon, lat)
    props = obj.properties or {}
    tvd_m = default_tvd_m_for_bottomhole(pad, props)
    return east_m, north_m, lon, lat, tvd_m


def target_inc_azi(
    obj: InfrastructureObject,
    pad: InfrastructureObject,
) -> tuple[float, float]:
    props = obj.properties or {}
    inc = _read_float(props, TARGET_INC, DEFAULT_NNB_INC) or DEFAULT_NNB_INC
    azi = _read_float(props, TARGET_AZI)
    if azi is None:
        azi = read_nds_deg(pad.properties or {})
    return inc, azi


def azimuth_deg(n1: float, e1: float, n2: float, e2: float) -> float:
    return math.degrees(math.atan2(e2 - e1, n2 - n1)) % 360.0


def assert_pad_subtype(pad: InfrastructureObject) -> None:
    if pad.subtype not in PAD_CLUSTER_SUBTYPES:
        raise ValueError("linked_pad_id must reference oil_pad or gas_pad")
