"""Well trajectory design via welleng connector."""

from __future__ import annotations

import math

import welleng as we

from well_trajectory.pywellgeo_bridge import enrich_survey_geometry
from well_trajectory.schemas import (
    ConnectorDesignRequest,
    ConnectorDesignResponse,
    ConnectorPoint,
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


def design_horizontal(request: HorizontalDesignRequest) -> HorizontalDesignResponse:
    heel_end = ConnectorPoint(
        northing=request.heel.northing,
        easting=request.heel.easting,
        tvd=request.heel.tvd,
        inc=request.inc_heel,
        azi=request.start.azi,
    )
    seg1 = design_connector(
        ConnectorDesignRequest(
            start=request.start,
            end=heel_end,
            step_m=request.step_m,
            azi_reference=request.azi_reference,
        )
    )

    dn = request.toe.northing - request.heel.northing
    de = request.toe.easting - request.heel.easting
    horiz_azi = math.degrees(math.atan2(de, dn)) % 360.0

    horiz_inc = request.inc_heel

    seg2 = design_connector(
        ConnectorDesignRequest(
            start=ConnectorPoint(
                northing=request.heel.northing,
                easting=request.heel.easting,
                tvd=request.heel.tvd,
                inc=horiz_inc,
                azi=horiz_azi,
            ),
            end=ConnectorPoint(
                northing=request.toe.northing,
                easting=request.toe.easting,
                tvd=request.toe.tvd,
                inc=horiz_inc,
                azi=horiz_azi,
            ),
            step_m=request.step_m,
            azi_reference=request.azi_reference,
        )
    )
    stations = _concat_stations(seg1.stations, seg2.stations)
    max_dls = max(seg1.max_dls, seg2.max_dls)
    geometry = enrich_survey_geometry(stations)
    return HorizontalDesignResponse(stations=stations, max_dls=max_dls, geometry=geometry)
