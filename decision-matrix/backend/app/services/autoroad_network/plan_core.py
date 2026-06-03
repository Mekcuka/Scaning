"""Stateless autoroad network planner (MST, access nodes, intersections).

Topology: facility → access node (~50 m) → autoroad network → access node → facility.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from uuid import UUID

from app.geo.constants import NODE_CLUSTER_SUBTYPES
from app.services.autoroad_network.access_nodes import access_node_coordinates
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


def _needs_spur(access_lon: float, access_lat: float, snap_lon: float, snap_lat: float) -> bool:
    return haversine_km(access_lon, access_lat, snap_lon, snap_lat) > 0.02


def _pair_cost(
    access_a: tuple[float, float],
    access_b: tuple[float, float],
    sa: _SnapInfo,
    sb: _SnapInfo,
    graph_dist: dict[UUID, dict[UUID, float]],
    graph_prev: dict[UUID, dict[UUID, UUID | None]],
) -> tuple[float, str]:
    """Return (cost_km, route_mode) where mode is ``graph`` or ``direct``."""
    direct = haversine_km(access_a[0], access_a[1], access_b[0], access_b[1])
    if sa.graph_node_id and sb.graph_node_id:
        na, nb = sa.graph_node_id, sb.graph_node_id
        path_d = graph_dist.get(na, {}).get(nb, math.inf)
        if path_d < math.inf:
            return min(path_d, direct), "graph"
    return direct, "direct"


def plan_from_request(req: NetworkPlanRequest) -> NetworkPlanResponse:
    opts = req.options
    snap_tol = opts.snap_tolerance_km
    access_offset = opts.access_node_offset_km
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
    access_by_id: dict[UUID, tuple[float, float]] = {}
    terminal_results: list[PlanTerminalResult] = []
    new_nodes: list[PlannedNodeOut] = []

    for t in req.terminals:
        si = _snap_terminal_to_network(t.lon, t.lat, g, polylines, snap_tolerance_km=snap_tol)
        snap_by_id[t.id] = si
        others = [o for o in req.terminals if o.id != t.id]
        alon, alat = access_node_coordinates(
            t,
            snap_lon=si.snap_lon,
            snap_lat=si.snap_lat,
            other_terminals=others,
            offset_km=access_offset,
        )
        access_by_id[t.id] = (alon, alat)
        new_nodes.append(
            PlannedNodeOut(
                lon=alon,
                lat=alat,
                reason="terminal_access",
                terminal_id=t.id,
            )
        )
        terminal_results.append(
            PlanTerminalResult(
                id=t.id,
                name=t.name,
                warning=si.warning,
                snap_lon=si.snap_lon,
                snap_lat=si.snap_lat,
                access_lon=alon,
                access_lat=alat,
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
        sa = snap_by_id[a]
        access_a = access_by_id[a]
        for b in terminal_ids:
            if a == b:
                dist_matrix[a][b] = 0.0
                continue
            cost, mode = _pair_cost(
                access_a,
                access_by_id[b],
                sa,
                snap_by_id[b],
                graph_dist,
                graph_prev,
            )
            dist_matrix[a][b] = cost
            route_mode[(a, b)] = mode
            route_mode[(b, a)] = mode

    mst_edges = mst_terminal_edges(terminal_ids, dist_matrix)

    new_lines: list[PlannedLineOut] = []
    total_km = 0.0
    used_edge_ids: set[str] = set()

    for a, b in mst_edges:
        mode = route_mode.get((a, b), "direct")
        if mode == "graph":
            na = snap_by_id[a].graph_node_id
            nb = snap_by_id[b].graph_node_id
            if na and nb:
                prev = graph_prev.get(na, {})
                for edge in shortest_path_edges(g, prev, na, nb):
                    used_edge_ids.add(str(edge.id))
        else:
            aa = access_by_id[a]
            ab = access_by_id[b]
            km = haversine_km(aa[0], aa[1], ab[0], ab[1])
            new_lines.append(
                PlannedLineOut(
                    kind="link",
                    coordinates=[[aa[0], aa[1]], [ab[0], ab[1]]],
                    snap_start_terminal_id=a,
                    snap_finish_terminal_id=b,
                )
            )
            total_km += km

    for t in req.terminals:
        si = snap_by_id[t.id]
        alon, alat = access_by_id[t.id]
        km_obj = haversine_km(t.lon, t.lat, alon, alat)
        new_lines.append(
            PlannedLineOut(
                kind="connector",
                coordinates=[[t.lon, t.lat], [alon, alat]],
                snap_start_object_id=t.id,
                snap_finish_terminal_id=t.id,
            )
        )
        total_km += km_obj

        if si.snap_lon is not None and si.snap_lat is not None:
            if _needs_spur(alon, alat, si.snap_lon, si.snap_lat):
                new_lines.append(
                    PlannedLineOut(
                        kind="network_tie",
                        coordinates=[[alon, alat], [si.snap_lon, si.snap_lat]],
                        snap_start_terminal_id=t.id,
                    )
                )
                total_km += haversine_km(alon, alat, si.snap_lon, si.snap_lat)

    splits: list[PlannedSplitOut] = []
    node_keys: set[tuple[int, int]] = {_coord_key(n.lon, n.lat) for n in new_nodes}

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
                "properties": {
                    "reason": nd.reason,
                    "terminal_id": str(nd.terminal_id) if nd.terminal_id else None,
                },
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
