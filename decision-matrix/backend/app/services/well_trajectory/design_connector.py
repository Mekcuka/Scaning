"""Single-well connector design from manual target."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import read_nds_deg
from app.services.well_trajectory.pad_access import assert_pad_object
from app.services.well_trajectory.schemas import (
    WellTrajectoryDesignRequest,
    WellTrajectoryDesignResponse,
)
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter
from app.services.well_trajectory.trajectory_store import read_trajectories_json, store_trajectories_json
from app.services.well_trajectory.planner_bridge import planner_schemas


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
