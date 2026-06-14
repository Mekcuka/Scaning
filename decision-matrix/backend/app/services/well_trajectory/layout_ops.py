"""Generate stub trajectories from pad well layout."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import _read_float, read_nds_deg
from app.services.pad_earthwork.properties import (
    DEFAULT_PAD_HEIGHT_M,
    DEFAULT_PAD_REFERENCE_ELEVATION_M,
    PAD_HEIGHT_M,
    PAD_REFERENCE_ELEVATION_M,
)
from app.services.well_trajectory.pad_wells_bootstrap import ensure_pad_wells_local_on_object
from app.services.well_trajectory.schemas import WellTrajectoryGenerateResponse
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter
from app.services.well_trajectory.trajectory_store import store_trajectories_json
from app.services.well_trajectory.planner_bridge import planner_schemas
from app.services.well_trajectory.pad_access import assert_pad_object


def default_kb_m(props: dict[str, Any]) -> float:
    ref = _read_float(props, PAD_REFERENCE_ELEVATION_M)
    if ref is None:
        ref = DEFAULT_PAD_REFERENCE_ELEVATION_M
    height = _read_float(props, PAD_HEIGHT_M)
    if height is None:
        height = DEFAULT_PAD_HEIGHT_M
    return ref + height


def well_to_dict(well: Any) -> dict[str, Any]:
    return well.model_dump(mode="json")


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
        kb_m=default_kb_m(props),
        rotation_deg=read_nds_deg(props),
        anchor=schemas.LonLat(lon=float(obj.longitude), lat=float(obj.latitude)),
        azi_reference=settings.default_azi_reference,
        error_model=settings.default_error_model,
        target_tvd_m=settings.stub_tvd_m,
    )

    adapter = get_well_trajectory_adapter()
    result = adapter.generate_from_pad_layout(request)
    trajectories = [well_to_dict(w) for w in result.wells]
    return WellTrajectoryGenerateResponse(trajectories=trajectories)


def apply_generate_to_properties(obj: InfrastructureObject) -> dict[str, Any]:
    response = generate_trajectories_from_layout(obj)
    return store_trajectories_json(obj.properties, response.trajectories)
