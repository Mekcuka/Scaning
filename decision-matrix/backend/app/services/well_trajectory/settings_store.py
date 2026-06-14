"""Per-pad well trajectory calculation settings (stored in infrastructure properties)."""

from __future__ import annotations

from typing import Any, Literal

from app.models import InfrastructureObject
from app.services.well_trajectory.schemas import WellTrajectorySettingsOut

WELL_TRAJECTORY_STEP_M = "well_trajectory_step_m"
WELL_TRAJECTORY_AZI_REFERENCE = "well_trajectory_azi_reference"
WELL_TRAJECTORY_ERROR_MODEL = "well_trajectory_error_model"
WELL_TRAJECTORY_STUB_TVD_M = "well_trajectory_stub_tvd_m"
WELL_TRAJECTORY_DEFAULT_TVD_M = "well_trajectory_default_tvd_m"
WELL_TRAJECTORY_SF_WARNING_THRESHOLD = "well_trajectory_sf_warning_threshold"
WELL_TRAJECTORY_INC_HEEL = "well_trajectory_inc_heel"
WELL_TRAJECTORY_GS_ENTRY_SEARCH_STEP_M = "well_trajectory_gs_entry_search_step_m"

DEFAULT_STEP_M = 30.0
DEFAULT_STUB_TVD_M = 100.0
DEFAULT_DEFAULT_TVD_M = 1500.0
DEFAULT_INC_HEEL = 90.0
DEFAULT_GS_ENTRY_SEARCH_STEP_M = 30.0
DEFAULT_ERROR_MODEL = "ISCWSA MWD Rev5.11"

CALC_SETTINGS_KEYS = frozenset(
    {
        WELL_TRAJECTORY_STEP_M,
        WELL_TRAJECTORY_AZI_REFERENCE,
        WELL_TRAJECTORY_ERROR_MODEL,
        WELL_TRAJECTORY_STUB_TVD_M,
        WELL_TRAJECTORY_DEFAULT_TVD_M,
        WELL_TRAJECTORY_SF_WARNING_THRESHOLD,
        WELL_TRAJECTORY_INC_HEEL,
        WELL_TRAJECTORY_GS_ENTRY_SEARCH_STEP_M,
    }
)


def _read_float(props: dict[str, Any], key: str, default: float) -> float:
    raw = props.get(key)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


def _read_optional_float(props: dict[str, Any], key: str) -> float | None:
    raw = props.get(key)
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _read_azi_reference(props: dict[str, Any]) -> Literal["grid", "magnetic", "true"]:
    raw = str(props.get(WELL_TRAJECTORY_AZI_REFERENCE) or "grid").lower().strip()
    if raw in ("grid", "magnetic", "true"):
        return raw  # type: ignore[return-value]
    return "grid"


def well_trajectory_settings_for_pad(obj: InfrastructureObject | None) -> WellTrajectorySettingsOut:
    props = (obj.properties or {}) if obj is not None else {}
    default_tvd = _read_optional_float(props, WELL_TRAJECTORY_DEFAULT_TVD_M)
    return WellTrajectorySettingsOut(
        default_error_model=str(props.get(WELL_TRAJECTORY_ERROR_MODEL) or DEFAULT_ERROR_MODEL),
        default_azi_reference=_read_azi_reference(props),
        sf_warning_threshold=_read_float(props, WELL_TRAJECTORY_SF_WARNING_THRESHOLD, 1.0),
        default_target_tvd_m=default_tvd if default_tvd is not None else DEFAULT_DEFAULT_TVD_M,
        units="metric",
        step_m=_read_float(props, WELL_TRAJECTORY_STEP_M, DEFAULT_STEP_M),
        stub_tvd_m=_read_float(props, WELL_TRAJECTORY_STUB_TVD_M, DEFAULT_STUB_TVD_M),
        inc_heel=_read_float(props, WELL_TRAJECTORY_INC_HEEL, DEFAULT_INC_HEEL),
        gs_entry_search_step_m=_read_float(
            props, WELL_TRAJECTORY_GS_ENTRY_SEARCH_STEP_M, DEFAULT_GS_ENTRY_SEARCH_STEP_M
        ),
    )


def merge_calc_settings_into_properties(
    props: dict[str, Any] | None,
    *,
    step_m: float,
    azi_reference: str,
    error_model: str,
    stub_tvd_m: float,
    default_tvd_m: float,
    sf_warning_threshold: float,
    inc_heel: float,
    gs_entry_search_step_m: float,
) -> dict[str, Any]:
    out = dict(props or {})
    out[WELL_TRAJECTORY_STEP_M] = step_m
    out[WELL_TRAJECTORY_AZI_REFERENCE] = azi_reference
    out[WELL_TRAJECTORY_ERROR_MODEL] = error_model
    out[WELL_TRAJECTORY_STUB_TVD_M] = stub_tvd_m
    out[WELL_TRAJECTORY_DEFAULT_TVD_M] = default_tvd_m
    out[WELL_TRAJECTORY_SF_WARNING_THRESHOLD] = sf_warning_threshold
    out[WELL_TRAJECTORY_INC_HEEL] = inc_heel
    out[WELL_TRAJECTORY_GS_ENTRY_SEARCH_STEP_M] = gs_entry_search_step_m
    return out
