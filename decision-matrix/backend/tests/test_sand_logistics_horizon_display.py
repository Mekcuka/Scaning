"""Display snapshots for waiting years without quarry on network."""

from datetime import date
from uuid import uuid4

from app.services.sand_logistics import _PointSite, _RoadGraph
from app.services.sand_logistics_horizon import simulate_sand_horizon


def test_consumer_on_network_without_quarry_has_subnet_snapshot():
    """2019: consumer on isolated node, quarry not on network — still visible on timeline."""
    n_consumer = uuid4()
    g2019 = _RoadGraph()
    g2019.coords[n_consumer] = (37.01, 55.0)

    g2021 = _RoadGraph()
    n0, n1 = uuid4(), uuid4()
    g2021.coords[n0] = (37.0, 55.0)
    g2021.coords[n1] = (37.01, 55.0)
    from app.services.sand_logistics import _add_undirected_edge

    _add_undirected_edge(g2021, n0, n1, 1.0)

    q = _PointSite(
        uuid4(),
        "Q",
        "sand_quarry",
        37.0,
        55.0,
        current_m3=500.0,
        entry_date=date(2021, 1, 1),
    )
    c = _PointSite(
        uuid4(),
        "GKS_3",
        "oil_pad",
        37.01,
        55.0,
        entry_date=date(2019, 1, 1),
    )
    props = {"sand_volume_mode": "single", "sand_volume_m3": 1000.0}

    def build_graph_at(calc_date: date) -> _RoadGraph:
        return g2019 if calc_date.year < 2021 else g2021

    def build_polylines_at(_: date):
        return [[(37.0, 55.0), (37.01, 55.0)]]

    timeline, _, _ = simulate_sand_horizon(
        horizon_from=date(2019, 1, 1),
        horizon_to=date(2021, 12, 31),
        view_as_of=date(2019, 12, 31),
        all_quarries=[q],
        all_consumers=[(c, props)],
        build_graph_at=build_graph_at,
        build_polylines_at=build_polylines_at,
        db_edges=[],
        subtype_by_obj={},
    )
    y2019 = next(t for t in timeline if t["year"] == 2019)
    assert y2019["subnet_count"] >= 1
    assert y2019["total_demand_m3"] >= 1000.0
    consumer = y2019["subnets"][0]["consumers"][0]
    assert consumer["name"] == "GKS_3"
    assert consumer["demand_m3"] == 1000.0
    assert consumer["greedy_allocated_m3"] == 0.0
