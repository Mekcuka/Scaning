"""Design surface summary for flat pad."""

from __future__ import annotations

from pad_earthwork.schemas import DesignOut, PadParams


def design_surface_summary(params: PadParams, *, footprint_area_m2: float | None = None) -> DesignOut:
    top = params.reference_elevation_m + params.height_m
    area = footprint_area_m2 if footprint_area_m2 is not None else params.length_m * params.width_m
    return DesignOut(top_elevation_m=top, footprint_area_m2=area)
