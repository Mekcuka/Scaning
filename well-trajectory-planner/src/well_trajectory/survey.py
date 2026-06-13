"""Survey interpolation via welleng."""

from __future__ import annotations

import welleng as we

from well_trajectory.pywellgeo_bridge import enrich_survey_geometry
from well_trajectory.schemas import SurveyInterpolateRequest, SurveyInterpolateResponse, SurveyStation


def _stations_to_survey(stations: list[SurveyStation], azi_reference: str) -> we.survey.Survey:
    return we.survey.Survey(
        md=[s.md for s in stations],
        inc=[s.inc for s in stations],
        azi=[s.azi for s in stations],
        header=we.survey.SurveyHeader(azi_reference=azi_reference),
    )


def _survey_to_stations(survey: we.survey.Survey) -> list[SurveyStation]:
    ref = survey.header.azi_reference
    stations: list[SurveyStation] = []
    for i in range(len(survey.md)):
        if ref == "grid":
            azi = float(survey.azi_grid_deg[i])
        elif ref == "magnetic":
            azi = float(survey.azi_mag_deg[i])
        else:
            azi = float(survey.azi_true_deg[i])
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


def interpolate_survey(request: SurveyInterpolateRequest) -> SurveyInterpolateResponse:
    survey = _stations_to_survey(request.stations, request.azi_reference)
    densified = survey.interpolate_survey(step=request.step_m)
    stations = _survey_to_stations(densified)
    geometry = enrich_survey_geometry(stations)
    return SurveyInterpolateResponse(stations=stations, geometry=geometry)
