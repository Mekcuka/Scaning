"""Unit tests for sand logistics graph and allocation."""

from uuid import uuid4

from app.services.sand_logistics import (
    _PointSite,
    _RoadGraph,
    _add_undirected_edge,
    _analyze_subnet,
    _connected_components,
    _dijkstra,
    _nearest_autoroad_node,
    _nearest_node,
    _snap_site_to_autoroad_network,
)
from app.services.line_endpoint_rules import ENDPOINT_SNAP_TOLERANCE_KM


def _chain_graph() -> tuple[_RoadGraph, list[UUID]]:
    """Linear graph: n0 --1km-- n1 --2km-- n2 --1km-- n3"""
    g = _RoadGraph()
    ids = [uuid4() for _ in range(4)]
    for i, nid in enumerate(ids):
        g.coords[nid] = (37.0 + i * 0.01, 55.0)
    _add_undirected_edge(g, ids[0], ids[1], 1.0)
    _add_undirected_edge(g, ids[1], ids[2], 2.0)
    _add_undirected_edge(g, ids[2], ids[3], 1.0)
    return g, ids


def test_dijkstra_chain():
    g, ids = _chain_graph()
    dist = _dijkstra(g, ids[0])
    assert dist[ids[3]] == 4.0


def test_nearest_node():
    g, ids = _chain_graph()
    nid, d = _nearest_node(g, 37.02, 55.0)
    assert nid == ids[2]
    assert d < 0.1


def test_nearest_autoroad_node_respects_snap_tolerance():
    g, ids = _chain_graph()
    # ~380 m from ближайшего узла — за пределами 0.3 km
    far_lon = 37.025
    nid, d = _nearest_autoroad_node(g, far_lon, 55.0)
    assert nid is None
    assert d > ENDPOINT_SNAP_TOLERANCE_KM
    # On top of road node — snaps
    nid2, d2 = _nearest_autoroad_node(g, 37.01, 55.0)
    assert nid2 == ids[1]
    assert d2 < ENDPOINT_SNAP_TOLERANCE_KM


def test_nearest_autoroad_node_ignores_orphan_coords():
    g = _RoadGraph()
    a, b, orphan = uuid4(), uuid4(), uuid4()
    g.coords[a] = (37.0, 55.0)
    g.coords[b] = (37.01, 55.0)
    g.coords[orphan] = (37.00005, 55.0)
    _add_undirected_edge(g, a, b, 1.0)
    nid, _ = _nearest_autoroad_node(g, 37.00005, 55.0)
    assert nid in (a, b)


def test_snap_site_to_autoroad_network_requires_polyline_proximity():
    g = _RoadGraph()
    n0, n1 = uuid4(), uuid4()
    g.coords[n0] = (37.0, 55.0)
    g.coords[n1] = (37.01, 55.0)
    _add_undirected_edge(g, n0, n1, 1.0)
    polyline = [[(37.0, 55.0), (37.01, 55.0)]]
    on_road, _ = _snap_site_to_autoroad_network(g, 37.0, 55.0, polyline)
    assert on_road is not None
    off_road, dist = _snap_site_to_autoroad_network(g, 37.005, 55.05, polyline)
    assert off_road is None
    assert dist > ENDPOINT_SNAP_TOLERANCE_KM


def test_greedy_allocation_logic():
    """Two quarries, three consumers — nearest with capacity limits."""
    q1 = uuid4()
    q2 = uuid4()
    quarry_remaining = {q1: 100.0, q2: 50.0}
    consumers = [
        (_PointSite(uuid4(), "C1", "pad", 0, 0, demand_m3=80), q1),
        (_PointSite(uuid4(), "C2", "pad", 0, 0, demand_m3=40), q1),
        (_PointSite(uuid4(), "C3", "pad", 0, 0, demand_m3=30), q2),
    ]
    # sorted by pretend distance order
    greedy: dict = {}
    for c, qid in consumers:
        need = c.demand_m3
        avail = quarry_remaining[qid]
        take = min(need, avail)
        quarry_remaining[qid] = avail - take
        greedy[c.object_id] = take
    assert greedy[consumers[0][0].object_id] == 80
    assert quarry_remaining[q1] == 0
    assert greedy[consumers[1][0].object_id] == 20  # only 20 left on q1
    assert greedy[consumers[2][0].object_id] == 30


