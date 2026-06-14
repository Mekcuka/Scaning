"""Sync well bottomhole infra objects into pad trajectory targets."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import (
    BOTTOMHOLE_SUBTYPES,
    WELL_INDEX,
    azimuth_deg,
    bottomhole_plan_local,
    default_tvd_m_for_bottomhole,
    is_gs_bottomhole_line,
    read_gs_entry_mode,
    read_gs_heel_id,
    read_gs_heel_tvd_m,
    read_gs_line_endpoints,
    read_gs_toe_tvd_m,
    read_linked_pad_id,
    target_inc_azi,
)
from app.services.well_trajectory.coord_transform import lonlat_to_local
from app.services.well_trajectory.trajectory_store import read_trajectories_json


def _wells_local_count(pad: InfrastructureObject) -> int:
    raw = (pad.properties or {}).get("pad_wells_local_json")
    if isinstance(raw, list):
        return len(raw)
    return 0


def _reset_well_to_stub(well: dict[str, Any], pad: InfrastructureObject) -> dict[str, Any]:
    """Drop bottomhole target / designed survey; restore vertical stub at wellhead."""
    from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad

    stub_tvd = well_trajectory_settings_for_pad(pad).stub_tvd_m
    out = dict(well)
    out.pop("target", None)
    out.pop("geometry", None)
    out.pop("design", None)
    survey = out.get("survey")
    stations = survey.get("stations") if isinstance(survey, dict) else None
    if not isinstance(stations, list) or not stations:
        out["survey"] = {"source": "stub", "stations": []}
        return out
    head = dict(stations[0])
    md0 = float(head.get("md", 0) or 0)
    tvd0 = float(head.get("tvd", 0) or 0)
    out["survey"] = {
        "source": "stub",
        "stations": [
            head,
            {
                **head,
                "md": md0 + stub_tvd,
                "tvd": tvd0 + stub_tvd,
                "inc": 0.0,
            },
        ],
    }
    return out


def _well_has_bottomhole_design(well: dict[str, Any]) -> bool:
    if well.get("target"):
        return True
    survey = well.get("survey")
    if isinstance(survey, dict) and survey.get("source") == "calculated":
        return True
    if well.get("geometry"):
        return True
    design = well.get("design")
    return isinstance(design, dict) and design.get("source") == "bottomhole_object"


def _bottomhole_linked_to_pad(obj: InfrastructureObject, pad_id: UUID, pad_key: str) -> bool:
    props = obj.properties or {}
    linked_pad = read_linked_pad_id(props)
    if linked_pad == pad_id:
        return True
    return linked_pad is None and props.get("well_bottomhole_linked_pad_id") == pad_key


def bottomholes_for_pad_from_objects(
    objects: list[InfrastructureObject],
    pad_id: UUID,
) -> list[InfrastructureObject]:
    """Pad-linked bottomholes plus GS toe/heel pairs missing direct pad link."""
    pad_key = str(pad_id)
    linked: list[InfrastructureObject] = []
    linked_ids: set[UUID] = set()
    for obj in objects:
        if _bottomhole_linked_to_pad(obj, pad_id, pad_key):
            linked.append(obj)
            linked_ids.add(obj.id)

    heel_ids_on_pad = {
        obj.id
        for obj in linked
        if (obj.subtype or "").lower().strip() == "well_bottomhole_gs_heel"
    }
    for obj in objects:
        if obj.id in linked_ids:
            continue
        if (obj.subtype or "").lower().strip() != "well_bottomhole_gs_toe":
            continue
        heel_id = read_gs_heel_id(obj.properties or {})
        if heel_id is not None and heel_id in heel_ids_on_pad:
            linked.append(obj)
            linked_ids.add(obj.id)

    missing_heel_ids: set[UUID] = set()
    for obj in linked:
        if (obj.subtype or "").lower().strip() != "well_bottomhole_gs_toe":
            continue
        heel_id = read_gs_heel_id(obj.properties or {})
        if heel_id is not None and heel_id not in linked_ids:
            missing_heel_ids.add(heel_id)
    for obj in objects:
        if obj.id in linked_ids:
            continue
        if (obj.subtype or "").lower().strip() != "well_bottomhole_gs_heel":
            continue
        if obj.id in missing_heel_ids:
            linked.append(obj)
            linked_ids.add(obj.id)

    return linked


async def fetch_bottomholes_for_pad(
    db: AsyncSession,
    project_id: UUID,
    pad_id: UUID,
) -> list[InfrastructureObject]:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype.in_(tuple(BOTTOMHOLE_SUBTYPES)),
        )
    )
    objects = list(result.scalars().all())
    return bottomholes_for_pad_from_objects(objects, pad_id)


def _read_stored_well_index(props: dict[str, Any]) -> int | None:
    raw = props.get(WELL_INDEX)
    if raw is None or raw == "":
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if value < 0 or value > 63:
        return None
    return value


def _assign_bottomhole_well_indices(
    bottomholes: list[InfrastructureObject],
) -> dict[UUID, int]:
    """Map bottomhole id → well_index; unassigned NNB/GS heel get sequential free slots."""
    index_map: dict[UUID, int] = {}
    occupied: set[int] = set()
    deferred: list[InfrastructureObject] = []

    for obj in bottomholes:
        props = obj.properties or {}
        stored = _read_stored_well_index(props)
        if stored is not None:
            index_map[obj.id] = stored
            occupied.add(stored)
            continue
        st = (obj.subtype or "").lower().strip()
        if st == "well_bottomhole_gs_toe":
            continue
        if st == "well_bottomhole_gs":
            deferred.append(obj)
            continue
        deferred.append(obj)

    deferred.sort(key=lambda o: (o.name or "", str(o.id)))
    next_idx = 0
    for obj in deferred:
        while next_idx in occupied:
            next_idx += 1
        index_map[obj.id] = next_idx
        occupied.add(next_idx)
        next_idx += 1

    for obj in bottomholes:
        if (obj.subtype or "").lower().strip() != "well_bottomhole_gs_toe":
            continue
        props = obj.properties or {}
        stored = _read_stored_well_index(props)
        if stored is not None:
            index_map[obj.id] = stored
            continue
        heel_id = read_gs_heel_id(props)
        if heel_id is None:
            continue
        for heel in bottomholes:
            if heel.id == heel_id and heel.id in index_map:
                index_map[obj.id] = index_map[heel.id]
                break

    return index_map


def _index_by_well(
    bottomholes: list[InfrastructureObject],
    *,
    index_map: dict[UUID, int],
) -> dict[int, list[InfrastructureObject]]:
    by_well: dict[int, list[InfrastructureObject]] = {}
    for obj in bottomholes:
        idx = index_map.get(obj.id)
        if idx is None:
            continue
        by_well.setdefault(idx, []).append(obj)
    return by_well


def _build_nnb_target(
    pad: InfrastructureObject,
    obj: InfrastructureObject,
) -> dict[str, Any]:
    east_m, north_m, lon, lat, tvd_m = bottomhole_plan_local(pad, obj)
    inc, azi = target_inc_azi(obj, pad)
    return {
        "source": "bottomhole_object",
        "profile": "nnb",
        "plan": {"east_m": east_m, "north_m": north_m},
        "lon": lon,
        "lat": lat,
        "tvd_m": tvd_m,
        "inc": inc,
        "azi": azi,
        "bottomhole_object_id": str(obj.id),
    }


def _build_gs_target_from_line(
    pad: InfrastructureObject,
    obj: InfrastructureObject,
) -> dict[str, Any]:
    endpoints = read_gs_line_endpoints(obj)
    if endpoints is None:
        raise ValueError("ГС: не заданы координаты heel/toe")
    heel_lon, heel_lat, toe_lon, toe_lat = endpoints
    anchor_lon = float(pad.longitude)
    anchor_lat = float(pad.latitude)
    heel_e, heel_n = lonlat_to_local(anchor_lon, anchor_lat, heel_lon, heel_lat)
    toe_e, toe_n = lonlat_to_local(anchor_lon, anchor_lat, toe_lon, toe_lat)
    props = obj.properties or {}
    heel_tvd_m = read_gs_heel_tvd_m(pad, props)
    toe_tvd_m = read_gs_toe_tvd_m(pad, props)
    azi = azimuth_deg(heel_n, heel_e, toe_n, toe_e)
    return {
        "source": "bottomhole_object",
        "profile": "gs",
        "plan": {"east_m": toe_e, "north_m": toe_n},
        "heel_plan": {"east_m": heel_e, "north_m": heel_n},
        "lon": toe_lon,
        "lat": toe_lat,
        "heel_lon": heel_lon,
        "heel_lat": heel_lat,
        "tvd_m": toe_tvd_m,
        "heel_tvd_m": heel_tvd_m,
        "toe_tvd_m": toe_tvd_m,
        "inc": 90.0,
        "azi": azi,
        "gs_entry_mode": read_gs_entry_mode(props),
        "bottomhole_object_id": str(obj.id),
    }


def _build_gs_target(
    pad: InfrastructureObject,
    heel: InfrastructureObject,
    toe: InfrastructureObject,
) -> dict[str, Any]:
    heel_e, heel_n, heel_lon, heel_lat, heel_tvd_m = bottomhole_plan_local(pad, heel)
    toe_e, toe_n, toe_lon, toe_lat, toe_tvd_m = bottomhole_plan_local(pad, toe)
    azi = azimuth_deg(heel_n, heel_e, toe_n, toe_e)
    return {
        "source": "bottomhole_object",
        "profile": "gs",
        "plan": {"east_m": toe_e, "north_m": toe_n},
        "heel_plan": {"east_m": heel_e, "north_m": heel_n},
        "lon": toe_lon,
        "lat": toe_lat,
        "heel_lon": heel_lon,
        "heel_lat": heel_lat,
        "tvd_m": toe_tvd_m,
        "heel_tvd_m": heel_tvd_m,
        "toe_tvd_m": toe_tvd_m,
        "inc": 90.0,
        "azi": azi,
        "gs_entry_mode": read_gs_entry_mode(heel.properties or {}),
        "gs_heel_object_id": str(heel.id),
        "gs_toe_object_id": str(toe.id),
        "bottomhole_object_id": str(toe.id),
    }


def sync_bottomholes_to_trajectories(
    pad: InfrastructureObject,
    bottomholes: list[InfrastructureObject],
) -> tuple[list[dict[str, Any]], list[str]]:
    trajectories = read_trajectories_json(pad.properties)
    if not trajectories:
        return [], ["Нет заготовок траекторий; сначала выполните «Из схемы куста»"]

    warnings: list[str] = []
    index_map = _assign_bottomhole_well_indices(bottomholes)
    by_well = _index_by_well(bottomholes, index_map=index_map)
    nnb_by_well: dict[int, InfrastructureObject] = {}
    gs_line_by_well: dict[int, InfrastructureObject] = {}
    heels_by_well: dict[int, InfrastructureObject] = {}
    toes_by_heel: dict[UUID, InfrastructureObject] = {}

    for obj in bottomholes:
        st = obj.subtype
        idx = index_map.get(obj.id)
        if idx is None:
            continue
        if st == "well_bottomhole_nnb":
            if idx in nnb_by_well:
                warnings.append(f"Скв.{idx + 1}: дубликат забоя ННБ")
            nnb_by_well[idx] = obj
        elif st == "well_bottomhole_gs":
            if idx in gs_line_by_well:
                warnings.append(f"Скв.{idx + 1}: дубликат забоя ГС")
            gs_line_by_well[idx] = obj
        elif st == "well_bottomhole_gs_heel":
            if idx in heels_by_well:
                warnings.append(f"Скв.{idx + 1}: дубликат пятки (heel) ГС")
            heels_by_well[idx] = obj
        elif st == "well_bottomhole_gs_toe":
            props = obj.properties or {}
            heel_id = read_gs_heel_id(props)
            if heel_id is None:
                warnings.append(f"Toe ГС без привязки к пятке (heel), объект {obj.id}")
                continue
            if heel_id in toes_by_heel:
                warnings.append("Дубликат toe для одной пятки (heel) ГС")
            toes_by_heel[heel_id] = obj

    for idx, objs in by_well.items():
        if len(objs) > 2:
            warnings.append(f"Скв.{idx + 1}: слишком много объектов-забоев")

    updated = [dict(w) if isinstance(w, dict) else w for w in trajectories]
    assigned: set[int] = set()
    for idx in range(len(updated)):
        if idx in nnb_by_well:
            well = dict(updated[idx])
            well["target"] = _build_nnb_target(pad, nnb_by_well[idx])
            updated[idx] = well
            assigned.add(idx)
            continue
        gs_line = gs_line_by_well.get(idx)
        if gs_line is not None:
            try:
                well = dict(updated[idx])
                well["target"] = _build_gs_target_from_line(pad, gs_line)
                updated[idx] = well
                assigned.add(idx)
            except ValueError as exc:
                warnings.append(f"Скв.{idx + 1}: {exc}")
            continue
        heel = heels_by_well.get(idx)
        if heel is None:
            continue
        toe = toes_by_heel.get(heel.id)
        if toe is None:
            warnings.append(f"Скв.{idx + 1}: пятка (heel) ГС без парного toe")
            continue
        well = dict(updated[idx])
        well["target"] = _build_gs_target(pad, heel, toe)
        updated[idx] = well
        assigned.add(idx)

    for idx in range(len(updated)):
        if idx in assigned:
            continue
        well = updated[idx]
        if isinstance(well, dict) and _well_has_bottomhole_design(well):
            updated[idx] = _reset_well_to_stub(well, pad)

    wells_count = _wells_local_count(pad)
    if wells_count > 0 and len(updated) > wells_count:
        updated = updated[:wells_count]

    return updated, warnings
