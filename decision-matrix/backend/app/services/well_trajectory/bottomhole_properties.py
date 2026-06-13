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
TARGET_INC = "well_bottomhole_target_inc"
TARGET_AZI = "well_bottomhole_target_azi"
GS_HEEL_ID = "well_bottomhole_gs_heel_id"

DEFAULT_NNB_INC = 360.0
DEFAULT_TVD_M = 1500.0

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


def read_gs_heel_id(props: dict[str, Any]) -> UUID | None:
    raw = props.get(GS_HEEL_ID)
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


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


def apply_bottomhole_defaults(
    subtype: str,
    props: dict[str, Any],
    *,
    pad: InfrastructureObject | None = None,
) -> dict[str, Any]:
    from app.geo.sand_properties import strip_sand_volume_properties

    merged = strip_sand_volume_properties(props)
    if TVD_M not in merged:
        merged[TVD_M] = default_tvd_m_for_bottomhole(pad, merged)
    st = subtype.lower().strip()
    if st == "well_bottomhole_nnb" and TARGET_INC not in merged:
        merged[TARGET_INC] = DEFAULT_NNB_INC
    return merged


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
