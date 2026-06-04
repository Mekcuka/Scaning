"""Road graph: haversine, MST, Dijkstra (subset for standalone planner)."""

from __future__ import annotations

import heapq
import math
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from autoroad_planner.constants import LINE_SPLIT_ENDPOINT_MIN_KM
from autoroad_planner.spatial import closest_point_on_segment, haversine_km

LINE_SPLIT_ENDPOINT_MIN_KM = LINE_SPLIT_ENDPOINT_MIN_KM  # re-export for plan_core


def geodesic_midpoint(
    lon1: float, lat1: float, lon2: float, lat2: float
) -> tuple[float, float]:
    phi1, lam1 = math.radians(lat1), math.radians(lon1)
    phi2, lam2 = math.radians(lat2), math.radians(lon2)
    dlam = lam2 - lam1
    bx = math.cos(phi2) * math.cos(dlam)
    by = math.cos(phi2) * math.sin(dlam)
    phi3 = math.atan2(
        math.sin(phi1) + math.sin(phi2),
        math.sqrt((math.cos(phi1) + bx) ** 2 + by**2),
    )
    lam3 = lam1 + math.atan2(by, math.cos(phi1) + bx)
    return math.degrees(lam3), math.degrees(phi3)


@dataclass
class RoadGraph:
    adj: dict[UUID, list[tuple[UUID, float]]] = field(default_factory=dict)
    coords: dict[UUID, tuple[float, float]] = field(default_factory=dict)
    edge_by_pair: dict[tuple[UUID, UUID], Any] = field(default_factory=dict)


def add_undirected_edge(
    g: RoadGraph,
    a: UUID,
    b: UUID,
    weight: float,
    *,
    db_edge: Any | None = None,
) -> None:
    g.adj.setdefault(a, []).append((b, weight))
    g.adj.setdefault(b, []).append((a, weight))
    if db_edge is not None:
        key = tuple(sorted((a, b)))
        g.edge_by_pair[key] = db_edge


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
) -> list[Any]:
    nodes = shortest_path_nodes(prev, start, end)
    if not nodes or len(nodes) < 2:
        return []
    edges: list[Any] = []
    for i in range(len(nodes) - 1):
        a, b = nodes[i], nodes[i + 1]
        key = tuple(sorted((a, b)))
        edge = g.edge_by_pair.get(key)
        if edge is not None:
            edges.append(edge)
    return edges


def closest_point_on_polyline_for_snap(
    lon: float,
    lat: float,
    coords: list[tuple[float, float]],
) -> tuple[float, float, int]:
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


def mst_terminal_edges(
    terminal_ids: list[UUID],
    dist_matrix: dict[UUID, dict[UUID, float]],
) -> list[tuple[UUID, UUID]]:
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
