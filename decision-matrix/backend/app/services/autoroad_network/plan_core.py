"""Stateless autoroad network planner.

When existing autoroad polylines are present, each terminal gets at most one
``connector`` (object → nearest point on the network). Connectivity between
terminals uses the existing graph; gaps between disconnected components are
filled with new ``link`` segments between network attachment points only (never
object ↔ object). Terminals already connected to the network are skipped.

Without polylines: MST of straight ``link`` segments between terminal coords
(two terminals → one shared link).
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
    RoadGraph,
    closest_point_on_polyline_for_snap,
    dijkstra_with_prev,
    haversine_km,
    mst_terminal_edges,
    shortest_path_edges,
)

CONNECTOR_MIN_KM = 0.02
ALREADY_CONNECTED_KM = 0.02
FAR_FROM_ROAD_INFO_KM = 0.3


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
) -> None:
    key = _coord_key(lon, lat)
    if key in node_keys:
        return
    node_keys.add(key)
    new_nodes.append(PlannedNodeOut(lon=lon, lat=lat, reason="junction"))


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


def _plan_off_network(req: NetworkPlanRequest, warnings: list[str]) -> NetworkPlanResponse:
    terminal_by_id = {t.id: t for t in req.terminals}
    terminal_ids = [t.id for t in req.terminals]
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
    new_lines: list[PlannedLineOut] = []
    total_km = 0.0
    object_snaps_used: set[UUID] = set()

    if len(terminal_ids) == 2 and len(mst_edges) == 1:
        a, b = mst_edges[0]
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
        for a, b in mst_edges:
            ta, tb = terminal_by_id[a], terminal_by_id[b]
            snap_a = a not in object_snaps_used
            snap_b = b not in object_snaps_used
            new_lines.append(
                PlannedLineOut(
                    kind="link",
                    coordinates=[[ta.lon, ta.lat], [tb.lon, tb.lat]],
                    snap_start_object_id=a if snap_a else None,
                    snap_finish_object_id=b if snap_b else None,
                )
            )
            if snap_a:
                object_snaps_used.add(a)
            if snap_b:
                object_snaps_used.add(b)
            total_km += haversine_km(ta.lon, ta.lat, tb.lon, tb.lat)

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
    return _finalize_response(
        req,
        terminal_results,
        new_lines,
        [],
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
    for nd in new_nodes:
        preview_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [nd.lon, nd.lat]},
                "properties": {"reason": nd.reason},
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
