"""Trajectory design speed/quality tradeoffs for pad placement evaluate."""

from __future__ import annotations

import math
from typing import Literal

from app.services.pad_placement.schemas import PadPlacementParams

TrajectoryDesignMode = Literal["full", "coarse", "skip"]

PAD_PLACEMENT_GS_ENTRY_MIN_STEP_M = 50.0
PAD_PLACEMENT_GS_ENTRY_COARSE_DIVISOR = 4.0
PAD_PLACEMENT_GS_ENTRY_FULL_DIVISOR = 10.0


def gs_lateral_length_m(target: dict) -> float:
    heel = target.get("heel_plan") if isinstance(target.get("heel_plan"), dict) else {}
    plan = target.get("plan") if isinstance(target.get("plan"), dict) else {}
    return math.hypot(
        float(plan.get("north_m", 0)) - float(heel.get("north_m", 0)),
        float(plan.get("east_m", 0)) - float(heel.get("east_m", 0)),
    )


def pad_placement_gs_entry_search_step_m(
    target: dict,
    *,
    params: PadPlacementParams,
    settings_step_m: float,
    mode: TrajectoryDesignMode,
) -> float | None:
    if str(target.get("profile") or "") != "gs":
        return None
    raw_mode = str(target.get("gs_entry_mode") or "any").lower().strip()
    if raw_mode not in ("any",):
        return None

    length = gs_lateral_length_m(target)
    if length < 1e-3:
        return None

    if params.gs_entry_search_step_m is not None:
        return params.gs_entry_search_step_m

    divisor = (
        PAD_PLACEMENT_GS_ENTRY_COARSE_DIVISOR
        if mode == "coarse"
        else PAD_PLACEMENT_GS_ENTRY_FULL_DIVISOR
    )
    adaptive = max(PAD_PLACEMENT_GS_ENTRY_MIN_STEP_M, length / divisor)
    return max(settings_step_m, adaptive)
