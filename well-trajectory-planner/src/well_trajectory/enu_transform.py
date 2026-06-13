"""Local ENU helpers aligned with pad-earthwork well layout."""

from __future__ import annotations

import math


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
