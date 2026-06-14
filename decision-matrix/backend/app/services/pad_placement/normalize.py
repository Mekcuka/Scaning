"""Bottomhole snapshots → logical wells for pad placement."""

from __future__ import annotations

from uuid import UUID

from app.services.pad_placement.schemas import BottomholeSnapshot, LogicalWell
from app.services.well_trajectory.bottomhole_properties import (
    GS_HEEL_ID,
    GS_HEEL_TVD_M,
    GS_TOE_TVD_M,
    TARGET_AZI,
    TARGET_INC,
    TVD_M,
    DEFAULT_TVD_M,
)


def normalize_bottomholes(
    snapshots: list[BottomholeSnapshot],
    *,
    require_tvd: bool = True,
) -> tuple[list[LogicalWell], list[str]]:
    """Group GS heel+toe; validate coordinates and TVD."""
    warnings: list[str] = []
    by_id = {s.id: s for s in snapshots}
    used: set[UUID] = set()
    logical: list[LogicalWell] = []

    for snap in snapshots:
        if snap.id in used:
            continue
        st = (snap.subtype or "").lower().strip()
        if st == "well_bottomhole_nnb":
            tvd = _read_tvd(snap)
            if tvd is None:
                if require_tvd:
                    warnings.append(f"{snap.name or snap.id}: missing TVD")
                    continue
                tvd = DEFAULT_TVD_M
            logical.append(
                LogicalWell(
                    logical_id=f"nnb:{snap.id}",
                    profile="nnb",
                    bottomhole_ids=[snap.id],
                    td_longitude=snap.longitude,
                    td_latitude=snap.latitude,
                    tvd_m=tvd,
                    target_inc=_read_float_prop(snap, TARGET_INC),
                    target_azi=_read_float_prop(snap, TARGET_AZI),
                )
            )
            used.add(snap.id)
            continue

        if st == "well_bottomhole_gs":
            if snap.end_longitude is None or snap.end_latitude is None:
                warnings.append(f"{snap.name or snap.id}: GS missing toe endpoint")
                continue
            props = snap.properties or {}
            heel_tvd = _read_float_prop(snap, GS_HEEL_TVD_M) or _read_tvd(snap)
            toe_tvd = _read_float_prop(snap, GS_TOE_TVD_M) or _read_tvd(snap)
            if heel_tvd is None or toe_tvd is None:
                if require_tvd:
                    warnings.append(f"{snap.name or snap.id}: GS missing TVD")
                    continue
                heel_tvd = heel_tvd or DEFAULT_TVD_M
                toe_tvd = toe_tvd or DEFAULT_TVD_M
            logical.append(
                LogicalWell(
                    logical_id=f"gs:{snap.id}",
                    profile="gs",
                    bottomhole_ids=[snap.id],
                    td_longitude=snap.end_longitude,
                    td_latitude=snap.end_latitude,
                    tvd_m=toe_tvd,
                    target_inc=_read_float_prop(snap, TARGET_INC),
                    target_azi=_read_float_prop(snap, TARGET_AZI),
                    heel_longitude=snap.longitude,
                    heel_latitude=snap.latitude,
                )
            )
            used.add(snap.id)
            continue

        if st == "well_bottomhole_gs_heel":
            toe = _find_gs_toe(snap.id, snapshots, by_id)
            if toe is None:
                warnings.append(f"{snap.name or snap.id}: GS heel without toe")
                continue
            tvd = _read_tvd(snap) or _read_tvd(toe)
            if tvd is None:
                if require_tvd:
                    warnings.append(f"{snap.name or snap.id}: GS missing TVD")
                    continue
                tvd = DEFAULT_TVD_M
            logical.append(
                LogicalWell(
                    logical_id=f"gs:{snap.id}",
                    profile="gs",
                    bottomhole_ids=[snap.id, toe.id],
                    td_longitude=toe.longitude,
                    td_latitude=toe.latitude,
                    tvd_m=tvd,
                    target_inc=_read_float_prop(snap, TARGET_INC),
                    target_azi=_read_float_prop(snap, TARGET_AZI),
                    heel_longitude=snap.longitude,
                    heel_latitude=snap.latitude,
                )
            )
            used.add(snap.id)
            used.add(toe.id)
            continue

        if st == "well_bottomhole_gs_toe":
            if snap.id not in used:
                warnings.append(f"{snap.name or snap.id}: GS toe without heel in selection")
            continue

        warnings.append(f"{snap.name or snap.id}: unsupported subtype {snap.subtype!r}")

    return logical, warnings


def _read_tvd(snap: BottomholeSnapshot) -> float | None:
    raw = snap.properties.get(TVD_M)
    if raw is None or raw == "":
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _read_float_prop(snap: BottomholeSnapshot, key: str) -> float | None:
    raw = snap.properties.get(key)
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _find_gs_toe(
    heel_id: UUID,
    snapshots: list[BottomholeSnapshot],
    by_id: dict[UUID, BottomholeSnapshot],
) -> BottomholeSnapshot | None:
    for snap in snapshots:
        if (snap.subtype or "").lower().strip() != "well_bottomhole_gs_toe":
            continue
        raw = snap.properties.get(GS_HEEL_ID)
        if raw and str(raw) == str(heel_id):
            return snap
    return None
