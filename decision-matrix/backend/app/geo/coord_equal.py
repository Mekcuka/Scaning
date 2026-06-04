"""Exact coordinate equality for line ↔ point attachment (no distance tolerance)."""

from __future__ import annotations

import math

# ~1 mm at equator in degrees
COORD_EQUAL_ABS_TOL = 1e-8


def coords_equal(lon1: float, lat1: float, lon2: float, lat2: float) -> bool:
    """True if two WGS84 points are the same stored position."""
    return math.isclose(lon1, lon2, abs_tol=COORD_EQUAL_ABS_TOL, rel_tol=0.0) and math.isclose(
        lat1, lat2, abs_tol=COORD_EQUAL_ABS_TOL, rel_tol=0.0
    )
