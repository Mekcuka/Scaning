"""Auto-generate pad plan polygon from well count and layout margins."""

from __future__ import annotations

import math

from pydantic import BaseModel, Field, model_validator

from pad_earthwork.schemas import PlanPolygonSketch, PlanVertex, WellLayoutGenerateResponse
from pad_earthwork.volume_plan import polygon_footprint_area_m2

MAX_DIM_M = 500.0
MAX_WELL_COUNT = 64


class PadLayoutMargins(BaseModel):
    left_m: float = Field(default=27.0, ge=0, le=500)
    bottom_m: float = Field(default=43.0, ge=0, le=500)
    top_m: float = Field(default=15.0, ge=0, le=500)
    end_m: float = Field(default=70.0, ge=0, le=500)


class WellLayoutParams(BaseModel):
    well_count: int = Field(..., ge=1, le=MAX_WELL_COUNT)
    wells_per_group: int = Field(..., ge=1, le=MAX_WELL_COUNT)
    well_spacing_m: float = Field(..., gt=0, le=500)
    group_spacing_m: float = Field(default=0.0, ge=0, le=500)
    margins: PadLayoutMargins = Field(default_factory=PadLayoutMargins)
    rotation_deg: float = Field(default=90.0, ge=0, le=360)

    @model_validator(mode="after")
    def wells_per_group_not_exceed_count(self) -> WellLayoutParams:
        if self.wells_per_group > self.well_count:
            raise ValueError("wells_per_group cannot exceed well_count")
        return self


class WellLayoutValidationError(ValueError):
    """Invalid well layout parameters or resulting dimensions."""


def compute_well_positions_east_m(
    well_count: int,
    wells_per_group: int,
    well_spacing_m: float,
    group_spacing_m: float,
) -> list[float]:
    if well_count < 1:
        raise WellLayoutValidationError("well_count must be at least 1")
    positions = [0.0]
    for i in range(1, well_count):
        if i % wells_per_group != 0:
            positions.append(positions[-1] + well_spacing_m)
        else:
            positions.append(positions[-1] + group_spacing_m)
    return positions


def nds_deg_to_math_rotation_deg(nds_deg: float) -> float:
    """NDS: azimuth from North clockwise → math CCW angle from East."""
    return 90.0 - nds_deg


def rotate_point(east_m: float, north_m: float, rotation_deg: float) -> tuple[float, float]:
    rot = math.radians(rotation_deg)
    cos_r = math.cos(rot)
    sin_r = math.sin(rot)
    return (
        east_m * cos_r - north_m * sin_r,
        east_m * sin_r + north_m * cos_r,
    )


def rotate_vertices(
    points: list[tuple[float, float]],
    rotation_deg: float,
) -> list[tuple[float, float]]:
    if rotation_deg == 0.0:
        return list(points)
    return [rotate_point(e, n, rotation_deg) for e, n in points]


def _validate_bbox_dims(length_m: float, width_m: float) -> None:
    if length_m <= 0 or width_m <= 0:
        raise WellLayoutValidationError("pad dimensions must be positive")
    if length_m > MAX_DIM_M or width_m > MAX_DIM_M:
        raise WellLayoutValidationError("pad dimensions exceed 500 m limit")


def generate_pad_polygon_from_wells(params: WellLayoutParams) -> WellLayoutGenerateResponse:
    positions = compute_well_positions_east_m(
        params.well_count,
        params.wells_per_group,
        params.well_spacing_m,
        params.group_spacing_m,
    )
    last_east = positions[-1]
    m = params.margins
    length_m = m.left_m + last_east + m.end_m
    width_m = m.bottom_m + m.top_m
    _validate_bbox_dims(length_m, width_m)

    raw_corners = [
        (-m.left_m, -m.bottom_m),
        (last_east + m.end_m, -m.bottom_m),
        (last_east + m.end_m, m.top_m),
        (-m.left_m, m.top_m),
    ]
    math_rot = nds_deg_to_math_rotation_deg(params.rotation_deg)
    rotated_corners = rotate_vertices(raw_corners, math_rot)
    rotated_wells = rotate_vertices([(e, 0.0) for e in positions], math_rot)

    for east_m, north_m in rotated_corners + rotated_wells:
        if abs(east_m) > MAX_DIM_M or abs(north_m) > MAX_DIM_M:
            raise WellLayoutValidationError("rotated footprint exceeds local ENU bounds")

    vertices = [
        PlanVertex(east_m=round(e, 3), north_m=round(n, 3))
        for e, n in rotated_corners
    ]
    wells_local = [
        PlanVertex(east_m=round(e, 3), north_m=round(n, 3))
        for e, n in rotated_wells
    ]
    sketch = PlanPolygonSketch(kind="plan_polygon", vertices=vertices)
    area = polygon_footprint_area_m2(vertices)

    return WellLayoutGenerateResponse(
        sketch=sketch,
        wells_local=wells_local,
        length_m=round(length_m, 3),
        width_m=round(width_m, 3),
        rotation_deg=params.rotation_deg,
        footprint_area_m2=round(area, 3),
    )
