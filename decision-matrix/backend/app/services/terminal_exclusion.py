"""200 m exclusion zones around autoroad network terminals (planning only)."""

from __future__ import annotations

import math
from typing import Protocol
from uuid import UUID

from app.geo.constants import TERMINAL_EXCLUSION_RADIUS_KM
from app.services.road_graph import (
    closest_point_on_polyline_for_snap,
    haversine_km,
)
from app.services.spatial import closest_point_on_segment


def _exclusion_radius_km(radius_km: float | None) -> float:
    """Resolve radius at call time (supports monkeypatch on this module)."""
    return TERMINAL_EXCLUSION_RADIUS_KM if radius_km is None else radius_km


def segment_attach_outside_exclusion(
    t_lon: float,
    t_lat: float,
    seg_a: tuple[float, float],
    seg_b: tuple[float, float],
    terminals: list[_TerminalLike],
    *,
    radius_km: float | None = None,
) -> tuple[float, float]:
    """Point on segment seg_a–seg_b for backbone spur: outside all exclusion zones."""
    radius_km = _exclusion_radius_km(radius_km)
    clon, clat = closest_point_on_segment(
        t_lon, t_lat, seg_a[0], seg_a[1], seg_b[0], seg_b[1]
    )
    if min_distance_to_terminals(clon, clat, terminals) >= radius_km - 0.001:
        return clon, clat
    best: tuple[float, float] | None = None
    best_d = math.inf
    for i in range(41):
        f = i / 40.0
        mx = seg_a[0] + f * (seg_b[0] - seg_a[0])
        my = seg_a[1] + f * (seg_b[1] - seg_a[1])
        if min_distance_to_terminals(mx, my, terminals) >= radius_km - 0.001:
            d = haversine_km(mx, my, clon, clat)
            if d < best_d:
                best_d = d
                best = (mx, my)
    if best is not None:
        return best
    return exclusion_boundary_point(t_lon, t_lat, clon, clat)


class _TerminalLike(Protocol):
    lon: float
    lat: float
    id: UUID


class _PlannedLineLike(Protocol):
    kind: str
    coordinates: list[list[float]]


class _PlannedNodeLike(Protocol):
    lon: float
    lat: float


def min_distance_to_terminals(
    lon: float,
    lat: float,
    terminals: list[_TerminalLike],
) -> float:
    best = math.inf
    for t in terminals:
        d = haversine_km(lon, lat, t.lon, t.lat)
        if d < best:
            best = d
    return best


def is_inside_terminal_exclusion(
    lon: float,
    lat: float,
    terminals: list[_TerminalLike],
    *,
    radius_km: float | None = None,
) -> bool:
    radius_km = _exclusion_radius_km(radius_km)
    return min_distance_to_terminals(lon, lat, terminals) < radius_km - 0.001


def point_along_geodesic(
    lon1: float,
    lat1: float,
    lon2: float,
    lat2: float,
    fraction: float,
) -> tuple[float, float]:
    """Point at ``fraction`` in [0,1] along the great-circle arc lon1,lat1 → lon2,lat2."""
    if fraction <= 0.0:
        return lon1, lat1
    if fraction >= 1.0:
        return lon2, lat2
    phi1, lam1 = math.radians(lat1), math.radians(lon1)
    phi2, lam2 = math.radians(lat2), math.radians(lon2)
    dlam = lam2 - lam1
    bx = math.cos(phi2) * math.cos(dlam)
    by = math.cos(phi2) * math.sin(dlam)
    f = fraction
    phi3 = math.atan2(
        math.sin(phi1) + math.sin(phi2) * f,
        math.sqrt((math.cos(phi1) + bx * f) ** 2 + (by * f) ** 2),
    )
    lam3 = lam1 + math.atan2(by * f, math.cos(phi1) + bx * f)
    return math.degrees(lam3), math.degrees(phi3)


