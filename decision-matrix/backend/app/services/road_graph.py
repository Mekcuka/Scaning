"""Autoroad network graph: Dijkstra, snap, MST (shared by sand logistics and autoroad-connect)."""

from __future__ import annotations

import heapq
import math
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from app.geo.entry_date import is_in_service, read_entry_date
from app.models import InfrastructureEdge, InfrastructureNode, InfrastructureObject
from app.services.line_endpoint_rules import ENDPOINT_SNAP_TOLERANCE_KM
from app.services.spatial import closest_point_on_segment, haversine_km, line_coords_from_object

LINE_SPLIT_ENDPOINT_MIN_KM = 0.01


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class RoadGraph:
    adj: dict[UUID, list[tuple[UUID, float]]] = field(default_factory=dict)
    coords: dict[UUID, tuple[float, float]] = field(default_factory=dict)
    edge_by_pair: dict[tuple[UUID, UUID], InfrastructureEdge] = field(default_factory=dict)


def add_undirected_edge(
    g: RoadGraph,
    a: UUID,
    b: UUID,
    weight: float,
    *,
    db_edge: InfrastructureEdge | None = None,
) -> None:
    g.adj.setdefault(a, []).append((b, weight))
    g.adj.setdefault(b, []).append((a, weight))
    if db_edge is not None:
        key = tuple(sorted((a, b)))
        g.edge_by_pair[key] = db_edge


def dijkstra(g: RoadGraph, start: UUID) -> dict[UUID, float]:
    dist, _ = dijkstra_with_prev(g, start)
    return dist


def dijkstra_with_prev(
    g: RoadGraph, start: UUID
) -> tuple[dict[UUID, float], dict[UUID, UUID | None]]:
    dist: dict[UUID, float] = {start: 0.0}
    prev: dict[UUID, UUID | None] = {start: None}
    heap: list[tuple[float, UUID]] = [(0.0, start)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, math.inf):
            continue
        for v, w in g.adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))
    return dist, prev


def shortest_path_nodes(prev: dict[UUID, UUID | None], start: UUID, end: UUID) -> list[UUID] | None:
    if end not in prev and end != start:
        return None
    if start == end:
        return [start]
    path: list[UUID] = []
    cur: UUID | None = end
    while cur is not None:
        path.append(cur)
        if cur == start:
            break
        cur = prev.get(cur)
    else:
        return None
    path.reverse()
    if path[0] != start:
        return None
    return path


def shortest_path_edges(
    g: RoadGraph, prev: dict[UUID, UUID | None], start: UUID, end: UUID
) -> list[InfrastructureEdge]:
    nodes = shortest_path_nodes(prev, start, end)
    if not nodes or len(nodes) < 2:
        return []
    edges: list[InfrastructureEdge] = []
    for i in range(len(nodes) - 1):
        a, b = nodes[i], nodes[i + 1]
        key = tuple(sorted((a, b)))
        edge = g.edge_by_pair.get(key)
        if edge is not None:
            edges.append(edge)
    return edges


def nearest_autoroad_node(
    g: RoadGraph,
    lon: float,
    lat: float,
    *,
    max_km: float = ENDPOINT_SNAP_TOLERANCE_KM,
) -> tuple[UUID | None, float]:
    best_id: UUID | None = None
    best_d = math.inf
    for nid in g.adj:
        coord = g.coords.get(nid)
        if not coord:
            continue
        nlon, nlat = coord
        d = haversine_km(lon, lat, nlon, nlat)
        if d < best_d:
            best_d = d
            best_id = nid
    if best_id is None or best_d > max_km:
        return None, best_d if best_d < math.inf else math.inf
    return best_id, best_d


def distance_to_autoroad_polylines(
    lon: float,
    lat: float,
    polylines: list[list[tuple[float, float]]],
) -> float:
    best = math.inf
    for coords in polylines:
        if len(coords) < 2:
            continue
        for i in range(len(coords) - 1):
            a = coords[i]
            b = coords[i + 1]
            clon, clat = closest_point_on_segment(lon, lat, a[0], a[1], b[0], b[1])
            d = haversine_km(lon, lat, clon, clat)
            if d < best:
                best = d
    return best


def closest_point_on_polyline_for_snap(
    lon: float,
    lat: float,
    coords: list[tuple[float, float]],
) -> tuple[float, float, int]:
    """Closest point on polyline including endpoints (for facility snap)."""
    if len(coords) < 2:
        return lon, lat, 0
    best_d = math.inf
    best: tuple[float, float, int] = (lon, lat, 0)
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        clon, clat = closest_point_on_segment(lon, lat, a[0], a[1], b[0], b[1])
        d = haversine_km(lon, lat, clon, clat)
        if d < best_d:
            dx = b[0] - a[0]
            dy = b[1] - a[1]
            len2 = dx * dx + dy * dy
            t = ((lon - a[0]) * dx + (lat - a[1]) * dy) / len2 if len2 > 0 else 0.0
            t = max(0.0, min(1.0, t))
            best_d = d
            best = (clon, clat, i)
    return best


