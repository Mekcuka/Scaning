"""Orchestration for well trajectory BFF."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import _read_float, read_nds_deg, read_wells_local
from app.services.pad_earthwork.properties import (
    DEFAULT_PAD_HEIGHT_M,
    DEFAULT_PAD_REFERENCE_ELEVATION_M,
    PAD_HEIGHT_M,
    PAD_REFERENCE_ELEVATION_M,
)
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
    WellTrajectoryGenerateResponse,
    WellTrajectoryLastResponse,
    WellTrajectorySettingsOut,
    WellTrajectorySyncBottomholesResponse,
    WellTrajectoryTargetsPatch,
    WellTrajectoryTargetsResponse,
    BottomholeTargetIn,
    ConnectorEndIn,
)
from app.services.well_trajectory.bottomhole_sync import (
    fetch_bottomholes_for_pad,
    sync_bottomholes_to_trajectories,
)
from app.services.well_trajectory.bottomhole_properties import DEFAULT_NNB_INC, DEFAULT_TVD_M
from app.services.well_trajectory.pad_wells_bootstrap import (
    ensure_pad_wells_local_on_object,
    required_well_count_from_bottomholes,
)
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter
from app.services.well_trajectory.trajectory_store import (
    read_computed_at,
    read_clearance_computed_at,
    read_clearance_pairs_json,
    read_trajectories_json,
    store_computed_at,
    store_trajectories_json,
)
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.planner_bridge import (
    design_horizontal_at_offset,
    gs_entry_search_offsets,
    planner_schemas,
)
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES


def assert_pad_object(obj: InfrastructureObject) -> None:
    if obj.subtype not in PAD_CLUSTER_SUBTYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Траектории доступны только для кустов: {sorted(PAD_CLUSTER_SUBTYPES)}",
        )


def default_well_trajectory_settings() -> WellTrajectorySettingsOut:
    return WellTrajectorySettingsOut()


def _default_kb_m(props: dict[str, Any]) -> float:
    ref = _read_float(props, PAD_REFERENCE_ELEVATION_M)
    if ref is None:
        ref = DEFAULT_PAD_REFERENCE_ELEVATION_M
    height = _read_float(props, PAD_HEIGHT_M)
    if height is None:
        height = DEFAULT_PAD_HEIGHT_M
    return ref + height


def _well_to_dict(well: Any) -> dict[str, Any]:
    return well.model_dump(mode="json")


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
    """Expand wells layout and trajectory stubs when linked bottomholes need more slots."""
    warnings: list[str] = []
    min_wells = required_well_count_from_bottomholes(obj, bottomholes)
    wells, expanded = ensure_pad_wells_local_on_object(obj, min_well_count=min_wells)
    if expanded:
        warnings.append(f"Раскладка устья скважин расширена до {len(wells)}")

    trajectories = read_trajectories_json(obj.properties)
    if len(trajectories) != len(wells):
        gen = generate_trajectories_from_layout(obj)
        obj.properties = store_trajectories_json(obj.properties, gen.trajectories)
        if len(trajectories) < len(wells):
            warnings.append(f"Заготовки траекторий обновлены: {len(gen.trajectories)} скважин")
    return warnings


def _station_scalar(station: Any, key: str) -> float:
    if isinstance(station, dict):
        return float(station[key])
    return float(getattr(station, key))


def _well_dict_to_clearance_survey(well: dict[str, Any]) -> Any | None:
    survey = well.get("survey") or {}
    stations = survey.get("stations") or []
    if not isinstance(stations, list) or len(stations) < 2:
        return None
    schemas = planner_schemas()
    return schemas.ClearanceSurveyIn(
        name=str(well.get("name") or ""),
        md=[_station_scalar(s, "md") for s in stations],
        inc=[_station_scalar(s, "inc") for s in stations],
        azi=[_station_scalar(s, "azi") for s in stations],
        n=[_station_scalar(s, "n") for s in stations],
        e=[_station_scalar(s, "e") for s in stations],
        tvd=[_station_scalar(s, "tvd") for s in stations],
        error_model=str(well.get("error_model") or "ISCWSA MWD Rev5.11"),
        azi_reference=str(well.get("azi_reference") or "grid"),
    )


def _candidate_min_sf_vs_peers(
    candidate_stations: list[Any],
    peer_surveys: list[Any],
    *,
    sf_threshold: float,
    adapter: Any,
) -> float | None:
    if not peer_surveys or len(candidate_stations) < 2:
        return None
    schemas = planner_schemas()
    candidate = schemas.ClearanceSurveyIn(
        name="candidate",
        md=[_station_scalar(s, "md") for s in candidate_stations],
        inc=[_station_scalar(s, "inc") for s in candidate_stations],
        azi=[_station_scalar(s, "azi") for s in candidate_stations],
        n=[_station_scalar(s, "n") for s in candidate_stations],
        e=[_station_scalar(s, "e") for s in candidate_stations],
        tvd=[_station_scalar(s, "tvd") for s in candidate_stations],
        error_model=peer_surveys[0].error_model,
        azi_reference=peer_surveys[0].azi_reference,
    )
    pairs = [[0, i + 1] for i in range(len(peer_surveys))]
    try:
        result = adapter.clearance_pairs(
            schemas.ClearancePairsRequest(
                surveys=[candidate, *peer_surveys],
                pairs=pairs,
                method="iscwsa",
                threshold=sf_threshold,
            )
        )
    except Exception:
        return None
    if not result.pairs:
        return None
    return min(p.min_sf for p in result.pairs)


def _design_horizontal_any_with_clearance(
    request: Any,
    adapter: Any,
    *,
    peer_wells: list[dict[str, Any]],
    sf_threshold: float,
) -> tuple[Any, bool]:
    """Pick min-MD GS entry among offsets that satisfy SF vs peer trajectories."""
    peer_surveys = [
        s for w in peer_wells if (s := _well_dict_to_clearance_survey(w)) is not None
    ]
    offsets = gs_entry_search_offsets(request.heel, request.toe, request.entry_search_step_m)

    best_clear: Any | None = None
    best_clear_md = float("inf")
    best_clear_offset = 0.0
    best_any: Any | None = None
    best_any_md = float("inf")
    best_any_offset = 0.0

    for offset_m in offsets:
        try:
            candidate = design_horizontal_at_offset(request, offset_m)
        except (ValueError, TypeError):
            continue
        md = float(candidate.geometry.length_m)
        if md < best_any_md or (abs(md - best_any_md) < 1e-3 and offset_m < best_any_offset):
            best_any_md = md
            best_any_offset = offset_m
            best_any = candidate

        if peer_surveys:
            min_sf = _candidate_min_sf_vs_peers(
                candidate.stations,
                peer_surveys,
                sf_threshold=sf_threshold,
                adapter=adapter,
            )
            if min_sf is not None and min_sf < sf_threshold:
                continue

        if md < best_clear_md or (abs(md - best_clear_md) < 1e-3 and offset_m < best_clear_offset):
            best_clear_md = md
            best_clear_offset = offset_m
            best_clear = candidate

    chosen = best_clear if best_clear is not None else best_any
    fallback = peer_surveys and best_clear is None and best_any is not None
    chosen_offset = best_clear_offset if best_clear is not None else best_any_offset
    if chosen is None:
        chosen = design_horizontal_at_offset(request, 0.0)
        chosen_offset = 0.0

    return (
        chosen.model_copy(
            update={
                "entry_mode": "any",
                "entry_offset_m": chosen_offset,
                "entry_search_evaluated": len(offsets),
            }
        ),
        fallback,
    )


def _design_well_from_target(
    obj: InfrastructureObject,
    idx: int,
    well: dict[str, Any],
    target: dict[str, Any],
    *,
    step_m: float,
    peer_wells: list[dict[str, Any]] | None = None,
    extra_warnings: list[str] | None = None,
) -> dict[str, Any]:
    props = obj.properties or {}
    trajectories = read_trajectories_json(props)
    survey = well.get("survey") or {}
    stations_raw = survey.get("stations") or []
    if not stations_raw:
        raise HTTPException(
            status_code=400,
            detail=f"Скв.{idx + 1}: нет станций инклинометрии",
        )

    start_station = stations_raw[0]
    settings = well_trajectory_settings_for_pad(obj)
    azi_ref = well.get("azi_reference") or settings.default_azi_reference
    schemas = planner_schemas()
    start = schemas.ConnectorPoint(
        northing=float(start_station.get("n", 0)),
        easting=float(start_station.get("e", 0)),
        tvd=float(start_station.get("tvd", 0)),
        inc=float(start_station.get("inc", 0)),
        azi=float(start_station.get("azi", read_nds_deg(props))),
    )

    profile = str(target.get("profile") or "nnb")
    adapter = get_well_trajectory_adapter()

    if profile == "gs":
        heel_plan = target.get("heel_plan") if isinstance(target.get("heel_plan"), dict) else {}
        plan = target.get("plan") if isinstance(target.get("plan"), dict) else {}
        raw_mode = str(target.get("gs_entry_mode") or "any").lower().strip()
        entry_mode = raw_mode if raw_mode in ("any", "heel", "toe") else "any"
        request = schemas.HorizontalDesignRequest(
            start=start,
            heel=schemas.ConnectorPoint(
                northing=float(heel_plan.get("north_m", 0)),
                easting=float(heel_plan.get("east_m", 0)),
                tvd=float(
                    target.get("heel_tvd_m")
                    or target.get("tvd_m", DEFAULT_TVD_M)
                ),
                inc=settings.inc_heel,
                azi=float(target.get("azi", start.azi)),
            ),
            toe=schemas.ConnectorPoint(
                northing=float(plan.get("north_m", 0)),
                easting=float(plan.get("east_m", 0)),
                tvd=float(
                    target.get("toe_tvd_m")
                    or target.get("tvd_m", DEFAULT_TVD_M)
                ),
                inc=90.0,
                azi=float(target.get("azi", start.azi)),
            ),
            step_m=step_m,
            azi_reference=azi_ref,
            inc_heel=settings.inc_heel,
            entry_mode=entry_mode,
            entry_search_step_m=settings.gs_entry_search_step_m,
        )
        if entry_mode == "any" and peer_wells:
            design_result, clearance_fallback = _design_horizontal_any_with_clearance(
                request,
                adapter,
                peer_wells=peer_wells,
                sf_threshold=settings.sf_warning_threshold,
            )
            if clearance_fallback and extra_warnings is not None:
                extra_warnings.append(
                    f"Скв.{idx + 1}: точка входа «Любая» — нет варианта без нарушения SF; "
                    f"выбрана траектория с минимальной длиной"
                )
        else:
            design_result = adapter.design_horizontal(request)
        design_profile = "horizontal"
        design_extra: dict[str, Any] = {
            "gs_entry_mode": design_result.entry_mode,
        }
        if design_result.entry_plan is not None:
            design_extra["gs_entry_plan"] = design_result.entry_plan.model_dump(mode="json")
        if design_result.entry_offset_m is not None:
            design_extra["gs_entry_offset_m"] = design_result.entry_offset_m
    else:
        plan = target.get("plan") if isinstance(target.get("plan"), dict) else {}
        request = schemas.ConnectorDesignRequest(
            start=start,
            end=schemas.ConnectorPoint(
                northing=float(plan.get("north_m", target.get("north_m", 0))),
                easting=float(plan.get("east_m", target.get("east_m", 0))),
                tvd=float(target.get("tvd_m", DEFAULT_TVD_M)),
                inc=float(target.get("inc", DEFAULT_NNB_INC)),
                azi=float(target.get("azi", read_nds_deg(props))),
            ),
            step_m=step_m,
            azi_reference=azi_ref,
        )
        design_result = adapter.design_connector(request)
        design_profile = "connector"
        design_extra = {}

    stations = [s.model_dump(mode="json") for s in design_result.stations]
    updated = dict(well)
    updated["design"] = {
        "profile": design_profile,
        "source": "bottomhole_object",
        **design_extra,
    }
    updated["survey"] = {"source": "calculated", "stations": stations}
    updated["geometry"] = design_result.geometry.model_dump(mode="json")
    updated["target"] = target
    return updated


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
                _design_well_from_target,
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
                            f"Скв.{idx + 1}: точка входа смещена на {off_m:.0f} м от пятки"
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


def generate_trajectories_from_layout(obj: InfrastructureObject) -> WellTrajectoryGenerateResponse:
    assert_pad_object(obj)
    wells_local, _ = ensure_pad_wells_local_on_object(obj)
    if not wells_local:
        raise HTTPException(
            status_code=400,
            detail=(
                "Нет раскладки скважин на кусте. Откройте «Земляные работы» → схема куста "
                "или задайте число скважин (pad_well_count) — раскладка будет создана автоматически."
            ),
        )

    props = obj.properties or {}
    settings = well_trajectory_settings_for_pad(obj)
    schemas = planner_schemas()
    request = schemas.PadGenerateFromLayoutRequest(
        wells_local=[schemas.WellLocal(east_m=w.east_m, north_m=w.north_m) for w in wells_local],
        kb_m=_default_kb_m(props),
        rotation_deg=read_nds_deg(props),
        anchor=schemas.LonLat(lon=float(obj.longitude), lat=float(obj.latitude)),
        azi_reference=settings.default_azi_reference,
        error_model=settings.default_error_model,
        target_tvd_m=settings.stub_tvd_m,
    )

    adapter = get_well_trajectory_adapter()
    result = adapter.generate_from_pad_layout(request)
    trajectories = [_well_to_dict(w) for w in result.wells]
    return WellTrajectoryGenerateResponse(trajectories=trajectories)


def apply_generate_to_properties(obj: InfrastructureObject) -> dict[str, Any]:
    response = generate_trajectories_from_layout(obj)
    props = store_trajectories_json(obj.properties, response.trajectories)
    return props


def design_well_trajectory(
    obj: InfrastructureObject,
    body: WellTrajectoryDesignRequest,
) -> WellTrajectoryDesignResponse:
    assert_pad_object(obj)
    props = obj.properties or {}
    trajectories = read_trajectories_json(props)
    if body.well_index >= len(trajectories):
        raise HTTPException(
            status_code=400,
            detail=f"Индекс скважины {body.well_index} вне диапазона (всего {len(trajectories)} скважин)",
        )

    well = trajectories[body.well_index]
    survey = well.get("survey") or {}
    stations_raw = survey.get("stations") or []
    if not stations_raw:
        raise HTTPException(
            status_code=400,
            detail="У скважины нет станций инклинометрии для расчёта",
        )

    start_station = stations_raw[0]
    settings = well_trajectory_settings_for_pad(obj)
    azi_ref = well.get("azi_reference") or settings.default_azi_reference

    schemas = planner_schemas()
    start_n = float(start_station.get("n", 0))
    start_e = float(start_station.get("e", 0))
    start_tvd = float(start_station.get("tvd", 0))
    start_inc = float(start_station.get("inc", 0))
    start_azi = float(start_station.get("azi", read_nds_deg(props)))

    request = schemas.ConnectorDesignRequest(
        start=schemas.ConnectorPoint(
            northing=start_n,
            easting=start_e,
            tvd=start_tvd,
            inc=start_inc,
            azi=start_azi,
        ),
        end=schemas.ConnectorPoint(
            northing=body.end.northing,
            easting=body.end.easting,
            tvd=body.end.tvd,
            inc=body.end.inc,
            azi=body.end.azi,
        ),
        step_m=body.step_m,
        azi_reference=azi_ref,
    )

    adapter = get_well_trajectory_adapter()
    design_result = adapter.design_connector(request)
    stations = [s.model_dump(mode="json") for s in design_result.stations]

    updated = dict(well)
    updated["design"] = {
        "profile": "connector",
        "start": {"md": 0, "inc": start_inc, "azi": start_azi},
        "end": {
            "northing": body.end.northing,
            "easting": body.end.easting,
            "tvd": body.end.tvd,
            "inc": body.end.inc,
            "azi": body.end.azi,
        },
    }
    updated["survey"] = {"source": "calculated", "stations": stations}
    updated["geometry"] = design_result.geometry.model_dump(mode="json")

    trajectories[body.well_index] = updated
    return WellTrajectoryDesignResponse(well_index=body.well_index, trajectory=updated)


def apply_design_to_properties(
    obj: InfrastructureObject,
    body: WellTrajectoryDesignRequest,
) -> dict[str, Any]:
    response = design_well_trajectory(obj, body)
    trajectories = read_trajectories_json(obj.properties)
    trajectories[body.well_index] = response.trajectory
    return store_trajectories_json(obj.properties, trajectories)


def compute_all_trajectories(obj: InfrastructureObject) -> WellTrajectoryComputeResponse:
    assert_pad_object(obj)
    props = obj.properties or {}
    trajectories = read_trajectories_json(props)
    if not trajectories:
        raise HTTPException(
            status_code=400,
            detail="Нет траекторий; сначала выполните «Из схемы куста»",
        )

    settings = well_trajectory_settings_for_pad(obj)
    schemas = planner_schemas()
    adapter = get_well_trajectory_adapter()

    for index, well in enumerate(trajectories):
        survey = well.get("survey") or {}
        stations_raw = survey.get("stations") or []
        if len(stations_raw) < 2:
            continue
        azi_ref = well.get("azi_reference") or settings.default_azi_reference
        stations_in = [
            schemas.SurveyStation.model_validate(item)
            for item in stations_raw
            if isinstance(item, dict)
        ]
        if len(stations_in) < 2:
            continue
        result = adapter.interpolate_survey(
            schemas.SurveyInterpolateRequest(
                stations=stations_in,
                step_m=settings.step_m,
                azi_reference=azi_ref,
            )
        )
        updated = dict(well)
        updated["survey"] = {
            "source": "calculated",
            "stations": [s.model_dump(mode="json") for s in result.stations],
        }
        updated["geometry"] = result.geometry.model_dump(mode="json")
        trajectories[index] = updated

    return WellTrajectoryComputeResponse(
        trajectories=trajectories,
        computed_at=datetime.now(UTC).isoformat(),
    )


def apply_compute_to_properties(obj: InfrastructureObject) -> dict[str, Any]:
    response = compute_all_trajectories(obj)
    props = store_trajectories_json(obj.properties, response.trajectories)
    props = store_computed_at(props)
    return props
