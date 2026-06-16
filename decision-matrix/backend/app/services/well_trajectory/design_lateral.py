"""Welleng connector design for PyWellGeo lateral branches (kick-off → bottomhole)."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.well_trajectory.bottomhole_properties import (
    GS_HEEL_LABEL,
    GS_TOE_LABEL,
    azimuth_deg,
    bottomhole_plan_local,
    is_gs_bottomhole_line,
    read_gs_heel_tvd_m,
    read_gs_line_endpoints,
    read_gs_toe_tvd_m,
    target_inc_azi,
)
from app.services.well_trajectory.coord_transform import lonlat_to_local
from app.services.well_trajectory.planner_bridge import planner_schemas
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter


EndpointKind = Literal["heel", "toe"] | None


@dataclass
class LateralDesignResult:
    xyz: list[list[float]]
    max_dls: float
    warnings: list[str] = field(default_factory=list)


def parse_bottomhole_ref(ref: str) -> tuple[UUID, EndpointKind]:
    if ":" in ref:
        obj_id_str, suffix = ref.rsplit(":", 1)
        if suffix in ("heel", "toe"):
            return UUID(obj_id_str), suffix  # type: ignore[return-value]
    return UUID(ref), None


def _station_dicts_to_survey_stations(stations_raw: list[Any]) -> list[Any]:
    schemas = planner_schemas()
    out: list[Any] = []
    for row in stations_raw:
        if not isinstance(row, dict):
            continue
        out.append(
            schemas.SurveyStation(
                md=float(row.get("md", 0)),
                inc=float(row.get("inc", 0)),
                azi=float(row.get("azi", 0)),
                tvd=float(row.get("tvd", 0)),
                n=float(row.get("n", 0)),
                e=float(row.get("e", 0)),
            )
        )
    return out


def kickoff_connector_point(
    well: dict[str, Any],
    kickoff_xyz: list[float],
    *,
    pad: InfrastructureObject | None = None,
) -> Any:
    """Resolve kick-off position and attitude from the main-bore survey."""
    if len(kickoff_xyz) != 3:
        raise ValueError("kickoff_xyz must be [x, y, z]")
    survey = well.get("survey") or {}
    stations_raw = survey.get("stations") or []
    stations = _station_dicts_to_survey_stations(stations_raw)
    if len(stations) < 2:
        raise ValueError("Нет survey с минимум двумя станциями для kick-off")

    settings = well_trajectory_settings_for_pad(pad)
    azi_ref = well.get("azi_reference") or settings.default_azi_reference
    adapter = get_well_trajectory_adapter()
    schemas = planner_schemas()
    densified = adapter.interpolate_survey(
        schemas.SurveyInterpolateRequest(
            stations=stations,
            step_m=min(15.0, settings.step_m),
            azi_reference=azi_ref,
        )
    ).stations

    target_e = float(kickoff_xyz[0])
    target_n = float(kickoff_xyz[1])
    target_tvd = -float(kickoff_xyz[2])

    best = densified[0]
    best_dist = float("inf")
    for station in densified:
        dist = math.sqrt(
            (station.e - target_e) ** 2
            + (station.n - target_n) ** 2
            + (station.tvd - target_tvd) ** 2
        )
        if dist < best_dist:
            best_dist = dist
            best = station

    return schemas.ConnectorPoint(
        northing=best.n,
        easting=best.e,
        tvd=best.tvd,
        inc=best.inc,
        azi=best.azi,
    )


def target_connector_point(
    pad: InfrastructureObject,
    bottomhole: InfrastructureObject,
    endpoint: EndpointKind,
) -> Any:
    """Build welleng end point from a bottomhole infra object (NNB or GS heel/toe)."""
    schemas = planner_schemas()
    settings = well_trajectory_settings_for_pad(pad)
    props = bottomhole.properties or {}
    subtype = (bottomhole.subtype or "").lower().strip()

    if is_gs_bottomhole_line(bottomhole):
        endpoints = read_gs_line_endpoints(bottomhole)
        if endpoints is None:
            raise ValueError(f"ГС: не заданы координаты {GS_HEEL_LABEL}/{GS_TOE_LABEL}")
        heel_lon, heel_lat, toe_lon, toe_lat = endpoints
        anchor_lon = float(pad.longitude)
        anchor_lat = float(pad.latitude)
        use_toe = endpoint != "heel"
        if use_toe:
            lon, lat = toe_lon, toe_lat
            tvd = read_gs_toe_tvd_m(pad, props)
            inc = 90.0
        else:
            lon, lat = heel_lon, heel_lat
            tvd = read_gs_heel_tvd_m(pad, props)
            inc = settings.inc_heel
        east_m, north_m = lonlat_to_local(anchor_lon, anchor_lat, lon, lat)
        heel_e, heel_n = lonlat_to_local(anchor_lon, anchor_lat, heel_lon, heel_lat)
        toe_e, toe_n = lonlat_to_local(anchor_lon, anchor_lat, toe_lon, toe_lat)
        azi = azimuth_deg(heel_n, heel_e, toe_n, toe_e)
        return schemas.ConnectorPoint(
            northing=north_m,
            easting=east_m,
            tvd=tvd,
            inc=inc,
            azi=azi,
        )

    if subtype == "well_bottomhole_gs_toe":
        east_m, north_m, _, _, tvd_m = bottomhole_plan_local(pad, bottomhole)
        _, azi = target_inc_azi(bottomhole, pad)
        return schemas.ConnectorPoint(
            northing=north_m,
            easting=east_m,
            tvd=read_gs_toe_tvd_m(pad, props),
            inc=90.0,
            azi=azi,
        )

    if subtype == "well_bottomhole_gs_heel":
        east_m, north_m, _, _, _ = bottomhole_plan_local(pad, bottomhole)
        _, azi = target_inc_azi(bottomhole, pad)
        return schemas.ConnectorPoint(
            northing=north_m,
            easting=east_m,
            tvd=read_gs_heel_tvd_m(pad, props),
            inc=settings.inc_heel,
            azi=azi,
        )

    east_m, north_m, _, _, tvd_m = bottomhole_plan_local(pad, bottomhole)
    inc, azi = target_inc_azi(bottomhole, pad)
    return schemas.ConnectorPoint(
        northing=north_m,
        easting=east_m,
        tvd=tvd_m,
        inc=inc,
        azi=azi,
    )


def _stations_to_xyz(stations: list[Any]) -> list[list[float]]:
    return [[float(s.e), float(s.n), -float(s.tvd)] for s in stations]


def _dist3(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((float(a[i]) - float(b[i])) ** 2 for i in range(3)))


def design_lateral_xyz(
    pad: InfrastructureObject,
    well: dict[str, Any],
    kickoff_xyz: list[float],
    bottomhole: InfrastructureObject,
    *,
    step_m: float | None = None,
    dls_design: float | None = None,
    endpoint: EndpointKind = None,
) -> LateralDesignResult:
    settings = well_trajectory_settings_for_pad(pad)
    step = step_m if step_m is not None else settings.step_m
    dls = dls_design if dls_design is not None else 3.0
    azi_ref = well.get("azi_reference") or settings.default_azi_reference

    start = kickoff_connector_point(well, kickoff_xyz, pad=pad)
    end = target_connector_point(pad, bottomhole, endpoint)

    adapter = get_well_trajectory_adapter()
    schemas = planner_schemas()
    try:
        design = adapter.design_connector(
            schemas.ConnectorDesignRequest(
                start=start,
                end=end,
                step_m=step,
                azi_reference=azi_ref,
                dls_design=dls,
            )
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Не удалось спроектировать lateral: {exc}",
        ) from exc

    warnings: list[str] = []
    if design.max_dls > 0:
        warnings.append(f"max DLS lateral: {design.max_dls:.2f} °/30m")

    kickoff_point = [float(kickoff_xyz[0]), float(kickoff_xyz[1]), float(kickoff_xyz[2])]
    connector_xyz = _stations_to_xyz(design.stations)
    if not connector_xyz:
        raise HTTPException(status_code=400, detail="Welleng connector вернул пустую траекторию")

    drift = _dist3(kickoff_point, connector_xyz[0])
    if drift > 1.0:
        warnings.append(
            f"kick-off узла расходится с survey на {drift:.1f} м — первая точка взята с узла дерева"
        )

    xyz = [kickoff_point]
    if len(connector_xyz) > 1:
        xyz.extend(connector_xyz[1:])
    elif _dist3(kickoff_point, connector_xyz[0]) > 1e-3:
        xyz.append(connector_xyz[0])

    if len(xyz) < 2:
        raise HTTPException(status_code=400, detail="Lateral требует минимум 2 точки XYZ")

    return LateralDesignResult(xyz=xyz, max_dls=float(design.max_dls), warnings=warnings)
