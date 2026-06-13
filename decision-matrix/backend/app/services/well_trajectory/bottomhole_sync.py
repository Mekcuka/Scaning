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
    read_gs_heel_id,
    read_linked_pad_id,
    target_inc_azi,
)
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


async def fetch_bottomholes_for_pad(
    db: AsyncSession,
    project_id: UUID,
    pad_id: UUID,
) -> list[InfrastructureObject]:
    pad_key = str(pad_id)
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype.in_(tuple(BOTTOMHOLE_SUBTYPES)),
        )
    )
    objects = list(result.scalars().all())
    linked: list[InfrastructureObject] = []
    for obj in objects:
        props = obj.properties or {}
        linked_pad = read_linked_pad_id(props)
        if linked_pad == pad_id:
            linked.append(obj)
            continue
        if linked_pad is None and props.get("well_bottomhole_linked_pad_id") == pad_key:
            linked.append(obj)
    return linked


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


def _build_gs_target(
    pad: InfrastructureObject,
    heel: InfrastructureObject,
    toe: InfrastructureObject,
) -> dict[str, Any]:
    heel_e, heel_n, heel_lon, heel_lat, tvd_m = bottomhole_plan_local(pad, heel)
    toe_e, toe_n, toe_lon, toe_lat, _ = bottomhole_plan_local(pad, toe)
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
        "tvd_m": tvd_m,
        "inc": 90.0,
        "azi": azi,
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
        return [], ["No trajectories; run generate-from-layout first"]

    warnings: list[str] = []
    index_map = _assign_bottomhole_well_indices(bottomholes)
    by_well = _index_by_well(bottomholes, index_map=index_map)
    nnb_by_well: dict[int, InfrastructureObject] = {}
    heels_by_well: dict[int, InfrastructureObject] = {}
    toes_by_heel: dict[UUID, InfrastructureObject] = {}

    for obj in bottomholes:
        st = obj.subtype
        idx = index_map.get(obj.id)
        if idx is None:
            continue
        if st == "well_bottomhole_nnb":
            if idx in nnb_by_well:
                warnings.append(f"Duplicate NNB bottomhole for well_index {idx}")
            nnb_by_well[idx] = obj
        elif st == "well_bottomhole_gs_heel":
            if idx in heels_by_well:
                warnings.append(f"Duplicate GS heel for well_index {idx}")
            heels_by_well[idx] = obj
        elif st == "well_bottomhole_gs_toe":
            props = obj.properties or {}
            heel_id = read_gs_heel_id(props)
            if heel_id is None:
                warnings.append(f"GS toe {obj.id} has no gs_heel_id")
                continue
            if heel_id in toes_by_heel:
                warnings.append(f"Duplicate toe for heel {heel_id}")
            toes_by_heel[heel_id] = obj

    for idx, objs in by_well.items():
        if len(objs) > 2:
            warnings.append(f"well_index {idx}: more than expected bottomhole objects")

    updated = [dict(w) if isinstance(w, dict) else w for w in trajectories]
    assigned: set[int] = set()
    for idx in range(len(updated)):
        if idx in nnb_by_well:
            well = dict(updated[idx])
            well["target"] = _build_nnb_target(pad, nnb_by_well[idx])
            updated[idx] = well
            assigned.add(idx)
            continue
        heel = heels_by_well.get(idx)
        if heel is None:
            continue
        toe = toes_by_heel.get(heel.id)
        if toe is None:
            warnings.append(f"well_index {idx}: GS heel without paired toe")
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