def exclusion_boundary_point(
    t_lon: float,
    t_lat: float,
    toward_lon: float,
    toward_lat: float,
    *,
    radius_km: float | None = None,
) -> tuple[float, float]:
    """Point at ``radius_km`` from T along the great-circle arc toward target."""
    radius_km = _exclusion_radius_km(radius_km)
    total = haversine_km(t_lon, t_lat, toward_lon, toward_lat)
    if total < 1e-12:
        return t_lon, t_lat
    if total <= radius_km + 1e-9:
        return toward_lon, toward_lat
    lo, hi = 0.0, 1.0
    for _ in range(48):
        mid = (lo + hi) / 2
        plon, plat = point_along_geodesic(t_lon, t_lat, toward_lon, toward_lat, mid)
        if haversine_km(t_lon, t_lat, plon, plat) < radius_km:
            lo = mid
        else:
            hi = mid
    return point_along_geodesic(t_lon, t_lat, toward_lon, toward_lat, hi)


def relocate_if_inside_exclusion(
    lon: float,
    lat: float,
    terminals: list[_TerminalLike],
    toward_lon: float,
    toward_lat: float,
    *,
    radius_km: float | None = None,
) -> tuple[float, float]:
    """Push ``lon,lat`` outside every terminal exclusion zone."""
    radius_km = _exclusion_radius_km(radius_km)
    out_lon, out_lat = lon, lat
    for _ in range(max(len(terminals) * 2, 4)):
        if not is_inside_terminal_exclusion(out_lon, out_lat, terminals, radius_km=radius_km):
            return out_lon, out_lat
        nearest: _TerminalLike | None = None
        nearest_d = math.inf
        for t in terminals:
            d = haversine_km(out_lon, out_lat, t.lon, t.lat)
            if d < nearest_d:
                nearest_d = d
                nearest = t
        if nearest is None:
            break
        hint_lon = toward_lon if toward_lon != nearest.lon else out_lon + 1e-4
        hint_lat = toward_lat if toward_lat != nearest.lat else out_lat
        out_lon, out_lat = exclusion_boundary_point(
            nearest.lon,
            nearest.lat,
            hint_lon,
            hint_lat,
            radius_km=radius_km,
        )
    return out_lon, out_lat


def _first_point_on_segment_at_min_dist(
    t_lon: float,
    t_lat: float,
    a: tuple[float, float],
    b: tuple[float, float],
    min_km: float,
) -> tuple[float, float] | None:
    da = haversine_km(t_lon, t_lat, a[0], a[1])
    db = haversine_km(t_lon, t_lat, b[0], b[1])
    if da >= min_km and db >= min_km:
        clon, clat = closest_point_on_segment(t_lon, t_lat, a[0], a[1], b[0], b[1])
        if haversine_km(t_lon, t_lat, clon, clat) >= min_km - 1e-9:
            return clon, clat
    if da >= min_km:
        return a
    if db >= min_km:
        return b
    if da < min_km and db < min_km:
        lo, hi = 0.0, 1.0
        for _ in range(48):
            mid = (lo + hi) / 2
            mx = a[0] + mid * (b[0] - a[0])
            my = a[1] + mid * (b[1] - a[1])
            if haversine_km(t_lon, t_lat, mx, my) >= min_km:
                hi = mid
            else:
                lo = mid
        return (a[0] + hi * (b[0] - a[0]), a[1] + hi * (b[1] - a[1]))
    return None


