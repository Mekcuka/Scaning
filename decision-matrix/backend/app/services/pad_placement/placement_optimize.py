"""M2+ pad center search: grid around TD centroid minimizing sum MD."""

from __future__ import annotations

import math
from collections.abc import Callable
from uuid import UUID

from app.models import InfrastructureObject
from app.services.pad_placement.evaluate import (
    evaluate_pad_group,
    sum_md_m_from_candidate,
    variant_is_invalid,
)
from app.services.pad_placement.placement import (
    suggest_pad_center,
    td_centroid,
    violates_pad_spacing,
)
from app.services.pad_placement.schemas import (
    BottomholeSnapshot,
    LogicalWell,
    PadCandidateOut,
    PadPlacementParams,
)

MAX_GRID_AXIS = 7
MAX_GRID_POINTS = MAX_GRID_AXIS * MAX_GRID_AXIS


def effective_center_search_step(radius_m: float, step_m: float) -> float:
    """Increase step until grid axis count is at most MAX_GRID_AXIS."""
    step = max(step_m, 1.0)
    while step <= radius_m * 2:
        axis = int(2 * radius_m / step) + 1
        if axis <= MAX_GRID_AXIS:
            return step
        step = math.ceil((2 * radius_m) / (MAX_GRID_AXIS - 1))
    return radius_m


def iter_center_search_points(
    anchor_lon: float,
    anchor_lat: float,
    *,
    radius_m: float,
    step_m: float,
    extra_seeds: list[tuple[float, float]] | None = None,
) -> list[tuple[float, float]]:
    """ENU grid around anchor; dedupe by ~1 m."""
    step = effective_center_search_step(radius_m, step_m)
    points: list[tuple[float, float]] = []
    seen: set[tuple[int, int]] = set()

    def add(lon: float, lat: float) -> None:
        key = (round(lon * 1e5), round(lat * 1e5))
        if key not in seen:
            seen.add(key)
            points.append((lon, lat))

    from app.services.pad_placement.placement import _offset_lonlat

    for east_m in _frange(-radius_m, radius_m, step):
        for north_m in _frange(-radius_m, radius_m, step):
            dist = math.hypot(east_m, north_m)
            if dist > radius_m + 1e-3:
                continue
            bearing = math.atan2(east_m, north_m)
            dlon, dlat = _offset_lonlat(anchor_lat, bearing, dist)
            add(anchor_lon + dlon, anchor_lat + dlat)

    for lon, lat in extra_seeds or []:
        add(lon, lat)

    return points


def find_best_pad_center(
    wells: list[LogicalWell],
    *,
    params: PadPlacementParams,
    snapshots_by_id: dict[UUID, BottomholeSnapshot],
    subtype: str,
    candidate_id: str,
    existing_pads: list[InfrastructureObject],
    other_centers: list[tuple[float, float]],
    evaluate_fn: Callable[..., PadCandidateOut] = evaluate_pad_group,
) -> tuple[PadCandidateOut | None, list[str]]:
    """Evaluate grid candidates; return pad with minimum sum MD."""
    warnings: list[str] = []
    if not wells:
        return None, warnings

    clon, clat = td_centroid(wells)
    step = effective_center_search_step(
        params.center_search_radius_m,
        params.center_search_step_m,
    )
    if abs(step - params.center_search_step_m) > 0.5:
        warnings.append(f"Center search step adjusted to {step:.0f} m (grid cap)")

    search_points = iter_center_search_points(
        clon,
        clat,
        radius_m=params.center_search_radius_m,
        step_m=step,
        extra_seeds=[suggest_pad_center(wells)],
    )

    best: PadCandidateOut | None = None
    best_key: tuple[float, int, int] | None = None

    for lon, lat in search_points:
        if violates_pad_spacing(
            lon,
            lat,
            params=params,
            existing_pads=existing_pads,
            other_centers=other_centers,
        ):
            continue
        cand = evaluate_fn(
            wells,
            snapshots_by_id=snapshots_by_id,
            params=params,
            subtype=subtype,
            candidate_id=candidate_id,
            center_lon=lon,
            center_lat=lat,
        )
        md, _ = sum_md_m_from_candidate([cand], wells)
        invalid = variant_is_invalid([cand], len(wells))
        n_warn = len(cand.warnings)
        # Lower MD first; prefer valid; then fewer warnings.
        key = (md, 1 if invalid else 0, n_warn)
        if best_key is None or key < best_key:
            best = cand
            best_key = key

    if best is None:
        warnings.append("No valid pad center in search grid (spacing constraints)")
    return best, warnings


def _frange(start: float, stop: float, step: float) -> list[float]:
    if step <= 0:
        return [start]
    vals: list[float] = []
    v = start
    while v <= stop + 1e-9:
        vals.append(v)
        v += step
    return vals
