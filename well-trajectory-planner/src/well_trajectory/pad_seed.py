"""Generate vertical trajectory stubs from pad well layout."""

from __future__ import annotations

from well_trajectory.enu_transform import nds_deg_to_math_rotation_deg, rotate_point
from well_trajectory.pywellgeo_bridge import enrich_survey_geometry
from well_trajectory.schemas import (
    PadGenerateFromLayoutRequest,
    PadGenerateFromLayoutResponse,
    PadWellTrajectory,
    SurveyStation,
    WellDesignStub,
    WellHead,
    WellSurveyBlock,
)

DEFAULT_STUB_TVD_M = 100.0


def _vertical_stations(
    *,
    north_m: float,
    east_m: float,
    kb_m: float,
    target_tvd_m: float,
    azi_deg: float,
) -> list[SurveyStation]:
    return [
        SurveyStation(
            md=0.0,
            inc=0.0,
            azi=azi_deg,
            tvd=0.0,
            n=north_m,
            e=east_m,
        ),
        SurveyStation(
            md=target_tvd_m,
            inc=0.0,
            azi=azi_deg,
            tvd=target_tvd_m,
            n=north_m,
            e=east_m,
        ),
    ]


def generate_from_pad_layout(request: PadGenerateFromLayoutRequest) -> PadGenerateFromLayoutResponse:
    target_tvd = request.target_tvd_m if request.target_tvd_m is not None else DEFAULT_STUB_TVD_M
    rotation = nds_deg_to_math_rotation_deg(request.rotation_deg)
    wells: list[PadWellTrajectory] = []

    for index, local in enumerate(request.wells_local):
        east_rot, north_rot = rotate_point(local.east_m, local.north_m, rotation)
        stations = _vertical_stations(
            north_m=north_rot,
            east_m=east_rot,
            kb_m=request.kb_m,
            target_tvd_m=target_tvd,
            azi_deg=request.rotation_deg,
        )
        geometry = enrich_survey_geometry(stations)
        wells.append(
            PadWellTrajectory(
                well_index=index,
                name=f"Скв-{index + 1}",
                wellhead=WellHead(
                    east_m=local.east_m,
                    north_m=local.north_m,
                    kb_m=request.kb_m,
                ),
                azi_reference=request.azi_reference,
                error_model=request.error_model,
                design=WellDesignStub(
                    profile="vertical",
                    start={"md": 0, "inc": 0, "azi": request.rotation_deg},
                    end={"tvd": target_tvd},
                ),
                survey=WellSurveyBlock(source="stub", stations=stations),
                geometry=geometry,
            )
        )

    return PadGenerateFromLayoutResponse(wells=wells)