def closest_point_on_polyline_min_dist_from(
    t_lon: float,
    t_lat: float,
    coords: list[tuple[float, float]],
    min_km: float,
) -> tuple[float, float, float] | None:
    """Closest point on polyline with dist(T, point) >= min_km; None if unreachable."""
    if len(coords) < 2:
        return None
    raw_lon, raw_lat, _ = closest_point_on_polyline_for_snap(t_lon, t_lat, coords)
    raw_d = haversine_km(t_lon, t_lat, raw_lon, raw_lat)
    if raw_d >= min_km - 1e-9:
        return raw_lon, raw_lat, raw_d

    candidates: list[tuple[float, float, float]] = []
    for i in range(len(coords) - 1):
        pt = _first_point_on_segment_at_min_dist(
            t_lon, t_lat, coords[i], coords[i + 1], min_km
        )
        if pt is not None:
            d = haversine_km(t_lon, t_lat, pt[0], pt[1])
            if d >= min_km - 1e-9:
                candidates.append((pt[0], pt[1], d))

    for vtx in coords:
        d = haversine_km(t_lon, t_lat, vtx[0], vtx[1])
        if d >= min_km - 1e-9:
            candidates.append((vtx[0], vtx[1], d))

    if not candidates:
        return None

    def _dist_to_raw(c: tuple[float, float, float]) -> float:
        return haversine_km(c[0], c[1], raw_lon, raw_lat)

    best = min(candidates, key=_dist_to_raw)
    return best


def segment_penetrates_exclusion(
    lon1: float,
    lat1: float,
    lon2: float,
    lat2: float,
    terminals: list[_TerminalLike],
    *,
    ignore_ids: set[UUID] | None = None,
    radius_km: float | None = None,
) -> bool:
    """True if the geodesic segment enters any terminal exclusion disk (except ignore_ids)."""
    radius_km = _exclusion_radius_km(radius_km)
    ignore = ignore_ids or set()
    total = haversine_km(lon1, lat1, lon2, lat2)
    if total < 1e-9:
        return False
    steps = max(8, int(total / 0.025) + 1)
    for i in range(steps + 1):
        f = i / steps if steps else 0.0
        plon, plat = point_along_geodesic(lon1, lat1, lon2, lat2, f)
        for t in terminals:
            if t.id in ignore:
                continue
            if haversine_km(plon, plat, t.lon, t.lat) < radius_km - 0.001:
                return True
    return False


def boundary_pair(
    t_a: _TerminalLike,
    t_b: _TerminalLike,
    *,
    radius_km: float | None = None,
) -> tuple[tuple[float, float], tuple[float, float]]:
    """Boundary attachment points on the exclusion circles of two terminals."""
    radius_km = _exclusion_radius_km(radius_km)
    ba = exclusion_boundary_point(
        t_a.lon, t_a.lat, t_b.lon, t_b.lat, radius_km=radius_km
    )
    bb = exclusion_boundary_point(
        t_b.lon, t_b.lat, t_a.lon, t_a.lat, radius_km=radius_km
    )
    return ba, bb


def path_length_km(path: list[tuple[float, float]]) -> float:
    total = 0.0
    for i in range(len(path) - 1):
        total += haversine_km(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1])
    return total


def _wide_via_outside_blocker(
    blocker: _TerminalLike,
    a: tuple[float, float],
    b: tuple[float, float],
    terminals: list[_TerminalLike],
    ignore: set[UUID],
    *,
    radius_km: float,
) -> tuple[float, float]:
    """Boundary point on ``blocker`` so segments a→via and via→b avoid all exclusion disks."""
    mid_lon, mid_lat = point_along_geodesic(a[0], a[1], b[0], b[1], 0.5)
    dlon = b[0] - a[0]
    dlat = b[1] - a[1]
    cos_lat = math.cos(math.radians(blocker.lat))
    candidates: list[tuple[float, float]] = []
    for sign in (-1.0, 1.0):
        perp_lon = mid_lon - sign * dlat * 0.05
        perp_lat = mid_lat + sign * dlon * 0.05
        candidates.append(
            exclusion_boundary_point(
                blocker.lon,
                blocker.lat,
                perp_lon,
                perp_lat,
                radius_km=radius_km,
            )
        )
    km_per_deg_lat = 111.0
    km_per_deg_lon = max(111.0 * cos_lat, 1e-6)
    arc_km = radius_km * 2.5
    for k in range(16):
        ang = (2.0 * math.pi * k) / 16.0
        tgt_lon = blocker.lon + (arc_km / km_per_deg_lon) * math.cos(ang)
        tgt_lat = blocker.lat + (arc_km / km_per_deg_lat) * math.sin(ang)
        candidates.append(
            exclusion_boundary_point(
                blocker.lon,
                blocker.lat,
                tgt_lon,
                tgt_lat,
                radius_km=radius_km,
            )
        )
    best: tuple[float, float] | None = None
    best_pen = 10**9
    for via in candidates:
        p1 = segment_penetrates_exclusion(
            a[0], a[1], via[0], via[1], terminals, ignore_ids=ignore, radius_km=radius_km
        )
        p2 = segment_penetrates_exclusion(
            via[0], via[1], b[0], b[1], terminals, ignore_ids=ignore, radius_km=radius_km
        )
        if not p1 and not p2:
            return via
        score = (2 if p1 else 0) + (2 if p2 else 0)
        if score < best_pen:
            best_pen = score
            best = via
    return best if best is not None else candidates[0]


