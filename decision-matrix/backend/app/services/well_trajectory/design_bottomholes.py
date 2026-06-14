"""Design trajectories from bottomhole targets (NNB connector / GS horizontal)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import read_nds_deg
from app.services.well_trajectory.bottomhole_properties import DEFAULT_NNB_INC, DEFAULT_TVD_M
from app.services.well_trajectory.planner_bridge import (
    design_horizontal_at_offset,
    gs_entry_search_offsets,
    planner_schemas,
)
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter


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


def design_well_from_target(
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
