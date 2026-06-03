"""Stateless autoroad network planner (MST, spurs, intersections).

Connects all selected terminals: uses existing autoroad graph when that is the
shortest route; otherwise builds new straight ``autoroad`` segments (MST edges).
Each terminal gets at most one new autoroad with ``line_snap`` to the object.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from uuid import UUID

from app.geo.constants import NODE_CLUSTER_SUBTYPES
from app.services.autoroad_network.graph_from_polylines import (
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


@dataclass
class _SnapInfo:
    graph_node_id: UUID | None
    snap_lon: float | None
    snap_lat: float | None
    warning: str | None


def _coord_key(lon: float, lat: float) -> tuple[int, int]:
    return (round(lon * 1e5), round(lat * 1e5))


def _snap_terminal_to_network(
    lon: float,
    lat: float,
    g: RoadGraph,
    polylines: list[list[tuple[float, float]]],
    *,
    snap_tolerance_km: float,
) -> _SnapInfo:
    if not polylines:
        return _SnapInfo(None, None, None, "too_far_from_autoroad")

    on_poly = math.inf
    poly_snap: tuple[float, float] | None = None
    for pl in polylines:
        slon, slat, _ = closest_point_on_polyline_for_snap(lon, lat, pl)
        d = haversine_km(lon, lat, slon, slat)
        if d < on_poly:
            on_poly = d
            poly_snap = (slon, slat)

    if on_poly > snap_tolerance_km:
        return _SnapInfo(None, None, None, "too_far_from_autoroad")

    slon, slat = poly_snap if poly_snap else (lon, lat)
    best_nid: UUID | None = None
    best_d = math.inf
    for nid in g.adj:
        nc = g.coords.get(nid)
        if not nc:
            continue
        d = haversine_km(slon, slat, nc[0], nc[1])
        if d < best_d:
            best_d = d
            best_nid = nid
    if best_nid is None or best_d > snap_tolerance_km:
        return _SnapInfo(None, slon, slat, "no_graph_node")
    return _SnapInfo(best_nid, slon, slat, None)


def _needs_connector(obj_lon: float, obj_lat: float, snap_lon: float, snap_lat: float) -> bool:
    return haversine_km(obj_lon, obj_lat, snap_lon, snap_lat) > 0.02


def _pair_cost(
    ta: PlanTerminalInput,
    tb: PlanTerminalInput,
    sa: _SnapInfo,
    sb: _SnapInfo,
    graph_dist: dict[UUID, dict[UUID, float]],
    graph_prev: dict[UUID, dict[UUID, UUID | None]],
) -> tuple[float, str]:
    """Return (cost_km, route_mode) where mode is ``graph`` or ``direct``."""
    direct = haversine_km(ta.lon, ta.lat, tb.lon, tb.lat)
    if sa.graph_node_id and sb.graph_node_id:
        na, nb = sa.graph_node_id, sb.graph_node_id
        path_d = graph_dist.get(na, {}).get(nb, math.inf)
        if path_d < math.inf and path_d <= direct:
            return path_d, "graph"
    return direct, "direct"


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


def plan_from_request(req: NetworkPlanRequest) -> NetworkPlanResponse:
    opts = req.options
    snap_tol = opts.snap_tolerance_km
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

    g = build_graph_from_polylines(req.existing_autoroads)
    polylines = polylines_from_roads(req.existing_autoroads)
    if not g.adj and polylines:
        warnings.append("no_graph_edges_from_polylines")
    if not polylines:
        warnings.append("no_autoroad_polylines")

    terminal_by_id = {t.id: t for t in req.terminals}
    snap_by_id: dict[UUID, _SnapInfo] = {}
    terminal_results: list[PlanTerminalResult] = []

    for t in req.terminals:
        si = _snap_terminal_to_network(t.lon, t.lat, g, polylines, snap_tolerance_km=snap_tol)
        snap_by_id[t.id] = si
        terminal_results.append(
            PlanTerminalResult(
                id=t.id,
                name=t.name,
                warning=si.warning,
                snap_lon=si.snap_lon,
                snap_lat=si.snap_lat,
                graph_attached=si.graph_node_id is not None and si.warning is None,
                graph_node_id=str(si.graph_node_id) if si.graph_node_id else None,
            )
        )

    graph_node_ids = {si.graph_node_id for si in snap_by_id.values() if si.graph_node_id}
    graph_dist: dict[UUID, dict[UUID, float]] = {}
    graph_prev: dict[UUID, dict[UUID, UUID | None]] = {}
    for nid in graph_node_ids:
        d, prev = dijkstra_with_prev(g, nid)
        graph_dist[nid] = d
        graph_prev[nid] = prev

    terminal_ids = [t.id for t in req.terminals]
    dist_matrix: dict[UUID, dict[UUID, float]] = {}
    route_mode: dict[tuple[UUID, UUID], str] = {}

    for a in terminal_ids:
        dist_matrix[a] = {}
        ta = terminal_by_id[a]
        sa = snap_by_id[a]
        for b in terminal_ids:
            if a == b:
                dist_matrix[a][b] = 0.0
                continue
            cost, mode = _pair_cost(
                ta, terminal_by_id[b], sa, snap_by_id[b], graph_dist, graph_prev
            )
            dist_matrix[a][b] = cost
            route_mode[(a, b)] = mode
            route_mode[(b, a)] = mode

    mst_edges = mst_terminal_edges(terminal_ids, dist_matrix)

    new_lines: list[PlannedLineOut] = []
    total_km = 0.0
    used_edge_ids: set[str] = set()
    object_snaps_used: set[UUID] = set()

    two_off_network = len(req.terminals) == 2 and not polylines

    for a, b in mst_edges:
        mode = route_mode.get((a, b), "direct")
        ta = terminal_by_id[a]
        tb = terminal_by_id[b]
        if mode == "graph":
            na = snap_by_id[a].graph_node_id
            nb = snap_by_id[b].graph_node_id
            if na and nb:
                prev = graph_prev.get(na, {})
                for edge in shortest_path_edges(g, prev, na, nb):
                    used_edge_ids.add(str(edge.id))
        else:
            km = haversine_km(ta.lon, ta.lat, tb.lon, tb.lat)
            if two_off_network:
                new_lines.append(
                    PlannedLineOut(
                        kind="link",
                        coordinates=[[ta.lon, ta.lat], [tb.lon, tb.lat]],
                        snap_start_object_id=a,
                        snap_finish_object_id=b,
                    )
                )
                object_snaps_used.add(a)
                object_snaps_used.add(b)
            else:
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
            total_km += km

    for t in req.terminals:
        si = snap_by_id[t.id]
        if si.graph_node_id and si.snap_lon is not None and si.snap_lat is not None:
            if _needs_connector(t.lon, t.lat, si.snap_lon, si.snap_lat):
                if t.id not in object_snaps_used:
                    new_lines.append(
                        PlannedLineOut(
                            kind="connector",
                            coordinates=[[t.lon, t.lat], [si.snap_lon, si.snap_lat]],
                            snap_start_object_id=t.id,
                        )
                    )
                    object_snaps_used.add(t.id)
                    total_km += haversine_km(t.lon, t.lat, si.snap_lon, si.snap_lat)

    _validate_one_autoroad_per_object(new_lines, terminal_ids, warnings)

    new_nodes: list[PlannedNodeOut] = []
    splits: list[PlannedSplitOut] = []
    node_keys: set[tuple[int, int]] = set()

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
