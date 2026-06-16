"""Orchestration for well trajectory BFF."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import read_nds_deg, read_wells_local
from app.services.well_trajectory.geojson import collect_trajectory_warnings
from app.services.well_trajectory.coord_transform import local_to_lonlat, lonlat_to_local
from app.services.well_trajectory.schemas import (
    WellTrajectoryComputeResponse,
    WellTrajectoryDesignAllRequest,
    WellTrajectoryDesignAllResponse,
    WellTrajectoryDesignFromBottomholesRequest,
    WellTrajectoryDesignFromBottomholesResponse,
    WellTrajectoryDesignRequest,
    WellTrajectoryDesignResponse,
    WellTrajectoryLastResponse,
    WellTrajectorySettingsOut,
    WellTrajectorySyncBottomholesResponse,
    WellTrajectoryTargetsPatch,
    WellTrajectoryTargetsResponse,
    BottomholeTargetIn,
    ConnectorEndIn,
)
from app.services.well_trajectory.bottomhole_sync import (
    _reset_well_to_stub,
    _well_has_bottomhole_design,
    fetch_bottomholes_for_pad,
    sync_bottomholes_to_trajectories,
)
from app.services.well_trajectory.bottomhole_properties import DEFAULT_NNB_INC, DEFAULT_TVD_M, GS_HEEL_LABEL
from app.services.well_trajectory.pad_wells_bootstrap import (
    ensure_pad_wells_local_on_object,
    trajectory_stub_well_count,
)
from app.services.well_trajectory.trajectory_store import (
    read_computed_at,
    read_clearance_computed_at,
    read_clearance_pairs_json,
    read_trajectories_json,
    store_trajectories_json,
)
from app.services.well_trajectory.design_bottomholes import design_well_from_target
from app.services.well_trajectory.compute_ops import (
    apply_compute_to_properties,
    compute_all_trajectories,
)
from app.services.well_trajectory.design_connector import (
    apply_design_to_properties,
    design_well_trajectory,
)
from app.services.well_trajectory.layout_ops import (
    apply_generate_to_properties,
    generate_trajectories_from_layout,
)
from app.services.well_trajectory.pad_access import assert_pad_object
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES


def default_well_trajectory_settings() -> WellTrajectorySettingsOut:
    return WellTrajectorySettingsOut()


def build_last_response(obj: InfrastructureObject) -> WellTrajectoryLastResponse:
    props = obj.properties or {}
    return WellTrajectoryLastResponse(
        trajectories=read_trajectories_json(props),
        wells_local=read_wells_local(props),
        computed_at=read_computed_at(props),
        clearance_pairs=read_clearance_pairs_json(props),
        clearance_computed_at=read_clearance_computed_at(props),
        settings=well_trajectory_settings_for_pad(obj),
        warnings=collect_trajectory_warnings(obj),
    )


def _normalize_target_for_pad(
    obj: InfrastructureObject,
    target: BottomholeTargetIn,
) -> dict[str, Any]:
    anchor_lon = float(obj.longitude)
    anchor_lat = float(obj.latitude)
    east_m: float
    north_m: float
    lon: float | None = target.lon
    lat: float | None = target.lat
    if target.plan is not None:
        east_m = target.plan.east_m
        north_m = target.plan.north_m
        lon, lat = local_to_lonlat(anchor_lon, anchor_lat, east_m, north_m)
    elif lon is not None and lat is not None:
        east_m, north_m = lonlat_to_local(anchor_lon, anchor_lat, lon, lat)
    else:
        raise HTTPException(status_code=400, detail="Цель забоя: укажите координаты на карте или в плане")

    azi = target.azi if target.azi is not None else read_nds_deg(obj.properties or {})
    return {
        "source": target.source,
        "plan": {"east_m": east_m, "north_m": north_m},
        "lon": lon,
        "lat": lat,
        "tvd_m": target.tvd_m,
        "inc": target.inc,
        "azi": azi,
    }


def save_targets(
    obj: InfrastructureObject,
    body: WellTrajectoryTargetsPatch,
) -> WellTrajectoryTargetsResponse:
    assert_pad_object(obj)
    trajectories = read_trajectories_json(obj.properties)
    if not trajectories:
        raise HTTPException(
            status_code=400,
            detail="Нет заготовок траекторий; сначала выполните «Из схемы куста»",
        )

    for entry in body.targets:
        if entry.well_index >= len(trajectories):
            raise HTTPException(
                status_code=400,
                detail=f"Индекс скважины {entry.well_index} вне диапазона",
            )
        well = dict(trajectories[entry.well_index])
        well["target"] = _normalize_target_for_pad(obj, entry.target)
        trajectories[entry.well_index] = well

    return WellTrajectoryTargetsResponse(trajectories=trajectories)


def design_all_from_targets(
    obj: InfrastructureObject,
    body: WellTrajectoryDesignAllRequest,
) -> WellTrajectoryDesignAllResponse:
    assert_pad_object(obj)
    trajectories = read_trajectories_json(obj.properties)
    if not trajectories:
        raise HTTPException(status_code=400, detail="Нет сохранённых траекторий")

    indices = body.well_indices if body.well_indices is not None else list(range(len(trajectories)))
    designed: list[int] = []
    skipped: list[int] = []

    for idx in indices:
        if idx < 0 or idx >= len(trajectories):
            skipped.append(idx)
            continue
        well = trajectories[idx]
        target = well.get("target") if isinstance(well, dict) else None
        if not isinstance(target, dict):
            skipped.append(idx)
            continue
        plan = target.get("plan") if isinstance(target.get("plan"), dict) else {}
        try:
            northing = float(plan.get("north_m", target.get("north_m")))
            easting = float(plan.get("east_m", target.get("east_m")))
            tvd = float(target.get("tvd_m"))
            inc = float(target.get("inc", DEFAULT_NNB_INC))
            azi = float(target.get("azi", read_nds_deg(obj.properties or {})))
        except (TypeError, ValueError):
            skipped.append(idx)
            continue

        result = design_well_trajectory(
            obj,
            WellTrajectoryDesignRequest(
                well_index=idx,
                end=ConnectorEndIn(
                    northing=northing,
                    easting=easting,
                    tvd=tvd,
                    inc=inc,
                    azi=azi,
                ),
                step_m=body.step_m,
            ),
        )
        trajectories[idx] = result.trajectory
        trajectories[idx]["target"] = target
        designed.append(idx)

    return WellTrajectoryDesignAllResponse(
        designed=designed,
        skipped=skipped,
        trajectories=trajectories,
    )


async def sync_bottomholes_for_pad(
    db: Any,
    obj: InfrastructureObject,
    *,
    project_id: Any,
) -> WellTrajectorySyncBottomholesResponse:
    assert_pad_object(obj)
    bottomholes = await fetch_bottomholes_for_pad(db, project_id, obj.id)
    layout_warnings = _ensure_pad_ready_for_bottomholes(obj, bottomholes)
    trajectories, warnings = sync_bottomholes_to_trajectories(obj, bottomholes)
    if not trajectories and warnings:
        raise HTTPException(status_code=400, detail=warnings[0])
    return WellTrajectorySyncBottomholesResponse(
        trajectories=trajectories,
        warnings=layout_warnings + warnings,
    )


async def resync_pad_trajectories_from_bottomholes(
    db: Any,
    project_id: Any,
    pad_id: Any,
) -> bool:
    """Refresh pad trajectories after bottomhole create/delete (map sync)."""
    pad = await db.get(InfrastructureObject, pad_id)
    if pad is None or (pad.subtype or "").lower() not in PAD_CLUSTER_SUBTYPES:
        return False
    bottomholes = await fetch_bottomholes_for_pad(db, project_id, pad_id)
    trajectories, _ = sync_bottomholes_to_trajectories(pad, bottomholes)
    if not trajectories:
        return False
    pad.properties = store_trajectories_json(pad.properties, trajectories)
    return True


async def resync_pads_after_bottomhole_deletes(
    db: Any,
    project_id: Any,
    pad_ids: set[Any],
) -> int:
    updated = 0
    for pad_id in pad_ids:
        if await resync_pad_trajectories_from_bottomholes(db, project_id, pad_id):
            updated += 1
    return updated


def _ensure_pad_ready_for_bottomholes(
    obj: InfrastructureObject,
    bottomholes: list[InfrastructureObject],
) -> list[str]:
    """Expand wells layout and trajectory stubs when linked bottomholes need slots."""
    warnings: list[str] = []
    stub_count = trajectory_stub_well_count(obj, bottomholes)
    if bottomholes:
        wells, expanded = ensure_pad_wells_local_on_object(obj, exact_well_count=stub_count)
    else:
        wells, expanded = ensure_pad_wells_local_on_object(obj, min_well_count=stub_count)
    if expanded:
        warnings.append(f"Раскладка устья скважин обновлена до {len(wells)}")

    trajectories = read_trajectories_json(obj.properties)
    if len(trajectories) != len(wells):
        gen = generate_trajectories_from_layout(obj, bottomholes=bottomholes)
        obj.properties = store_trajectories_json(obj.properties, gen.trajectories)
        if len(trajectories) < len(wells):
            warnings.append(f"Заготовки траекторий обновлены: {len(gen.trajectories)} скважин")
    return warnings


async def design_from_bottomholes(
    db: Any,
    obj: InfrastructureObject,
    body: WellTrajectoryDesignFromBottomholesRequest,
    *,
    project_id: Any,
) -> WellTrajectoryDesignFromBottomholesResponse:
    assert_pad_object(obj)
    bottomholes = await fetch_bottomholes_for_pad(db, project_id, obj.id)

    sync_result = await sync_bottomholes_for_pad(db, obj, project_id=project_id)
    trajectories = sync_result.trajectories
    warnings = list(sync_result.warnings)

    if not trajectories:
        raise HTTPException(status_code=400, detail="Нет сохранённых траекторий")

    for idx in range(len(trajectories)):
        well = trajectories[idx]
        if not isinstance(well, dict):
            continue
        if isinstance(well.get("target"), dict):
            continue
        if _well_has_bottomhole_design(well):
            trajectories[idx] = _reset_well_to_stub(well, obj)

    indices = body.well_indices if body.well_indices is not None else list(range(len(trajectories)))
    designed: list[int] = []
    skipped: list[int] = []

    for idx in indices:
        if idx < 0 or idx >= len(trajectories):
            skipped.append(idx)
            continue
        well = trajectories[idx]
        if not isinstance(well, dict):
            skipped.append(idx)
            continue
        target = well.get("target")
        if not isinstance(target, dict):
            skipped.append(idx)
            continue
        try:
            peer_wells = [
                trajectories[j]
                for j in range(len(trajectories))
                if j != idx and isinstance(trajectories[j], dict)
            ]
            well_warnings: list[str] = []
            trajectories[idx] = await asyncio.to_thread(
                design_well_from_target,
                obj,
                idx,
                well,
                target,
                step_m=body.step_m,
                peer_wells=peer_wells,
                extra_warnings=well_warnings,
            )
            warnings.extend(well_warnings)
            designed.append(idx)
            design = trajectories[idx].get("design") if isinstance(trajectories[idx], dict) else None
            if isinstance(design, dict):
                offset = design.get("gs_entry_offset_m")
                mode = design.get("gs_entry_mode")
                if mode == "any" and offset is not None:
                    try:
                        off_m = float(offset)
                    except (TypeError, ValueError):
                        off_m = 0.0
                    if abs(off_m) > 50:
                        warnings.append(
                            f"Скв.{idx + 1}: точка входа смещена на {off_m:.0f} м от {GS_HEEL_LABEL}"
                        )
        except HTTPException:
            skipped.append(idx)
        except Exception:
            skipped.append(idx)
            warnings.append(f"Скв.{idx + 1}: не удалось спроектировать траекторию")

    return WellTrajectoryDesignFromBottomholesResponse(
        designed=designed,
        skipped=skipped,
        trajectories=trajectories,
        warnings=warnings,
    )