def _find_blocking_terminal_on_segment(
    lon1: float,
    lat1: float,
    lon2: float,
    lat2: float,
    terminals: list[_TerminalLike],
    ignore_ids: set[UUID],
    *,
    radius_km: float,
) -> _TerminalLike | None:
    total = haversine_km(lon1, lat1, lon2, lat2)
    if total < 1e-9:
        return None
    steps = max(8, int(total / 0.025) + 1)
    best: _TerminalLike | None = None
    best_d = math.inf
    for i in range(1, steps):
        f = i / steps
        plon, plat = point_along_geodesic(lon1, lat1, lon2, lat2, f)
        for t in terminals:
            if t.id in ignore_ids:
                continue
            d = haversine_km(plon, plat, t.lon, t.lat)
            if d < radius_km - 0.001 and d < best_d:
                best_d = d
                best = t
    return best


def _dedupe_path_points(path: list[tuple[float, float]], *, tol_km: float = 0.005) -> list[tuple[float, float]]:
    if not path:
        return []
    out = [path[0]]
    for pt in path[1:]:
        if haversine_km(out[-1][0], out[-1][1], pt[0], pt[1]) > tol_km:
            out.append(pt)
    return out


def sanitize_path_vertices(
    path: list[tuple[float, float]],
    terminals: list[_TerminalLike],
    *,
    radius_km: float | None = None,
) -> list[tuple[float, float]]:
    """Ensure every polyline vertex lies outside all exclusion zones."""
    radius_km = _exclusion_radius_km(radius_km)
    if not path:
        return []
    cleaned: list[tuple[float, float]] = []
    for i, (lon, lat) in enumerate(path):
        hint_lon = path[i + 1][0] if i + 1 < len(path) else path[i - 1][0]
        hint_lat = path[i + 1][1] if i + 1 < len(path) else path[i - 1][1]
        olon, olat = lon, lat
        if is_inside_terminal_exclusion(olon, olat, terminals, radius_km=radius_km):
            olon, olat = relocate_if_inside_exclusion(
                olon, olat, terminals, hint_lon, hint_lat, radius_km=radius_km
            )
        cleaned.append((olon, olat))
    return _dedupe_path_points(cleaned)


def _detour_waypoints(
    a: tuple[float, float],
    b: tuple[float, float],
    terminals: list[_TerminalLike],
    ignore: set[UUID],
    *,
    radius_km: float,
) -> list[tuple[float, float]]:
    """Waypoints from ``a`` to ``b`` (inclusive of ``b``) avoiding exclusion disks."""
    if not segment_penetrates_exclusion(
        a[0], a[1], b[0], b[1], terminals, ignore_ids=ignore, radius_km=radius_km
    ):
        return [b]
    blocker = _find_blocking_terminal_on_segment(
        a[0], a[1], b[0], b[1], terminals, ignore, radius_km=radius_km
    )
    if blocker is None:
        return [b]
    wide = _wide_via_outside_blocker(
        blocker, a, b, terminals, ignore, radius_km=radius_km
    )
    if not segment_penetrates_exclusion(
        a[0], a[1], wide[0], wide[1], terminals, ignore_ids=ignore, radius_km=radius_km
    ) and not segment_penetrates_exclusion(
        wide[0], wide[1], b[0], b[1], terminals, ignore_ids=ignore, radius_km=radius_km
    ):
        return [wide, b]
    via_a = exclusion_boundary_point(
        blocker.lon, blocker.lat, a[0], a[1], radius_km=radius_km
    )
    via_b = exclusion_boundary_point(
        blocker.lon, blocker.lat, b[0], b[1], radius_km=radius_km
    )
    return [via_a, wide, via_b, b]


