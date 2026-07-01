"""InfrastructureObject property keys for line elevation profile."""

from __future__ import annotations

from typing import Any

LINE_ELEVATION_PROFILE_STEP_M = "line_elevation_profile_step_m"
LINE_ELEVATION_PROFILE_JSON = "line_elevation_profile_json"
LINE_ELEVATION_PROFILE_COMPUTED_AT = "line_elevation_profile_computed_at"

DEFAULT_STEP_M = 100.0
MIN_STEP_M = 10.0
MAX_STEP_M = 1000.0

PROFILE_LINE_EXCLUDE_SUBTYPE = "well_bottomhole_gs"


def clamp_step_m(raw: Any) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return DEFAULT_STEP_M
    if value < MIN_STEP_M:
        return MIN_STEP_M
    if value > MAX_STEP_M:
        return MAX_STEP_M
    return value


def read_step_m(properties: dict[str, Any] | None) -> float:
    if not properties:
        return DEFAULT_STEP_M
    return clamp_step_m(properties.get(LINE_ELEVATION_PROFILE_STEP_M))