def closest_point_on_polyline(
    lon: float,
    lat: float,
    coords: list[tuple[float, float]],
    *,
    min_from_endpoint_km: float = LINE_SPLIT_ENDPOINT_MIN_KM,
) -> tuple[float, float, int] | None:
    """Return (snap_lon, snap_lat, segment_index) or None if at line endpoint."""
    if len(coords) < 2:
        return None
    best_d = math.inf
    best: tuple[float, float, int, float] | None = None
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        clon, clat = closest_point_on_segment(lon, lat, a[0], a[1], b[0], b[1])
        d = haversine_km(lon, lat, clon, clat)
        if d < best_d:
            dx = b[0] - a[0]
            dy = b[1] - a[1]
            len2 = dx * dx + dy * dy
            t = ((lon - a[0]) * dx + (lat - a[1]) * dy) / len2 if len2 > 0 else 0.0
            t = max(0.0, min(1.0, t))
            best_d = d
            best = (clon, clat, i, t)
    if best is None:
        return None
    clon, clat, seg_i, t = best
    start, end = coords[0], coords[-1]
    at_start = seg_i == 0 and (
        t <= 1e-6 or haversine_km(clon, clat, start[0], start[1]) < min_from_endpoint_km
    )
    at_end = seg_i == len(coords) - 2 and (
        t >= 1 - 1e-6 or haversine_km(clon, clat, end[0], end[1]) < min_from_endpoint_km
    )
    if at_start or at_end:
        return None
    return clon, clat, seg_i


def snap_site_to_autoroad_network(
    g: RoadGraph,
    lon: float,
    lat: float,
    polylines: list[list[tuple[float, float]]],
    *,
    max_km: float = ENDPOINT_SNAP_TOLERANCE_KM,
) -> tuple[UUID | None, float]:
    line_dist = distance_to_autoroad_polylines(lon, lat, polylines)
    if line_dist > max_km:
        return None, line_dist
    nid, _ = nearest_autoroad_node(g, lon, lat, max_km=max_km)
    return nid, line_dist


def nearest_node(g: RoadGraph, lon: float, lat: float) -> tuple[UUID | None, float]:
    best_id: UUID | None = None
    best_d = math.inf
    for nid, (nlon, nlat) in g.coords.items():
        d = haversine_km(lon, lat, nlon, nlat)
        if d < best_d:
            best_d = d
            best_id = nid
    if best_id is None:
        return None, math.inf
    return best_id, best_d


def connected_components(adj: dict[UUID, list[tuple[UUID, float]]]) -> list[set[UUID]]:
    seen: set[UUID] = set()
    components: list[set[UUID]] = []
    for start in adj:
        if start in seen:
            continue
        stack = [start]
        comp: set[UUID] = set()
        while stack:
            u = stack.pop()
            if u in comp:
                continue
            comp.add(u)
            for v, _ in adj.get(u, []):
                if v not in comp:
                    stack.append(v)
        seen |= comp
        if comp:
            components.append(comp)
    return components


def node_component(g: RoadGraph, node_id: UUID) -> set[UUID] | None:
    for comp in connected_components(g.adj):
        if node_id in comp:
            return comp
    return None


def build_autoroad_graph(
    nodes: list[InfrastructureNode],
    db_edges: list[InfrastructureEdge],
    subtype_by_obj: dict[UUID, str],
    *,
    calc_date: date | None = None,
    entry_by_obj: dict[UUID, date] | None = None,
) -> RoadGraph:
    g = RoadGraph()
    for n in nodes:
        g.coords[n.id] = (n.longitude, n.latitude)
    entry_by_obj = entry_by_obj or {}
    for edge in db_edges:
        if edge.infrastructure_object_id is None:
            continue
        if subtype_by_obj.get(edge.infrastructure_object_id) != "autoroad":
            continue
        if calc_date is not None:
            road_entry = entry_by_obj.get(edge.infrastructure_object_id)
            if road_entry is not None and not is_in_service(road_entry, calc_date):
                continue
        w = max(float(edge.length_km or 0), 0.0)
        if w <= 0:
            continue
        add_undirected_edge(
            g, edge.from_node_id, edge.to_node_id, w, db_edge=edge
        )
    return g


def build_autoroad_polylines(
    autoroad_objects: list[InfrastructureObject],
    *,
    calc_date: date | None = None,
) -> list[list[tuple[float, float]]]:
    polylines: list[list[tuple[float, float]]] = []
    for road in autoroad_objects:
        if calc_date is not None:
            road_entry = read_entry_date(road.properties)
            if not is_in_service(road_entry, calc_date):
                continue
        coords = line_coords_from_object(road)
        if len(coords) >= 2:
            polylines.append(coords)
    return polylines


def mst_terminal_edges(
    terminal_ids: list[UUID],
    dist_matrix: dict[UUID, dict[UUID, float]],
) -> list[tuple[UUID, UUID]]:
    """Kruskal MST on terminals; edges with infinite weight are skipped."""
    parent = {t: t for t in terminal_ids}

    def find(x: UUID) -> UUID:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: UUID, b: UUID) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    edges: list[tuple[UUID, UUID, float]] = []
    for i, a in enumerate(terminal_ids):
        for b in terminal_ids[i + 1 :]:
            w = dist_matrix.get(a, {}).get(b, math.inf)
            if w < math.inf:
                edges.append((a, b, w))
    edges.sort(key=lambda e: e[2])
    mst: list[tuple[UUID, UUID]] = []
    for a, b, _ in edges:
        if find(a) != find(b):
            union(a, b)
            mst.append((a, b))
    return mst


def min_bridge_between_components(
    comp_a: set[UUID],
    comp_b: set[UUID],
    g: RoadGraph,
) -> tuple[UUID, UUID, float] | None:
    """Shortest geodesic between any node pair across two components."""
    best: tuple[UUID, UUID, float] | None = None
    for na in comp_a:
        ca = g.coords.get(na)
        if not ca:
            continue
        for nb in comp_b:
            cb = g.coords.get(nb)
            if not cb:
                continue
            d = haversine_km(ca[0], ca[1], cb[0], cb[1])
            if best is None or d < best[2]:
                best = (na, nb, d)
    return best