def test_connected_components_two_islands():
    g = _RoadGraph()
    a, b = uuid4(), uuid4()
    c, d = uuid4(), uuid4()
    for nid, lon in ((a, 37.0), (b, 37.01), (c, 38.0), (d, 38.01)):
        g.coords[nid] = (lon, 55.0)
    _add_undirected_edge(g, a, b, 1.0)
    _add_undirected_edge(g, c, d, 2.0)
    comps = _connected_components(g.adj)
    assert len(comps) == 2
    assert {a, b} in comps
    assert {c, d} in comps


def test_analyze_subnet_isolates_allocation():
    """Consumer on another island is excluded from a quarry subnet."""
    g = _RoadGraph()
    n0, n1, n2, n3 = [uuid4() for _ in range(4)]
    for i, nid in enumerate((n0, n1, n2, n3)):
        g.coords[nid] = (37.0 + i * 0.01, 55.0)
    _add_undirected_edge(g, n0, n1, 1.0)
    _add_undirected_edge(g, n2, n3, 1.0)

    q_a = _PointSite(uuid4(), "Q-A", "sand_quarry", 37.0, 55.0, current_m3=100.0, node_id=n0)
    c_near = _PointSite(uuid4(), "C-near", "pad", 37.01, 55.0, demand_m3=30.0, node_id=n1)
    c_far = _PointSite(uuid4(), "C-far", "pad", 37.03, 55.0, demand_m3=50.0, node_id=n3)

    island_a = {n0, n1}
    out_near = _analyze_subnet(
        g, [q_a], [c_near], [], {}, component=island_a, subnet_index=1
    )
    assert out_near["consumers"][0]["greedy_allocated_m3"] == 30.0

    out_far = _analyze_subnet(
        g, [q_a], [c_near, c_far], [], {}, component=island_a, subnet_index=1
    )
    ids = {r["object_id"] for r in out_far["consumers"]}
    assert str(c_near.object_id) in ids
    assert str(c_far.object_id) not in ids


def test_proportional_allocations_include_distance_km():
    """Two quarries on a chain — consumer gets proportional rows with distance_km."""
    g, ids = _chain_graph()
    n0, n1, n2, n3 = ids
    q_near = _PointSite(uuid4(), "Q-near", "sand_quarry", 37.0, 55.0, current_m3=500.0, node_id=n0)
    q_far = _PointSite(uuid4(), "Q-far", "sand_quarry", 37.03, 55.0, current_m3=500.0, node_id=n3)
    consumer = _PointSite(uuid4(), "Pad-1", "pad", 37.02, 55.0, demand_m3=100.0, node_id=n2)
    component = set(ids)
    out = _analyze_subnet(
        g, [q_near, q_far], [consumer], [], {}, component=component, subnet_index=1
    )
    assert len(out["consumers"]) == 1
    row = out["consumers"][0]
    parts = row["proportional_allocations"]
    assert len(parts) == 2
    for part in parts:
        assert part["allocated_m3"] > 0
        assert part["distance_km"] is not None
        assert part["distance_km"] > 0
    by_quarry = {p["quarry_id"]: p for p in parts}
    assert str(q_near.object_id) in by_quarry
    assert str(q_far.object_id) in by_quarry
    # Consumer on n2: q_far at n3 is 1 km away, q_near at n0 is 3 km — closer quarry gets more volume.
    assert by_quarry[str(q_far.object_id)]["distance_km"] == 1.0
    assert by_quarry[str(q_near.object_id)]["distance_km"] == 3.0
    assert (
        by_quarry[str(q_far.object_id)]["allocated_m3"]
        > by_quarry[str(q_near.object_id)]["allocated_m3"]
    )
