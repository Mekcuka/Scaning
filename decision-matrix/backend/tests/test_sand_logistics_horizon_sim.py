"""Year-by-year sand logistics horizon simulation."""

from datetime import date
from uuid import uuid4

from app.services.sand_logistics import (
    _PointSite,
    _RoadGraph,
    _add_undirected_edge,
)
from app.services.sand_logistics_horizon import simulate_sand_horizon


def _simple_subnet_graph() -> tuple[_RoadGraph, list]:
    g = _RoadGraph()
    n0, n1 = uuid4(), uuid4()
    g.coords[n0] = (37.0, 55.0)
    g.coords[n1] = (37.01, 55.0)
    _add_undirected_edge(g, n0, n1, 1.0)
    return g, [n0, n1]


def test_timeline_length_matches_horizon_years():
    g, (n0, n1) = _simple_subnet_graph()
    q = _PointSite(
        uuid4(), "Q", "sand_quarry", 37.0, 55.0, current_m3=500.0, entry_date=date(2024, 1, 1), node_id=n0
    )
    c = _PointSite(
        uuid4(), "C", "oil_pad", 37.01, 55.0, entry_date=date(2024, 1, 1), node_id=n1
    )
    props = {"sand_volume_mode": "single", "sand_volume_m3": 100.0}

    def build_graph_at(_: date) -> _RoadGraph:
        return g

    def build_polylines_at(_: date):
        return [[(37.0, 55.0), (37.01, 55.0)]]

    timeline, subnets, _ = simulate_sand_horizon(
        horizon_from=date(2024, 1, 1),
        horizon_to=date(2026, 12, 31),
        view_as_of=date(2026, 12, 31),
        all_quarries=[q],
        all_consumers=[(c, props)],
        build_graph_at=build_graph_at,
        build_polylines_at=build_polylines_at,
        db_edges=[],
        subtype_by_obj={},
    )
    assert len(timeline) == 3
    assert timeline[0]["year"] == 2024
    assert timeline[-1]["year"] == 2026
    assert len(subnets) == 1
    consumer = subnets[0]["consumers"][0]
    assert consumer["greedy_allocated_m3"] == 100.0


def test_quarry_depletes_across_years():
    g, (n0, n1) = _simple_subnet_graph()
    q = _PointSite(
        uuid4(), "Q", "sand_quarry", 37.0, 55.0, current_m3=80.0, entry_date=date(2024, 1, 1), node_id=n0
    )
    c1 = _PointSite(
        uuid4(), "C1", "oil_pad", 37.01, 55.0, entry_date=date(2024, 1, 1), node_id=n1
    )
    c2 = _PointSite(
        uuid4(), "C2", "oil_pad", 37.01, 55.0, entry_date=date(2025, 1, 1), node_id=n1
    )
    props1 = {"sand_volume_mode": "single", "sand_volume_m3": 50.0}
    props2 = {"sand_volume_mode": "single", "sand_volume_m3": 50.0}

    def build_graph_at(_: date) -> _RoadGraph:
        return g

    def build_polylines_at(_: date):
        return [[(37.0, 55.0), (37.01, 55.0)]]

    timeline, subnets_at_end, _ = simulate_sand_horizon(
        horizon_from=date(2024, 1, 1),
        horizon_to=date(2025, 12, 31),
        view_as_of=date(2025, 12, 31),
        all_quarries=[q],
        all_consumers=[(c1, props1), (c2, props2)],
        build_graph_at=build_graph_at,
        build_polylines_at=build_polylines_at,
        db_edges=[],
        subtype_by_obj={},
    )
    y2024 = next(t for t in timeline if t["year"] == 2024)
    y2025 = next(t for t in timeline if t["year"] == 2025)
    assert y2024["total_allocated_m3"] == 50.0
    assert y2025["total_allocated_m3"] == 80.0
    assert y2025["unmet_m3"] == 20.0
    final_consumer = {r["name"]: r for r in subnets_at_end[0]["consumers"]}
    assert final_consumer["C1"]["greedy_allocated_m3"] == 50.0
    assert final_consumer["C2"]["greedy_allocated_m3"] == 30.0


def test_deferred_supply_consumer_waits_for_quarry():
    """GKS_3 case: entry 2019, quarry from 2021 — demand in 2019, allocation when sand available."""
    g, (n0, n1) = _simple_subnet_graph()
    q = _PointSite(
        uuid4(),
        "Q",
        "sand_quarry",
        37.0,
        55.0,
        current_m3=1000.0,
        entry_date=date(2021, 1, 1),
        node_id=n0,
    )
    c = _PointSite(
        uuid4(),
        "GKS_3",
        "oil_pad",
        37.01,
        55.0,
        entry_date=date(2019, 1, 1),
        node_id=n1,
    )
    props = {"sand_volume_mode": "single", "sand_volume_m3": 1000.0}

    def build_graph_at(_: date) -> _RoadGraph:
        return g

    def build_polylines_at(_: date):
        return [[(37.0, 55.0), (37.01, 55.0)]]

    timeline, subnets_at_end, _ = simulate_sand_horizon(
        horizon_from=date(2019, 1, 1),
        horizon_to=date(2021, 12, 31),
        view_as_of=date(2021, 12, 31),
        all_quarries=[q],
        all_consumers=[(c, props)],
        build_graph_at=build_graph_at,
        build_polylines_at=build_polylines_at,
        db_edges=[],
        subtype_by_obj={},
    )
    y2019 = next(t for t in timeline if t["year"] == 2019)
    y2020 = next(t for t in timeline if t["year"] == 2020)
    y2021 = next(t for t in timeline if t["year"] == 2021)
    consumer_2019 = y2019["subnets"][0]["consumers"][0]
    assert consumer_2019["demand_by_year_m3"]["2019"] == 1000.0
    assert consumer_2019["greedy_allocated_m3"] == 0.0
    assert y2020["total_allocated_m3"] == 0.0
    assert y2021["total_allocated_m3"] == 1000.0
    final = subnets_at_end[0]["consumers"][0]
    assert final["greedy_allocated_m3"] == 1000.0
    assert final["allocation_by_year_m3"]["2021"] == 1000.0
    assert "unmet_demand:" not in str(y2021["subnets"][0]["warnings"])