def route_backbone_outside_exclusions(
    lon1: float,
    lat1: float,
    lon2: float,
    lat2: float,
    terminals: list[_TerminalLike],
    *,
    ignore_ids: set[UUID] | None = None,
    radius_km: float | None = None,
    max_via: int = 4,
) -> list[tuple[float, float]]:
    """Polyline from p1 to p2 with segments outside all exclusion zones."""
    radius_km = _exclusion_radius_km(radius_km)
    ignore = set(ignore_ids or ())
    path: list[tuple[float, float]] = [(lon1, lat1), (lon2, lat2)]

    def _path_clear(pts: list[tuple[float, float]]) -> bool:
        for i in range(len(pts) - 1):
            if segment_penetrates_exclusion(
                pts[i][0],
                pts[i][1],
                pts[i + 1][0],
                pts[i + 1][1],
                terminals,
                ignore_ids=ignore,
                radius_km=radius_km,
            ):
                return False
        return True

    if _path_clear(path):
        return sanitize_path_vertices(path, terminals, radius_km=radius_km)

    for _ in range(max_via * 3):
        new_pts: list[tuple[float, float]] = [path[0]]
        for i in range(len(path) - 1):
            a, b = path[i], path[i + 1]
            for wp in _detour_waypoints(a, b, terminals, ignore, radius_km=radius_km):
                if haversine_km(new_pts[-1][0], new_pts[-1][1], wp[0], wp[1]) > 0.005:
                    new_pts.append(wp)
        path = _dedupe_path_points(new_pts)
        if _path_clear(path):
            return sanitize_path_vertices(path, terminals, radius_km=radius_km)
    return sanitize_path_vertices(path, terminals, radius_km=radius_km)


def check_exclusion_zones_overlap(
    terminals: list[_TerminalLike],
    *,
    radius_km: float | None = None,
) -> list[str]:
    """Warnings when terminal pair distance < 2 * radius."""
    radius_km = _exclusion_radius_km(radius_km)
    warnings: list[str] = []
    min_pair = 2.0 * radius_km
    for i, a in enumerate(terminals):
        for b in terminals[i + 1 :]:
            d = haversine_km(a.lon, a.lat, b.lon, b.lat)
            if d < min_pair - 1e-9:
                warnings.append(f"exclusion_zones_overlap:{a.id},{b.id}")
    return warnings


def validate_planned_exclusion(
    lines: list[_PlannedLineLike],
    nodes: list[_PlannedNodeLike],
    terminals: list[_TerminalLike],
    *,
    radius_km: float | None = None,
) -> list[str]:
    """Return warning codes for link/junction geometry inside exclusion zones."""
    radius_km = _exclusion_radius_km(radius_km)
    warnings: list[str] = []
    for ln in lines:
        if ln.kind != "link" or len(ln.coordinates) < 2:
            continue
        for c in ln.coordinates:
            if is_inside_terminal_exclusion(c[0], c[1], terminals, radius_km=radius_km):
                warnings.append("exclusion_violation:link")
                break
    for nd in nodes:
        if is_inside_terminal_exclusion(nd.lon, nd.lat, terminals, radius_km=radius_km):
            warnings.append("exclusion_violation:node")
            break
    return warnings
