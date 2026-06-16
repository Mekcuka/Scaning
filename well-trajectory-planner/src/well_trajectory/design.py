"""Well trajectory design via welleng connector."""

from __future__ import annotations

import math
from typing import Literal

import welleng as we

from well_trajectory.pywellgeo_bridge import enrich_survey_geometry
from well_trajectory.schemas import (
    ConnectorDesignRequest,
    ConnectorDesignResponse,
    ConnectorPoint,
    GsEntryPlan,
    HorizontalDesignRequest,
    HorizontalDesignResponse,
    SurveyStation,
)


def _point_to_pos(point: ConnectorPoint) -> list[float]:
    return [point.northing, point.easting, point.tvd]


def _survey_to_stations(survey: we.survey.Survey) -> list[SurveyStation]:
    stations: list[SurveyStation] = []
    for i in range(len(survey.md)):
        azi = float(survey.azi_grid_deg[i]) if survey.header.azi_reference == "grid" else float(survey.azi_true_deg[i])
        stations.append(
            SurveyStation(
                md=float(survey.md[i]),
                inc=float(survey.inc_deg[i]),
                azi=azi,
                tvd=float(survey.tvd[i]),
                n=float(survey.n[i]),
                e=float(survey.e[i]),
            )
        )
    return stations


def design_connector(request: ConnectorDesignRequest) -> ConnectorDesignResponse:
    connector = we.connector.Connector(
        pos1=_point_to_pos(request.start),
        inc1=request.start.inc,
        azi1=request.start.azi,
        pos2=_point_to_pos(request.end),
        inc2=request.end.inc,
        azi2=request.end.azi,
        dls_design=request.dls_design,
    )
    survey = we.survey.from_connections(
        connector,
        step=request.step_m,
        survey_header=we.survey.SurveyHeader(azi_reference=request.azi_reference),
    )
    stations = _survey_to_stations(survey)
    max_dls = float(survey.dls.max()) if len(survey.dls) else 0.0
    geometry = enrich_survey_geometry(stations)
    return ConnectorDesignResponse(stations=stations, max_dls=max_dls, geometry=geometry)


def _concat_stations(first: list[SurveyStation], second: list[SurveyStation]) -> list[SurveyStation]:
    if not first:
        return second
    if not second:
        return first
    merged = list(first)
    base_md = first[-1].md
    start_idx = 1 if (
        abs(second[0].n - first[-1].n) < 1e-3
        and abs(second[0].e - first[-1].e) < 1e-3
        and abs(second[0].tvd - first[-1].tvd) < 1e-3
    ) else 0
    seg2_base_md = second[start_idx - 1].md if start_idx else 0.0
    for station in second[start_idx:]:
        merged.append(
            SurveyStation(
                md=base_md + (station.md - seg2_base_md),
                inc=station.inc,
                azi=station.azi,
                tvd=station.tvd,
                n=station.n,
                e=station.e,
            )
        )
    return merged


def _horizontal_hold_azi(heel: ConnectorPoint, toe: ConnectorPoint) -> float:
    dn = toe.northing - heel.northing
    de = toe.easting - heel.easting
    return math.degrees(math.atan2(de, dn)) % 360.0


def _reverse_hold_azi(azi: float) -> float:
    return (azi + 180.0) % 360.0


def _landing_at_heel(heel: ConnectorPoint, toe: ConnectorPoint, entry: ConnectorPoint) -> bool:
    if _heel_toe_length(heel, toe) < 1e-6:
        return True
    return _heel_toe_length(heel, entry) < 1e-3


def _landing_at_toe(heel: ConnectorPoint, toe: ConnectorPoint, entry: ConnectorPoint) -> bool:
    length = _heel_toe_length(heel, toe)
    if length < 1e-6:
        return True
    offset = _heel_toe_length(heel, entry)
    return offset >= length - 1e-3


def _entry_plan_from_point(point: ConnectorPoint) -> GsEntryPlan:
    return GsEntryPlan(northing=point.northing, easting=point.easting)


def _heel_toe_length(heel: ConnectorPoint, toe: ConnectorPoint) -> float:
    dn = toe.northing - heel.northing
    de = toe.easting - heel.easting
    return math.hypot(dn, de)


def _point_on_heel_toe(heel: ConnectorPoint, toe: ConnectorPoint, offset_m: float) -> ConnectorPoint:
    length = _heel_toe_length(heel, toe)
    if length < 1e-6:
        return heel.model_copy(deep=True)
    t = max(0.0, min(1.0, offset_m / length))
    dn = toe.northing - heel.northing
    de = toe.easting - heel.easting
    return ConnectorPoint(
        northing=heel.northing + t * dn,
        easting=heel.easting + t * de,
        tvd=heel.tvd + t * (toe.tvd - heel.tvd),
        inc=heel.inc + t * (toe.inc - heel.inc),
        azi=heel.azi,
    )


def _hold_segment_end_inc(
    entry: ConnectorPoint,
    toe: ConnectorPoint,
    default_inc: float,
) -> float:
    """Inclination at hold end when heel/toe TVD differ (sloping horizontal section)."""
    dn = toe.northing - entry.northing
    de = toe.easting - entry.easting
    horiz = math.hypot(dn, de)
    dtvd = toe.tvd - entry.tvd
    if horiz < 1e-6 or abs(dtvd) < 1e-3:
        return toe.inc if toe.inc > 1e-3 else default_inc
    # Oilfield inc: 0° vertical, 90° horizontal; deeper toe => inc slightly above 90°.
    inc_rad = math.atan2(horiz, abs(dtvd))
    inc_deg = math.degrees(inc_rad)
    if dtvd > 0:
        return inc_deg
    return 180.0 - inc_deg