def test_late_network_join_still_accrues_demand():
    """Consumer entry 2019 off-network; joins quarry subnet in 2020 — backlog allocated then."""
    n0, n1, n2 = uuid4(), uuid4(), uuid4()
    g_early = _RoadGraph()
    g_early.coords[n0] = (37.0, 55.0)
    g_early.coords[n1] = (37.01, 55.0)
    _add_undirected_edge(g_early, n0, n1, 1.0)

    g_late = _RoadGraph()
    g_late.coords[n0] = (37.0, 55.0)
    g_late.coords[n1] = (37.01, 55.0)
    g_late.coords[n2] = (37.02, 55.0)
    _add_undirected_edge(g_late, n0, n1, 1.0)
    _add_undirected_edge(g_late, n1, n2, 1.0)

    q = _PointSite(
        uuid4(), "Q", "sand_quarry", 37.0, 55.0, current_m3=500.0, entry_date=date(2019, 1, 1), node_id=n0
    )
    c = _PointSite(
        uuid4(), "Late", "oil_pad", 37.02, 55.0, entry_date=date(2019, 1, 1), node_id=n2
    )
    props = {"sand_volume_mode": "single", "sand_volume_m3": 200.0}

    def build_graph_at(calc_date: date) -> _RoadGraph:
        return g_early if calc_date.year < 2020 else g_late

    def build_polylines_at(_: date):
        return [[(37.0, 55.0), (37.01, 55.0), (37.02, 55.0)]]

    timeline, subnets_at_end, _ = simulate_sand_horizon(
        horizon_from=date(2019, 1, 1),
        horizon_to=date(2020, 12, 31),
        view_as_of=date(2020, 12, 31),
        all_quarries=[q],
        all_consumers=[(c, props)],
        build_graph_at=build_graph_at,
        build_polylines_at=build_polylines_at,
        db_edges=[],
        subtype_by_obj={},
    )
    y2019 = next(t for t in timeline if t["year"] == 2019)
    y2020 = next(t for t in timeline if t["year"] == 2020)
    assert y2019["total_allocated_m3"] == 0.0
    assert len(y2019["subnets"]) >= 1
    rows_2019 = [r for sn in y2019["subnets"] for r in sn["consumers"]]
    assert any(r["name"] == "Late" for r in rows_2019)
    assert y2020["total_demand_m3"] == 200.0
    assert y2020["total_allocated_m3"] == 200.0
    late_row = next(r for r in subnets_at_end[0]["consumers"] if r["name"] == "Late")
    assert late_row["demand_m3"] == 200.0
    assert late_row["demand_by_year_m3"]["2019"] == 200.0
    assert late_row["greedy_allocated_m3"] == 200.0
    assert late_row["allocation_by_year_m3"]["2020"] == 200.0


def test_yearly_mode_outstanding_no_double_count():
    g, (n0, n1) = _simple_subnet_graph()
    q = _PointSite(
        uuid4(), "Q", "sand_quarry", 37.0, 55.0, current_m3=150.0, entry_date=date(2024, 1, 1), node_id=n0
    )
    c = _PointSite(
        uuid4(), "C", "oil_pad", 37.01, 55.0, entry_date=date(2024, 1, 1), node_id=n1
    )
    props = {
        "sand_volume_mode": "yearly",
        "sand_volume_by_year": {"2024": 100.0, "2025": 100.0},
    }

    def build_graph_at(_: date) -> _RoadGraph:
        return g

    def build_polylines_at(_: date):
        return [[(37.0, 55.0), (37.01, 55.0)]]

    timeline, _, _ = simulate_sand_horizon(
        horizon_from=date(2024, 1, 1),
        horizon_to=date(2025, 12, 31),
        view_as_of=date(2025, 12, 31),
        all_quarries=[q],
        all_consumers=[(c, props)],
        build_graph_at=build_graph_at,
        build_polylines_at=build_polylines_at,
        db_edges=[],
        subtype_by_obj={},
    )
    y2025 = next(t for t in timeline if t["year"] == 2025)
    consumer = y2025["subnets"][0]["consumers"][0]
    assert consumer["demand_m3"] == 200.0
    assert consumer["greedy_allocated_m3"] == 150.0
    assert consumer["demand_by_year_m3"] == {"2024": 100.0, "2025": 100.0}
    assert "unmet_demand:" in str(y2025["subnets"][0]["warnings"])
