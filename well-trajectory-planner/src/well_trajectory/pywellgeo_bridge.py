"""PyWellGeo bridge: geometry metadata from survey stations."""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any

import numpy as np

from well_trajectory.schemas import SurveyGeometry, SurveyStation

if TYPE_CHECKING:
    pass


class PyWellGeoNotAvailableError(RuntimeError):
    """Raised when pywellgeo is not installed."""


@lru_cache(maxsize=1)
def _well_tree_class() -> Any:
    try:
        from pywellgeo.well_tree.well_tree_tno import WellTreeTNO
    except ImportError as exc:
        raise PyWellGeoNotAvailableError(
            "pywellgeo is not installed; pip install pywellgeo pythermonomics"
        ) from exc
    return WellTreeTNO


def _last_node_ahd(root: Any) -> float:
    node = root
    while node.branches:
        node = node.branches[0]
    return float(node.ahd)


def stations_to_geometry(stations: list[SurveyStation]) -> SurveyGeometry:
    """Build path length and extrema from stations using PyWellGeo WellTreeTNO."""
    if len(stations) < 2:
        md_max = stations[0].md if stations else 0.0
        tvd_max = stations[0].tvd if stations else 0.0
        return SurveyGeometry(length_m=0.0, md_max=md_max, tvd_max=tvd_max)

    WellTreeTNO = _well_tree_class()
    x = np.array([s.e for s in stations], dtype=np.float64)
    y = np.array([s.n for s in stations], dtype=np.float64)
    z = np.array([-s.tvd for s in stations], dtype=np.float64)
    tree = WellTreeTNO.from_xyz(x, y, z)
    tree.init_ahd()
    length_m = _last_node_ahd(tree)
    md_max = max(s.md for s in stations)
    tvd_max = max(s.tvd for s in stations)
    return SurveyGeometry(length_m=length_m, md_max=md_max, tvd_max=tvd_max)


def enrich_survey_geometry(stations: list[SurveyStation]) -> SurveyGeometry:
    """Public entry: compute geometry metadata for a survey."""
    return stations_to_geometry(stations)
