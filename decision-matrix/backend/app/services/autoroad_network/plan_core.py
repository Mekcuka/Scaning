"""Stateless autoroad network planner.

When existing autoroad polylines are present, each terminal gets at most one
``connector`` (object → nearest point on the network). Connectivity between
terminals uses the existing graph; gaps between disconnected components are
filled with new ``link`` segments between network attachment points only (never
object ↔ object). Terminals already connected to the network are skipped.

Without polylines: two terminals → one ``link``; three or more → MST with
Steiner ``junction`` on each edge, path ``link`` between mids at degree-2
terminals, hub ``junction`` + star ``link`` at degree ≥3, collinear
simplify, bend-angle warnings (leaf-only terminals).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from uuid import UUID

from app.geo.constants import NODE_CLUSTER_SUBTYPES
from app.services.autoroad_network.graph_from_polylines import (
    _vertex_node_id,
    build_graph_from_polylines,
    polylines_from_roads,
)
from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    NetworkPlanResponse,
    PlannedLineOut,
    PlannedNodeOut,
    PlannedSplitOut,
    PlanTerminalInput,
    PlanTerminalResult,
)
from app.services.line_split import find_segment_intersections, is_near_line_endpoint
from app.services.road_graph import (
    LINE_SPLIT_ENDPOINT_MIN_KM,
    RoadGraph,
    closest_point_on_polyline_for_snap,
    dijkstra_with_prev,
    geodesic_midpoint,
    haversine_km,
    mst_terminal_edges,
    shortest_path_edges,
)
from app.services.spatial import closest_point_on_segment

CONNECTOR_MIN_KM = 0.02
ALREADY_CONNECTED_KM = 0.02
FAR_FROM_ROAD_INFO_KM = 0.3
ATTACH_PROJ_TOL_KM = LINE_SPLIT_ENDPOINT_MIN_KM


@dataclass
class _SnapInfo:
    graph_node_id: UUID | None
    snap_lon: float
    snap_lat: float
    snap_dist_km: float
    road_id: UUID | None
    warning: str | None
    already_connected: bool = False


def _coord_key(lon: float, lat: float) -> tuple[int, int]:
    return (round(lon * 1e5), round(lat * 1e5))


def _nearest_polyline_snap(
    lon: float,
    lat: float,
    polylines: list[list[tuple[float, float]]],
    road_ids: list[UUID],
) -> tuple[float, float, float, UUID | None]:
    best_d = math.inf
    best: tuple[float, float] = (lon, lat)
    best_road: UUID | None = None
    for pl, rid in zip(polylines, road_ids, strict=False):
        slon, slat, _ = closest_point_on_polyline_for_snap(lon, lat, pl)
        d = haversine_km(lon, lat, slon, slat)
        if d < best_d:
            best_d = d
            best = (slon, slat)
            best_road = rid
    return best[0], best[1], best_d, best_road


def _nearest_graph_node(
    g: RoadGraph,
    lon: float,
    lat: float,
    *,
    max_km: float,
) -> tuple[UUID | None, float]:
    best_id: UUID | None = None
    best_d = math.inf
    for nid in g.adj:
        nc = g.coords.get(nid)
        if not nc:
            continue
        d = haversine_km(lon, lat, nc[0], nc[1])
        if d < best_d:
            best_d = d
            best_id = nid
    if best_id is None or best_d > max_km:
        return None, best_d
    return best_id, best_d


def _terminal_already_connected(
    lon: float,
    lat: float,
    roads: list[ExistingAutoroadInput],
    *,
    tol_km: float = ALREADY_CONNECTED_KM,
) -> bool:
    for road in roads:
        coords = road.coordinates
        if len(coords) < 2:
            continue
        for pt in (coords[0], coords[-1]):
            if haversine_km(lon, lat, float(pt[0]), float(pt[1])) <= tol_km:
                return True
    return False


def _graph_components(g: RoadGraph) -> dict[UUID, int]:
    comp: dict[UUID, int] = {}
    next_id = 0
    for start in g.adj:
        if start in comp:
            continue
        stack = [start]
        comp[start] = next_id
        while stack:
            u = stack.pop()
            for v, _ in g.adj.get(u, []):
                if v not in comp:
                    comp[v] = next_id
                    stack.append(v)
        next_id += 1
    return comp


def _road_graph_component(
    g: RoadGraph,
    road_id: UUID | None,
    roads: list[ExistingAutoroadInput],
    node_comps: dict[UUID, int],
) -> int | None:
    if road_id is None:
        return None
    for road in roads:
        if road.id != road_id:
            continue
        coords = [(float(c[0]), float(c[1])) for c in road.coordinates if len(c) >= 2]
        if len(coords) < 2:
            return None
        for i in range(len(coords)):
            nid = _vertex_node_id(road.id, i)
            if nid in node_comps:
                return node_comps[nid]
    return None


def _snap_terminal(
    t: PlanTerminalInput,
    g: RoadGraph,
    polylines: list[list[tuple[float, float]]],
    road_ids: list[UUID],
    roads: list[ExistingAutoroadInput],
    *,
    snap_tolerance_km: float,
) -> _SnapInfo:
    already = _terminal_already_connected(t.lon, t.lat, roads)
    slon, slat, dist, road_id = _nearest_polyline_snap(t.lon, t.lat, polylines, road_ids)
    nid, _ = _nearest_graph_node(g, slon, slat, max_km=snap_tolerance_km)
    warning: str | None = None
    if already:
        warning = "already_connected"
    elif dist > FAR_FROM_ROAD_INFO_KM:
        warning = "far_from_autoroad"
    return _SnapInfo(
        graph_node_id=nid,
        snap_lon=slon,
        snap_lat=slat,
        snap_dist_km=dist,
        road_id=road_id,
        warning=warning,
        already_connected=already,
    )


def _needs_connector(obj_lon: float, obj_lat: float, snap_lon: float, snap_lat: float) -> bool:
    return haversine_km(obj_lon, obj_lat, snap_lon, snap_lat) > CONNECTOR_MIN_KM


def _object_snap_count(lines: list[PlannedLineOut], terminal_id: UUID) -> int:
    count = 0
    for ln in lines:
        if ln.snap_start_object_id == terminal_id or ln.snap_finish_object_id == terminal_id:
            count += 1
    return count


def _validate_one_autoroad_per_object(
    lines: list[PlannedLineOut], terminal_ids: list[UUID], warnings: list[str]
) -> None:
    for tid in terminal_ids:
        n = _object_snap_count(lines, tid)
        if n > 1:
            warnings.append(f"multiple_autoroad_connections:{tid}")


def _ensure_junction(
    lon: float,
    lat: float,
    new_nodes: list[PlannedNodeOut],
    node_keys: set[tuple[int, int]],
    *,
    reason: str = "junction",
) -> None:
    key = _coord_key(lon, lat)
    if key in node_keys:
        if reason == "hub_junction":
            for node in new_nodes:
                if _coord_key(node.lon, node.lat) == key:
                    node.reason = "hub_junction"
        return
    node_keys.add(key)
    new_nodes.append(PlannedNodeOut(lon=lon, lat=lat, reason=reason))


ACUTE_BEND_WARN_DEG = 150.0


def _unit_vector_from(
    lon0: float, lat0: float, lon1: float, lat1: float
) -> tuple[float, float] | None:
    cos_lat = math.cos(math.radians((lat0 + lat1) / 2.0))
    dx = (lon1 - lon0) * cos_lat
    dy = lat1 - lat0
    length = math.hypot(dx, dy)
    if length < 1e-12:
        return None
    return (dx / length, dy / length)


def _angle_between_deg(u: tuple[float, float], v: tuple[float, float]) -> float:
    dot = max(-1.0, min(1.0, u[0] * v[0] + u[1] * v[1]))
    return math.degrees(math.acos(dot))


def _min_bend_angle_at_junction(
    lon: float, lat: float, neighbors: list[tuple[float, float]],
) -> float | None:
    vectors: list[tuple[float, float]] = []
    for nlon, nlat in neighbors:
        vec = _unit_vector_from(lon, lat, nlon, nlat)
        if vec is not None:
            vectors.append(vec)
    if len(vectors) < 2:
        return None
    min_angle = 360.0
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            min_angle = min(min_angle, _angle_between_deg(vectors[i], vectors[j]))
    return min_angle


def _annotate_bend_angles(
    new_lines: list[PlannedLineOut],
    warnings: list[str],
) -> dict[tuple[int, int], float]:
    """Return min bend angle (deg) per junction coord; append acute_bend warnings."""
    junction_pos: dict[tuple[int, int], tuple[float, float]] = {}
    junction_neighbors: dict[tuple[int, int], list[tuple[float, float]]] = {}

    for ln in new_lines:
        if ln.kind != "link" or len(ln.coordinates) < 2:
            continue
        a = (ln.coordinates[0][0], ln.coordinates[0][1])
        b = (ln.coordinates[-1][0], ln.coordinates[-1][1])
        ck_a = _coord_key(a[0], a[1])
        ck_b = _coord_key(b[0], b[1])
        junction_pos[ck_a] = a
        junction_pos[ck_b] = b
        junction_neighbors.setdefault(ck_a, []).append(b)
        junction_neighbors.setdefault(ck_b, []).append(a)

    bend_by_ck: dict[tuple[int, int], float] = {}
    for ck, neighbors in junction_neighbors.items():
        if len(neighbors) < 2:
            continue
        jlon, jlat = junction_pos[ck]
        unique: list[tuple[float, float]] = []
        for n in neighbors:
            if all(haversine_km(n[0], n[1], u[0], u[1]) > 1e-6 for u in unique):
                unique.append(n)
        angle = _min_bend_angle_at_junction(jlon, jlat, unique)
        if angle is None:
            continue
        bend_by_ck[ck] = angle
        if angle < ACUTE_BEND_WARN_DEG:
            warnings.append(f"acute_bend_deg:{round(angle, 1)}")

    return bend_by_ck


def _edge_key(a: UUID, b: UUID) -> frozenset[UUID]:
    return frozenset((a, b))


def _geographic_midpoint(
    lon1: float, lat1: float, lon2: float, lat2: float
) -> tuple[float, float]:
    return geodesic_midpoint(lon1, lat1, lon2, lat2)


COLLINEAR_COS_TOL = math.cos(math.radians(2.5))


def _mid_link_pair_key(ek1: frozenset[UUID], ek2: frozenset[UUID]) -> tuple:
    return tuple(sorted((tuple(sorted(ek1)), tuple(sorted(ek2)))))


def _collinear_triple(
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
) -> bool:
    """True when p1–p2–p3 lie on one line (p2 between or on the same ray)."""
    cos_lat = math.cos(math.radians((p1[1] + p2[1] + p3[1]) / 3.0))
    ax, ay = (p1[0] - p2[0]) * cos_lat, p1[1] - p2[1]
    bx, by = (p3[0] - p2[0]) * cos_lat, p3[1] - p2[1]
    la = math.hypot(ax, ay)
    lb = math.hypot(bx, by)
    if la < 1e-12 or lb < 1e-12:
        return True
    dot = (ax * bx + ay * by) / (la * lb)
    return dot <= -COLLINEAR_COS_TOL


def _lines_total_km(lines: list[PlannedLineOut]) -> float:
    total = 0.0
    for ln in lines:
        if len(ln.coordinates) < 2:
            continue
        for i in range(len(ln.coordinates) - 1):
            a, b = ln.coordinates[i], ln.coordinates[i + 1]
            total += haversine_km(a[0], a[1], b[0], b[1])
    return total


def _emit_link(
    new_lines: list[PlannedLineOut],
    lon1: float,
    lat1: float,
    lon2: float,
    lat2: float,
) -> float:
    new_lines.append(
        PlannedLineOut(
            kind="link",
            coordinates=[[lon1, lat1], [lon2, lat2]],
        )
    )
    return haversine_km(lon1, lat1, lon2, lat2)


def _terminal_hub_point(
    mids: list[tuple[float, float]],
) -> tuple[float, float]:
    """Local junction near terminal: geometric median of incident edge midpoints."""
    return _hub_point_min_sum_distance(mids)


def _link_far_endpoint(
    ln: PlannedLineOut, near_ck: tuple[int, int]
) -> tuple[float, float]:
    a = (ln.coordinates[0][0], ln.coordinates[0][1])
    b = (ln.coordinates[-1][0], ln.coordinates[-1][1])
    if _coord_key(a[0], a[1]) == near_ck:
        return b
    return a


def _segment_param(
    lon: float,
    lat: float,
    a: tuple[float, float],
    b: tuple[float, float],
) -> float:
    cos_lat = math.cos(math.radians((a[1] + b[1]) / 2.0))
    ax = (lon - a[0]) * cos_lat
    ay = lat - a[1]
    bx = (b[0] - a[0]) * cos_lat
    by = b[1] - a[1]
    denom = bx * bx + by * by
    if denom < 1e-18:
        return 0.0
    return max(0.0, min(1.0, (ax * bx + ay * by) / denom))


def _interior_attachment_on_segment(
    plon: float,
    plat: float,
    a: tuple[float, float],
    b: tuple[float, float],
) -> tuple[float, float] | None:
    clon, clat = closest_point_on_segment(
        plon, plat, a[0], a[1], b[0], b[1]
    )
    if haversine_km(plon, plat, clon, clat) > ATTACH_PROJ_TOL_KM:
        return None
    if is_near_line_endpoint(clon, clat, [a, b], min_km=ATTACH_PROJ_TOL_KM):
        return None
    return (clon, clat)


def _rebuild_junction_nodes_from_lines(
    new_lines: list[PlannedLineOut],
    new_nodes: list[PlannedNodeOut],
    node_keys: set[tuple[int, int]],
    hub_positions: list[tuple[float, float]],
) -> None:
    new_nodes.clear()
    node_keys.clear()
    hub_ck = {_coord_key(h[0], h[1]) for h in hub_positions}
    for ln in new_lines:
        if ln.kind == "link" and len(ln.coordinates) >= 2:
            for pt in (ln.coordinates[0], ln.coordinates[-1]):
                ck = _coord_key(pt[0], pt[1])
                reason = "hub_junction" if ck in hub_ck else "junction"
                _ensure_junction(pt[0], pt[1], new_nodes, node_keys, reason=reason)
        elif ln.kind == "connector" and len(ln.coordinates) >= 2:
            pt = ln.coordinates[-1]
            ck = _coord_key(pt[0], pt[1])
            reason = "hub_junction" if ck in hub_ck else "junction"
            _ensure_junction(pt[0], pt[1], new_nodes, node_keys, reason=reason)


def _repair_planned_line_topology(
    new_lines: list[PlannedLineOut],
    new_nodes: list[PlannedNodeOut],
    node_keys: set[tuple[int, int]],
    *,
    hub_positions: list[tuple[float, float]] | None = None,
) -> None:
    """Split backbone links at T-attachments; ensure junction nodes at connector ends."""
    hubs = list(hub_positions or [])
    hub_ck = {_coord_key(h[0], h[1]) for h in hubs}
    for n in new_nodes:
        if n.reason == "hub_junction":
            ck = _coord_key(n.lon, n.lat)
            if ck not in hub_ck:
                hubs.append((n.lon, n.lat))
                hub_ck.add(ck)

    attach_pts: list[tuple[float, float]] = []
    for ln in new_lines:
        if len(ln.coordinates) < 2:
            continue
        a = (ln.coordinates[0][0], ln.coordinates[0][1])
        b = (ln.coordinates[-1][0], ln.coordinates[-1][1])
        if ln.kind == "connector":
            attach_pts.append(b)
        elif ln.kind == "link":
            attach_pts.extend([a, b])

    link_indices = [
        i
        for i, ln in enumerate(new_lines)
        if ln.kind == "link" and len(ln.coordinates) >= 2
    ]
    splits_by_idx: dict[int, dict[tuple[int, int], tuple[float, float]]] = {
        i: {} for i in link_indices
    }

    for plon, plat in attach_pts:
        for idx in link_indices:
            ln = new_lines[idx]
            a = (ln.coordinates[0][0], ln.coordinates[0][1])
            b = (ln.coordinates[-1][0], ln.coordinates[-1][1])
            hit = _interior_attachment_on_segment(plon, plat, a, b)
            if hit:
                splits_by_idx[idx][_coord_key(hit[0], hit[1])] = hit

    for ii, idx_a in enumerate(link_indices):
        ln_a = new_lines[idx_a]
        seg_a = (
            (ln_a.coordinates[0][0], ln_a.coordinates[0][1]),
            (ln_a.coordinates[-1][0], ln_a.coordinates[-1][1]),
        )
        for idx_b in link_indices[ii + 1 :]:
            ln_b = new_lines[idx_b]
            seg_b = (
                (ln_b.coordinates[0][0], ln_b.coordinates[0][1]),
                (ln_b.coordinates[-1][0], ln_b.coordinates[-1][1]),
            )
            hit = find_segment_intersections(seg_a, seg_b)
            if not hit:
                continue
            for idx, seg in ((idx_a, seg_a), (idx_b, seg_b)):
                if is_near_line_endpoint(
                    hit[0], hit[1], [seg[0], seg[1]], min_km=ATTACH_PROJ_TOL_KM
                ):
                    continue
                splits_by_idx[idx][_coord_key(hit[0], hit[1])] = hit

    replacements: dict[int, list[PlannedLineOut]] = {}
    for idx in link_indices:
        interior = list(splits_by_idx[idx].values())
        if not interior:
            continue
        ln = new_lines[idx]
        a = (ln.coordinates[0][0], ln.coordinates[0][1])
        b = (ln.coordinates[-1][0], ln.coordinates[-1][1])
        ordered = sorted(
            interior, key=lambda p: _segment_param(p[0], p[1], a, b)
        )
        chain: list[list[float]] = [
            [a[0], a[1]],
            *[[p[0], p[1]] for p in ordered],
            [b[0], b[1]],
        ]
        parts: list[PlannedLineOut] = []
        for k in range(len(chain) - 1):
            parts.append(
                PlannedLineOut(
                    kind="link",
                    coordinates=[chain[k], chain[k + 1]],
                    snap_start_object_id=ln.snap_start_object_id if k == 0 else None,
                    snap_finish_object_id=ln.snap_finish_object_id
                    if k == len(chain) - 2
                    else None,
                )
            )
        replacements[idx] = parts

    if replacements:
        rebuilt: list[PlannedLineOut] = []
        for i, ln in enumerate(new_lines):
            if i in replacements:
                rebuilt.extend(replacements[i])
            else:
                rebuilt.append(ln)
        new_lines[:] = rebuilt

    for ln in new_lines:
        if ln.kind != "connector" or len(ln.coordinates) < 2:
            continue
        end = ln.coordinates[-1]
        for oln in new_lines:
            if oln.kind != "link" or len(oln.coordinates) < 2:
                continue
            a = (oln.coordinates[0][0], oln.coordinates[0][1])
            b = (oln.coordinates[-1][0], oln.coordinates[-1][1])
            hit = _interior_attachment_on_segment(end[0], end[1], a, b)
            if hit:
                ln.coordinates[-1] = [hit[0], hit[1]]
                break
            clon, clat = closest_point_on_segment(
                end[0], end[1], a[0], a[1], b[0], b[1]
            )
            if haversine_km(end[0], end[1], clon, clat) <= ATTACH_PROJ_TOL_KM:
                ln.coordinates[-1] = [clon, clat]
                break

    _rebuild_junction_nodes_from_lines(new_lines, new_nodes, node_keys, hubs)


def _simplify_collinear_backbone(
    new_lines: list[PlannedLineOut],
    new_nodes: list[PlannedNodeOut],
    node_keys: set[tuple[int, int]],
    terminal_by_id: dict[UUID, PlanTerminalInput],
    terminal_ids: list[UUID],
    terminal_edges: dict[UUID, list[frozenset[UUID]]],
    edge_mid: dict[frozenset[UUID], tuple[float, float]],
    hub_terminal_ids: set[UUID] | None = None,
    hub_positions: list[tuple[float, float]] | None = None,
) -> None:
    """Merge collinear link chains and shorten connectors via backbone projection."""
    hub_ids = hub_terminal_ids or set()
    hubs = hub_positions or []
    while True:
        adj: dict[tuple[int, int], list[tuple[tuple[int, int], int]]] = {}
        mid_coords: dict[tuple[int, int], tuple[float, float]] = {}
        for idx, ln in enumerate(new_lines):
            if ln.kind != "link" or len(ln.coordinates) < 2:
                continue
            ck_a = _coord_key(ln.coordinates[0][0], ln.coordinates[0][1])
            ck_b = _coord_key(ln.coordinates[-1][0], ln.coordinates[-1][1])
            mid_coords[ck_a] = (ln.coordinates[0][0], ln.coordinates[0][1])
            mid_coords[ck_b] = (ln.coordinates[-1][0], ln.coordinates[-1][1])
            adj.setdefault(ck_a, []).append((ck_b, idx))
            adj.setdefault(ck_b, []).append((ck_a, idx))

        merged = False
        for mid_ck, neighbors in adj.items():
            if len(neighbors) != 2:
                continue
            (n1, i1), (n2, i2) = neighbors
            if i1 == i2:
                continue
            ln1, ln2 = new_lines[i1], new_lines[i2]
            mid_pt = mid_coords[mid_ck]
            far1 = _link_far_endpoint(ln1, mid_ck)
            far2 = _link_far_endpoint(ln2, mid_ck)
            if not _collinear_triple(far1, mid_pt, far2):
                continue
            new_lines[i1] = PlannedLineOut(
                kind="link",
                coordinates=[[far1[0], far1[1]], [far2[0], far2[1]]],
            )
            new_lines[i2] = PlannedLineOut(kind="link", coordinates=[])
            merged = True
            break

        if not merged:
            break

    new_lines[:] = [ln for ln in new_lines if ln.kind != "link" or len(ln.coordinates) >= 2]

    for tid in terminal_ids:
        keys = terminal_edges[tid]
        if len(keys) < 2:
            continue
        if tid in hub_ids:
            continue
        t = terminal_by_id[tid]
        mids = [edge_mid[ek] for ek in keys]
        if len(mids) >= 2 and all(
            _collinear_triple(mids[0], mids[i], mids[-1]) for i in range(1, len(mids))
        ):
            cos_lat = math.cos(math.radians((mids[0][1] + mids[-1][1]) / 2.0))
            ux = (mids[-1][0] - mids[0][0]) * cos_lat
            uy = mids[-1][1] - mids[0][1]
            ul = math.hypot(ux, uy) or 1.0
            ux, uy = ux / ul, uy / ul
            ordered = sorted(
                mids,
                key=lambda m: (m[0] - mids[0][0]) * ux + (m[1] - mids[0][1]) * uy,
            )
            first, last = ordered[0], ordered[-1]
            plon, plat = closest_point_on_segment(
                t.lon, t.lat, first[0], first[1], last[0], last[1]
            )
        else:
            plon, plat = min(
                mids,
                key=lambda m: haversine_km(t.lon, t.lat, m[0], m[1]),
            )

        for ln in new_lines:
            if ln.kind != "connector" or ln.snap_start_object_id != tid:
                continue
            if len(ln.coordinates) < 2:
                continue
            ln.coordinates = [[t.lon, t.lat], [plon, plat]]
            break

    _repair_planned_line_topology(
        new_lines, new_nodes, node_keys, hub_positions=hubs
    )


def _hub_point_min_sum_distance(
    points: list[tuple[float, float]],
    *,
    max_iter: int = 64,
    tol_km: float = 1e-6,
) -> tuple[float, float]:
    """Weiszfeld hub: minimizes sum of haversine distances to all points."""
    if not points:
        return (0.0, 0.0)
    if len(points) == 1:
        return points[0]

    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    for _ in range(max_iter):
        num_lon = 0.0
        num_lat = 0.0
        denom = 0.0
        for plon, plat in points:
            d = haversine_km(lon, lat, plon, plat)
            if d < 1e-9:
                return (plon, plat)
            w = 1.0 / d
            num_lon += w * plon
            num_lat += w * plat
            denom += w
        if denom <= 0:
            break
        new_lon = num_lon / denom
        new_lat = num_lat / denom
        shift = haversine_km(lon, lat, new_lon, new_lat)
        lon, lat = new_lon, new_lat
        if shift < tol_km:
            break
    return (lon, lat)


def _validate_terminal_connectivity(
    terminal_ids: list[UUID],
    lonlat_by_id: dict[UUID, tuple[float, float]],
    lines: list[PlannedLineOut],
    warnings: list[str],
    *,
    terminal_comp: dict[UUID, int] | None = None,
) -> None:
    if len(terminal_ids) < 2:
        return

    parent: dict[str, str] = {}

    def _k_tid(tid: UUID) -> str:
        return f"t:{tid}"

    def _k_coord(lon: float, lat: float) -> str:
        ck = _coord_key(lon, lat)
        return f"c:{ck[0]}:{ck[1]}"

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for tid in terminal_ids:
        lon, lat = lonlat_by_id[tid]
        parent[_k_tid(tid)] = _k_tid(tid)
        ck = _k_coord(lon, lat)
        parent[ck] = ck
        union(_k_tid(tid), ck)

    if terminal_comp:
        by_comp: dict[int, list[UUID]] = {}
        for tid in terminal_ids:
            by_comp.setdefault(terminal_comp[tid], []).append(tid)
        for group in by_comp.values():
            for other in group[1:]:
                union(_k_tid(group[0]), _k_tid(other))

    for ln in lines:
        if len(ln.coordinates) < 2:
            continue
        items: list[str] = [
            _k_coord(ln.coordinates[0][0], ln.coordinates[0][1]),
            _k_coord(ln.coordinates[-1][0], ln.coordinates[-1][1]),
        ]
        for ck in items:
            parent.setdefault(ck, ck)
        if ln.snap_start_object_id and ln.snap_start_object_id in lonlat_by_id:
            items.append(_k_tid(ln.snap_start_object_id))
        if ln.snap_finish_object_id and ln.snap_finish_object_id in lonlat_by_id:
            items.append(_k_tid(ln.snap_finish_object_id))
        for other in items[1:]:
            union(items[0], other)

    for ln in lines:
        if ln.kind != "connector" or len(ln.coordinates) < 2:
            continue
        plon, plat = ln.coordinates[-1][0], ln.coordinates[-1][1]
        pk = _k_coord(plon, plat)
        parent.setdefault(pk, pk)
        if ln.snap_start_object_id and ln.snap_start_object_id in lonlat_by_id:
            union(pk, _k_tid(ln.snap_start_object_id))
        for other in lines:
            if other.kind != "link" or len(other.coordinates) < 2:
                continue
            a, b = other.coordinates[0], other.coordinates[-1]
            clon, clat = closest_point_on_segment(
                plon, plat, a[0], a[1], b[0], b[1]
            )
            if haversine_km(plon, plat, clon, clat) > 0.01:
                continue
            union(pk, _k_coord(a[0], a[1]))
            union(pk, _k_coord(b[0], b[1]))

    roots = {find(_k_tid(tid)) for tid in terminal_ids}
    if len(roots) > 1:
        warnings.append("terminals_not_connected")


def _mst_component_edges(
    comp_ids: list[int],
    rep_point: dict[int, tuple[float, float]],
) -> list[tuple[int, int]]:
    if len(comp_ids) < 2:
        return []

    parent = {c: c for c in comp_ids}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    edges: list[tuple[int, int, float]] = []
    for i, a in enumerate(comp_ids):
        pa = rep_point[a]
        for b in comp_ids[i + 1 :]:
            pb = rep_point[b]
            edges.append((a, b, haversine_km(pa[0], pa[1], pb[0], pb[1])))
    edges.sort(key=lambda e: e[2])
    mst: list[tuple[int, int]] = []
    for a, b, _ in edges:
        if find(a) != find(b):
            union(a, b)
            mst.append((a, b))
    return mst


def _plan_off_network_steiner_mst(
    req: NetworkPlanRequest,
    terminal_by_id: dict[UUID, PlanTerminalInput],
    terminal_ids: list[UUID],
    new_lines: list[PlannedLineOut],
    new_nodes: list[PlannedNodeOut],
    node_keys: set[tuple[int, int]],
    warnings: list[str],
) -> float:
    """MST on terminals; junction at each edge midpoint; leaf connectors only."""
    dist_matrix: dict[UUID, dict[UUID, float]] = {}
    for a in terminal_ids:
        dist_matrix[a] = {}
        ta = terminal_by_id[a]
        for b in terminal_ids:
            if a == b:
                dist_matrix[a][b] = 0.0
            else:
                tb = terminal_by_id[b]
                dist_matrix[a][b] = haversine_km(ta.lon, ta.lat, tb.lon, tb.lat)

    mst_edges = mst_terminal_edges(terminal_ids, dist_matrix)
    edge_mid: dict[frozenset[UUID], tuple[float, float]] = {}
    terminal_edges: dict[UUID, list[frozenset[UUID]]] = {tid: [] for tid in terminal_ids}
    total_km = 0.0

    for a, b in mst_edges:
        ek = _edge_key(a, b)
        ta, tb = terminal_by_id[a], terminal_by_id[b]
        mlon, mlat = _geographic_midpoint(ta.lon, ta.lat, tb.lon, tb.lat)
        edge_mid[ek] = (mlon, mlat)
        _ensure_junction(mlon, mlat, new_nodes, node_keys)
        terminal_edges[a].append(ek)
        terminal_edges[b].append(ek)

    seen_mid_links: set[tuple] = set()
    hub_terminal_ids: set[UUID] = {
        tid for tid in terminal_ids if len(terminal_edges.get(tid, [])) >= 3
    }
    hub_positions: list[tuple[float, float]] = []

    for tid in terminal_ids:
        t = terminal_by_id[tid]
        keys = terminal_edges[tid]
        if not keys:
            continue

        if len(keys) == 1:
            m = edge_mid[keys[0]]
            total_km += haversine_km(t.lon, t.lat, m[0], m[1])
            new_lines.append(
                PlannedLineOut(
                    kind="connector",
                    coordinates=[[t.lon, t.lat], [m[0], m[1]]],
                    snap_start_object_id=tid,
                )
            )
        elif len(keys) == 2:
            ek1, ek2 = keys[0], keys[1]
            m1, m2 = edge_mid[ek1], edge_mid[ek2]
            pair = _mid_link_pair_key(ek1, ek2)
            if pair not in seen_mid_links:
                seen_mid_links.add(pair)
                total_km += _emit_link(
                    new_lines, m1[0], m1[1], m2[0], m2[1]
                )
            plon, plat = closest_point_on_segment(
                t.lon, t.lat, m1[0], m1[1], m2[0], m2[1]
            )
            total_km += haversine_km(t.lon, t.lat, plon, plat)
            new_lines.append(
                PlannedLineOut(
                    kind="connector",
                    coordinates=[[t.lon, t.lat], [plon, plat]],
                    snap_start_object_id=tid,
                )
            )
        else:
            mids = [edge_mid[ek] for ek in keys]
            hlon, hlat = _terminal_hub_point(mids)
            hub_positions.append((hlon, hlat))
            _ensure_junction(hlon, hlat, new_nodes, node_keys, reason="hub_junction")
            total_km += haversine_km(t.lon, t.lat, hlon, hlat)
            new_lines.append(
                PlannedLineOut(
                    kind="connector",
                    coordinates=[[t.lon, t.lat], [hlon, hlat]],
                    snap_start_object_id=tid,
                )
            )
            for ek in keys:
                mlon, mlat = edge_mid[ek]
                total_km += _emit_link(new_lines, hlon, hlat, mlon, mlat)

    _simplify_collinear_backbone(
        new_lines,
        new_nodes,
        node_keys,
        terminal_by_id,
        terminal_ids,
        terminal_edges,
        edge_mid,
        hub_terminal_ids,
        hub_positions,
    )
    return _lines_total_km(new_lines)


def _plan_off_network(req: NetworkPlanRequest, warnings: list[str]) -> NetworkPlanResponse:
    terminal_by_id = {t.id: t for t in req.terminals}
    terminal_ids = [t.id for t in req.terminals]
    lonlat_by_id = {t.id: (t.lon, t.lat) for t in req.terminals}
    new_lines: list[PlannedLineOut] = []
    new_nodes: list[PlannedNodeOut] = []
    node_keys: set[tuple[int, int]] = set()
    total_km = 0.0

    if len(terminal_ids) == 2:
        a, b = terminal_ids[0], terminal_ids[1]
        ta, tb = terminal_by_id[a], terminal_by_id[b]
        km = haversine_km(ta.lon, ta.lat, tb.lon, tb.lat)
        new_lines.append(
            PlannedLineOut(
                kind="link",
                coordinates=[[ta.lon, ta.lat], [tb.lon, tb.lat]],
                snap_start_object_id=a,
                snap_finish_object_id=b,
            )
        )
        total_km += km
    else:
        total_km += _plan_off_network_steiner_mst(
            req,
            terminal_by_id,
            terminal_ids,
            new_lines,
            new_nodes,
            node_keys,
            warnings,
        )

    terminal_results = [
        PlanTerminalResult(
            id=t.id,
            name=t.name,
            warning=None,
            snap_lon=None,
            snap_lat=None,
            graph_attached=False,
            graph_node_id=None,
        )
        for t in req.terminals
    ]
    _validate_one_autoroad_per_object(new_lines, terminal_ids, warnings)
    _repair_planned_line_topology(new_lines, new_nodes, node_keys)
    _validate_terminal_connectivity(terminal_ids, lonlat_by_id, new_lines, warnings)
    return _finalize_response(
        req,
        terminal_results,
        new_lines,
        new_nodes,
        [],
        set(),
        total_km,
        warnings,
    )


def _plan_with_network(
    req: NetworkPlanRequest,
    g: RoadGraph,
    polylines: list[list[tuple[float, float]]],
    warnings: list[str],
) -> NetworkPlanResponse:
    opts = req.options
    snap_tol = opts.snap_tolerance_km
    road_ids = [r.id for r in req.existing_autoroads]

    terminal_by_id = {t.id: t for t in req.terminals}
    terminal_ids = [t.id for t in req.terminals]
    snap_by_id: dict[UUID, _SnapInfo] = {}
    terminal_results: list[PlanTerminalResult] = []

    for t in req.terminals:
        si = _snap_terminal(
            t, g, polylines, road_ids, req.existing_autoroads, snap_tolerance_km=snap_tol
        )
        snap_by_id[t.id] = si
        terminal_results.append(
            PlanTerminalResult(
                id=t.id,
                name=t.name,
                warning=si.warning,
                snap_lon=si.snap_lon,
                snap_lat=si.snap_lat,
                graph_attached=si.graph_node_id is not None and not si.already_connected,
                graph_node_id=str(si.graph_node_id) if si.graph_node_id else None,
            )
        )

    node_comps = _graph_components(g)
    terminal_comp: dict[UUID, int] = {}
    rep_point: dict[int, tuple[float, float]] = {}
    virtual_comp = max(node_comps.values(), default=-1) + 1

    for t in req.terminals:
        si = snap_by_id[t.id]
        comp: int | None = None
        if si.graph_node_id is not None and si.graph_node_id in node_comps:
            comp = node_comps[si.graph_node_id]
        else:
            comp = _road_graph_component(g, si.road_id, req.existing_autoroads, node_comps)
        if comp is None:
            comp = virtual_comp
            virtual_comp += 1
        terminal_comp[t.id] = comp
        if comp not in rep_point:
            rep_point[comp] = (si.snap_lon, si.snap_lat)

    new_lines: list[PlannedLineOut] = []
    new_nodes: list[PlannedNodeOut] = []
    node_keys: set[tuple[int, int]] = set()
    total_km = 0.0
    used_edge_ids: set[str] = set()
    object_snaps_used: set[UUID] = set()

    for t in req.terminals:
        si = snap_by_id[t.id]
        if si.already_connected:
            continue
        if not _needs_connector(t.lon, t.lat, si.snap_lon, si.snap_lat):
            continue
        if t.id in object_snaps_used:
            continue
        _ensure_junction(si.snap_lon, si.snap_lat, new_nodes, node_keys)
        new_lines.append(
            PlannedLineOut(
                kind="connector",
                coordinates=[[t.lon, t.lat], [si.snap_lon, si.snap_lat]],
                snap_start_object_id=t.id,
            )
        )
        object_snaps_used.add(t.id)
        total_km += haversine_km(t.lon, t.lat, si.snap_lon, si.snap_lat)

    unique_comps = sorted(set(terminal_comp.values()))
    comp_mst = _mst_component_edges(unique_comps, rep_point)
    for c1, c2 in comp_mst:
        p1 = rep_point[c1]
        p2 = rep_point[c2]
        _ensure_junction(p1[0], p1[1], new_nodes, node_keys)
        _ensure_junction(p2[0], p2[1], new_nodes, node_keys)
        new_lines.append(
            PlannedLineOut(
                kind="link",
                coordinates=[[p1[0], p1[1]], [p2[0], p2[1]]],
            )
        )
        total_km += haversine_km(p1[0], p1[1], p2[0], p2[1])

    graph_node_ids = {si.graph_node_id for si in snap_by_id.values() if si.graph_node_id}
    graph_prev: dict[UUID, dict[UUID, UUID | None]] = {}
    for nid in graph_node_ids:
        _, prev = dijkstra_with_prev(g, nid)
        graph_prev[nid] = prev

    comps_with_nodes: dict[int, list[UUID]] = {}
    for tid in terminal_ids:
        si = snap_by_id[tid]
        if si.graph_node_id is None:
            continue
        comps_with_nodes.setdefault(terminal_comp[tid], []).append(si.graph_node_id)

    for nodes in comps_with_nodes.values():
        unique_nodes = list(dict.fromkeys(nodes))
        if len(unique_nodes) < 2:
            continue
        na = unique_nodes[0]
        prev = graph_prev.get(na, {})
        for nb in unique_nodes[1:]:
            for edge in shortest_path_edges(g, prev, na, nb):
                used_edge_ids.add(str(edge.id))

    _validate_one_autoroad_per_object(new_lines, terminal_ids, warnings)
    _repair_planned_line_topology(new_lines, new_nodes, node_keys)
    lonlat_by_id = {t.id: (t.lon, t.lat) for t in req.terminals}
    _validate_terminal_connectivity(
        terminal_ids,
        lonlat_by_id,
        new_lines,
        warnings,
        terminal_comp=terminal_comp,
    )
    splits = _collect_splits(req, new_lines, new_nodes, node_keys)
    return _finalize_response(
        req,
        terminal_results,
        new_lines,
        new_nodes,
        splits,
        used_edge_ids,
        total_km,
        warnings,
    )


def _collect_splits(
    req: NetworkPlanRequest,
    new_lines: list[PlannedLineOut],
    new_nodes: list[PlannedNodeOut],
    node_keys: set[tuple[int, int]],
) -> list[PlannedSplitOut]:
    splits: list[PlannedSplitOut] = []
    for pl in new_lines:
        if len(pl.coordinates) < 2:
            continue
        seg = (
            (pl.coordinates[0][0], pl.coordinates[0][1]),
            (pl.coordinates[1][0], pl.coordinates[1][1]),
        )
        for road in req.existing_autoroads:
            rcoords = [(float(c[0]), float(c[1])) for c in road.coordinates if len(c) >= 2]
            for i in range(len(rcoords) - 1):
                rseg = (rcoords[i], rcoords[i + 1])
                hit = find_segment_intersections(seg, rseg)
                if not hit:
                    continue
                ix, iy = hit
                if is_near_line_endpoint(ix, iy, rcoords):
                    continue
                splits.append(
                    PlannedSplitOut(
                        line_id=road.id,
                        segment_index=i,
                        split_lon=ix,
                        split_lat=iy,
                    )
                )
                key = _coord_key(ix, iy)
                if key not in node_keys:
                    node_keys.add(key)
                    new_nodes.append(PlannedNodeOut(lon=ix, lat=iy, reason="intersection"))
    return splits


def _finalize_response(
    req: NetworkPlanRequest,
    terminal_results: list[PlanTerminalResult],
    new_lines: list[PlannedLineOut],
    new_nodes: list[PlannedNodeOut],
    splits: list[PlannedSplitOut],
    used_edge_ids: set[str],
    total_km: float,
    warnings: list[str],
) -> NetworkPlanResponse:
    preview_features: list[dict] = []
    for ln in new_lines:
        preview_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": ln.coordinates},
                "properties": {"kind": ln.kind},
            }
        )
    bend_by_ck = _annotate_bend_angles(new_lines, warnings)
    for nd in new_nodes:
        props: dict = {"reason": nd.reason}
        if nd.reason == "hub_junction":
            props["hub_junction"] = True
        ck = _coord_key(nd.lon, nd.lat)
        if ck in bend_by_ck:
            props["bend_angle_deg"] = round(bend_by_ck[ck], 1)
        preview_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [nd.lon, nd.lat]},
                "properties": props,
            }
        )

    return NetworkPlanResponse(
        terminals=terminal_results,
        new_lines=new_lines,
        new_nodes=new_nodes,
        splits=splits,
        used_existing_edge_ids=sorted(used_edge_ids),
        total_new_km=round(total_km, 3),
        warnings=warnings,
        preview={"type": "FeatureCollection", "features": preview_features},
        new_line_count=len(new_lines),
        new_node_count=len(new_nodes),
        split_count=len(splits),
    )


def plan_from_request(req: NetworkPlanRequest) -> NetworkPlanResponse:
    opts = req.options
    max_n = opts.max_terminals

    warnings: list[str] = []
    if len(req.terminals) < 2:
        warnings.append("need_at_least_two_terminals")
        return NetworkPlanResponse(warnings=warnings)
    if len(req.terminals) > max_n:
        warnings.append(f"too_many_terminals_max_{max_n}")
        return NetworkPlanResponse(warnings=warnings)

    for t in req.terminals:
        if t.subtype in NODE_CLUSTER_SUBTYPES:
            warnings.append(f"excluded_terminal_subtype:{t.subtype}")
            return NetworkPlanResponse(warnings=warnings)

    polylines = polylines_from_roads(req.existing_autoroads)
    if not polylines:
        warnings.append("no_autoroad_polylines")
        return _plan_off_network(req, warnings)

    g = build_graph_from_polylines(req.existing_autoroads)
    if not g.adj:
        warnings.append("no_graph_edges_from_polylines")

    return _plan_with_network(req, g, polylines, warnings)
