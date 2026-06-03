"""Road graph utilities."""

import math
from uuid import uuid4

from app.services.road_graph import (
    RoadGraph,
    add_undirected_edge,
    dijkstra_with_prev,
    geodesic_midpoint,
    haversine_km,
    mst_terminal_edges,
    shortest_path_nodes,
)


def _chain() -> tuple[RoadGraph, list]:
    g = RoadGraph()
    ids = [uuid4() for _ in range(4)]
    for i, nid in enumerate(ids):
        g.coords[nid] = (37.0 + i * 0.01, 55.0)
    add_undirected_edge(g, ids[0], ids[1], 1.0)
    add_undirected_edge(g, ids[1], ids[2], 2.0)
    add_undirected_edge(g, ids[2], ids[3], 1.0)
    return g, ids


def test_dijkstra_with_prev_path():
    g, ids = _chain()
    dist, prev = dijkstra_with_prev(g, ids[0])
    assert dist[ids[3]] == 4.0
    path = shortest_path_nodes(prev, ids[0], ids[3])
    assert path == ids


def test_geodesic_midpoint_between_endpoints():
    lon1, lat1 = 37.60, 55.75
    lon2, lat2 = 37.64, 55.75
    mlon, mlat = geodesic_midpoint(lon1, lat1, lon2, lat2)
    assert haversine_km(lon1, lat1, mlon, mlat) < haversine_km(lon1, lat1, lon2, lat2)
    assert haversine_km(mlon, mlat, lon2, lat2) < haversine_km(lon1, lat1, lon2, lat2)


def test_mst_three_terminals():
    g, ids = _chain()
    terminals = [ids[0], ids[2], ids[3]]
    dist_matrix: dict = {}
    for a in terminals:
        dist_matrix[a] = {}
        d, prev = dijkstra_with_prev(g, a)
        for b in terminals:
            if b in d:
                dist_matrix[a][b] = d[b]
            else:
                dist_matrix[a][b] = math.inf
    mst = mst_terminal_edges(terminals, dist_matrix)
    assert len(mst) == 2