def gs_entry_search_offsets(
    heel: ConnectorPoint,
    toe: ConnectorPoint,
    step_m: float,
) -> list[float]:
    length = _heel_toe_length(heel, toe)
    step = max(step_m, 1.0)
    offsets: list[float] = [0.0]
    if length > 1e-6:
        s = step
        while s < length - 1e-3:
            offsets.append(s)
            s += step
        if abs(offsets[-1] - length) > 1e-3:
            offsets.append(length)
    return offsets


def gs_entry_endpoint_offsets(heel: ConnectorPoint, toe: ConnectorPoint) -> list[float]:
    """T1 and T3 only — avoids interior entry with a 180° turn at an endpoint."""
    length = _heel_toe_length(heel, toe)
    if length < 1e-6:
        return [0.0]
    return [0.0, length]


def _snap_entry_to_endpoint(
    heel: ConnectorPoint,
    toe: ConnectorPoint,
    entry: ConnectorPoint,
) -> tuple[ConnectorPoint, bool, bool]:
    at_heel = _landing_at_heel(heel, toe, entry)
    at_toe = _landing_at_toe(heel, toe, entry)
    if at_heel or at_toe:
        return entry, at_heel, at_toe
    length = _heel_toe_length(heel, toe)
    offset = _heel_toe_length(heel, entry)
    if offset <= length / 2.0:
        return heel.model_copy(deep=True), True, False
    return toe.model_copy(deep=True), False, True


def _design_horizontal_at_entry(
    request: HorizontalDesignRequest,
    entry: ConnectorPoint,
) -> HorizontalDesignResponse:
    entry, at_heel, at_toe = _snap_entry_to_endpoint(request.heel, request.toe, entry)
    hold_forward_azi = _horizontal_hold_azi(request.heel, request.toe)
    hold_reverse_azi = _reverse_hold_azi(hold_forward_azi)

    if at_toe:
        first_hold_target = request.heel
        first_hold_azi = hold_reverse_azi
    else:
        first_hold_target = request.toe
        first_hold_azi = hold_forward_azi

    first_hold_inc = _hold_segment_end_inc(entry, first_hold_target, request.inc_heel)
    entry_end = ConnectorPoint(
        northing=entry.northing,
        easting=entry.easting,
        tvd=entry.tvd,
        inc=first_hold_inc,
        azi=first_hold_azi,
    )
    seg1 = design_connector(
        ConnectorDesignRequest(
            start=request.start,
            end=entry_end,
            step_m=request.step_m,
            azi_reference=request.azi_reference,
            dls_design=request.dls_design,
        )
    )

    hold_end = ConnectorPoint(
        northing=first_hold_target.northing,
        easting=first_hold_target.easting,
        tvd=first_hold_target.tvd,
        inc=first_hold_inc,
        azi=first_hold_azi,
    )
    seg2 = design_connector(
        ConnectorDesignRequest(
            start=entry_end.model_copy(deep=True),
            end=hold_end,
            step_m=request.step_m,
            azi_reference=request.azi_reference,
            dls_design=request.dls_design,
        )
    )
    stations = _concat_stations(seg1.stations, seg2.stations)
    max_dls = max(seg1.max_dls, seg2.max_dls)

    geometry = enrich_survey_geometry(stations)
    entry_offset_m = _heel_toe_length(request.heel, entry)
    if at_toe:
        entry_mode: Literal["any", "heel", "toe"] = "toe"
    elif at_heel:
        entry_mode = "heel"
    else:
        entry_mode = "any"
    return HorizontalDesignResponse(
        stations=stations,
        max_dls=max_dls,
        geometry=geometry,
        entry_mode=entry_mode,
        entry_plan=_entry_plan_from_point(entry),
        entry_offset_m=entry_offset_m,
    )


def _design_gs_entry_at_toe(request: HorizontalDesignRequest) -> HorizontalDesignResponse:
    result = _design_horizontal_at_entry(request, request.toe)
    return result.model_copy(
        update={
            "entry_mode": "toe",
            "entry_offset_m": _heel_toe_length(request.heel, request.toe),
        }
    )


def design_horizontal_at_offset(
    request: HorizontalDesignRequest,
    offset_m: float,
) -> HorizontalDesignResponse:
    entry = _point_on_heel_toe(request.heel, request.toe, offset_m)
    return _design_horizontal_at_entry(request, entry)


def design_horizontal_optimize_entry(request: HorizontalDesignRequest) -> HorizontalDesignResponse:
    offsets = gs_entry_endpoint_offsets(request.heel, request.toe)
    best: HorizontalDesignResponse | None = None
    best_md = float("inf")
    best_offset = 0.0

    for offset_m in offsets:
        try:
            candidate = design_horizontal_at_offset(request, offset_m)
        except (ValueError, TypeError):
            continue
        md = candidate.geometry.length_m
        if md < best_md or (abs(md - best_md) < 1e-3 and offset_m < best_offset):
            best_md = md
            best_offset = offset_m
            best = candidate

    if best is None:
        result = _design_horizontal_at_entry(request, request.heel)
        return result.model_copy(
            update={
                "entry_mode": "any",
                "entry_offset_m": 0.0,
                "entry_search_evaluated": len(offsets),
            }
        )

    return best.model_copy(
        update={
            "entry_mode": "any",
            "entry_offset_m": best_offset,
            "entry_search_evaluated": len(offsets),
        }
    )


def design_horizontal(request: HorizontalDesignRequest) -> HorizontalDesignResponse:
    mode = request.entry_mode
    if mode == "toe":
        return _design_gs_entry_at_toe(request)
    if mode == "any":
        return design_horizontal_optimize_entry(request)
    result = _design_horizontal_at_entry(request, request.heel)
    return result.model_copy(update={"entry_mode": "heel", "entry_offset_m": 0.0})
