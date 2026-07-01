"""Resample polyline vertices at fixed chainage intervals (geodesic)."""

from __future__ import annotations

from app.services.spatial import haversine_km


def _segment_lengths_m(coords: list[tuple[float, float]]) -> list[float]:
    out: list[float] = []
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        out.append(haversine_km(lon1, lat1, lon2, lat2) * 1000.0)
    return out


def _interpolate_on_segment(
    a: tuple[float, float],
    b: tuple[float, float],
    frac: float,
) -> tuple[float, float]:
    frac = max(0.0, min(1.0, frac))
    lon = a[0] + frac * (b[0] - a[0])
    lat = a[1] + frac * (b[1] - a[1])
    return lon, lat


def sample_polyline_chainage(
    coords: list[tuple[float, float]],
    step_m: float,
) -> list[tuple[float, float, float]]:
    """Return (chainage_m, lon, lat) samples along the polyline."""
    if not coords:
        return []
    if len(coords) == 1:
        return [(0.0, coords[0][0], coords[0][1])]
    if step_m <= 0:
        raise ValueError("step_m must be positive")

    seg_lengths = _segment_lengths_m(coords)
    total_m = sum(seg_lengths)

    targets: list[float] = []
    chain = 0.0
    while chain <= total_m + 1e-6:
        targets.append(round(chain, 3))
        chain += step_m
    if not targets or targets[-1] < total_m - 1e-6:
        targets.append(round(total_m, 3))

    results: list[tuple[float, float, float]] = []
    seg_idx = 0
    seg_start = 0.0
    for target in targets:
        while seg_idx < len(seg_lengths) and seg_start + seg_lengths[seg_idx] < target - 1e-9:
            seg_start += seg_lengths[seg_idx]
            seg_idx += 1
        if seg_idx >= len(seg_lengths):
            lon, lat = coords[-1]
        else:
            seg_len = seg_lengths[seg_idx]
            if seg_len < 1e-9:
                lon, lat = coords[seg_idx]
            else:
                frac = (target - seg_start) / seg_len
                lon, lat = _interpolate_on_segment(coords[seg_idx], coords[seg_idx + 1], frac)
        results.append((target, lon, lat))
    return results
