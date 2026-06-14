"""Survey interpolation for all wells on a pad."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.well_trajectory.pad_access import assert_pad_object
from app.services.well_trajectory.schemas import WellTrajectoryComputeResponse
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter
from app.services.well_trajectory.trajectory_store import (
    read_trajectories_json,
    store_computed_at,
    store_trajectories_json,
)
from app.services.well_trajectory.planner_bridge import planner_schemas


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
    return store_computed_at(props)
