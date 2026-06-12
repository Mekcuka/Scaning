"""Read well layout params from infrastructure object properties."""

from __future__ import annotations

from typing import Any

from app.geo.sand_properties import parse_nonneg_float
from app.services.pad_earthwork.properties import (
    PAD_LAYOUT_MARGIN_BOTTOM_M,
    PAD_LAYOUT_MARGIN_END_M,
    PAD_LAYOUT_MARGIN_LEFT_M,
    PAD_LAYOUT_MARGIN_TOP_M,
    PAD_WELL_COUNT,
    PAD_WELL_GROUP_SPACING_M,
    PAD_WELL_SPACING_M,
    PAD_WELLS_PER_GROUP,
)
from app.services.pad_earthwork.schemas import PadLayoutMarginsIn, WellLayoutGenerateRequestIn

DEFAULT_WELL_COUNT = 12
DEFAULT_WELLS_PER_GROUP = 1
DEFAULT_WELL_SPACING_M = 9.0
DEFAULT_GROUP_SPACING_M = 9.0
DEFAULT_MARGINS = PadLayoutMarginsIn()
DEFAULT_NDS_DEG = 90.0


def _read_int(props: dict[str, Any], key: str, default: int) -> int:
    raw = props.get(key)
    if raw is None:
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return value if value >= 1 else default


def _read_nonneg(props: dict[str, Any], key: str, default: float) -> float:
    value = parse_nonneg_float(props.get(key))
    return value if value is not None else default


def read_layout_margins(props: dict[str, Any] | None) -> PadLayoutMarginsIn:
    p = props or {}
    return PadLayoutMarginsIn(
        left_m=_read_nonneg(p, PAD_LAYOUT_MARGIN_LEFT_M, DEFAULT_MARGINS.left_m),
        bottom_m=_read_nonneg(p, PAD_LAYOUT_MARGIN_BOTTOM_M, DEFAULT_MARGINS.bottom_m),
        top_m=_read_nonneg(p, PAD_LAYOUT_MARGIN_TOP_M, DEFAULT_MARGINS.top_m),
        end_m=_read_nonneg(p, PAD_LAYOUT_MARGIN_END_M, DEFAULT_MARGINS.end_m),
    )


def resolve_well_layout_request(
    props: dict[str, Any] | None,
    body: WellLayoutGenerateRequestIn | None,
) -> dict[str, Any]:
    p = props or {}
    stored_margins = read_layout_margins(p)
    margins = body.margins if body and body.margins is not None else stored_margins
    return {
        "well_count": (
            body.well_count
            if body and body.well_count is not None
            else _read_int(p, PAD_WELL_COUNT, DEFAULT_WELL_COUNT)
        ),
        "wells_per_group": (
            body.wells_per_group
            if body and body.wells_per_group is not None
            else _read_int(p, PAD_WELLS_PER_GROUP, DEFAULT_WELLS_PER_GROUP)
        ),
        "well_spacing_m": (
            body.well_spacing_m
            if body and body.well_spacing_m is not None
            else _read_nonneg(p, PAD_WELL_SPACING_M, DEFAULT_WELL_SPACING_M)
        ),
        "group_spacing_m": (
            body.group_spacing_m
            if body and body.group_spacing_m is not None
            else _read_nonneg(p, PAD_WELL_GROUP_SPACING_M, DEFAULT_GROUP_SPACING_M)
        ),
        "margins": margins.model_dump(),
        "rotation_deg": (
            body.rotation_deg
            if body and body.rotation_deg is not None
            else float(p.get("pad_rotation_deg") if p.get("pad_rotation_deg") is not None else DEFAULT_NDS_DEG)
        ),
    }
