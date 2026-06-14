"""Tests for fluid flow schematic pathfinding."""

from uuid import uuid4

from app.services.fluid_routing import FLUID_TERMINAL_SUBTYPES
from app.services.fluid_flow_schematic import _Graph, nearest_node_on_fluid_edges, pathfind_bfs


def _make_line_graph() -> tuple[_Graph, list]:
    """POI near n1 --oil--> n2 --oil--> n3 (refinery)."""
    n1, n2, n3 = uuid4(), uuid4(), uuid4()
    g = _Graph()
    g.node_coords = {n1: (30.0, 60.0), n2: (30.01, 60.0), n3: (30.02, 60.0)}
    g.node_subtype = {n1: None, n2: None, n3: "refinery"}
    g.node_name = {n3: "НПЗ-1"}
    g.adj = {
        n1: [(n2, "oil_pipeline")],
        n2: [(n1, "oil_pipeline"), (n3, "oil_pipeline")],
        n3: [(n2, "oil_pipeline")],
    }
    g.terminal_nodes = {"oil": {n3}, "water": set(), "gas": set()}
    return g, [n1, n2, n3]


def test_pathfind_bfs_finds_refinery():
    g, (n1, _n2, n3) = _make_line_graph()
    result = pathfind_bfs(g, n1, "oil")
    assert result is not None
    path, _km = result
    assert path[-1] == n3


def test_nearest_node_on_oil_edges():
    g, (n1, _n2, _n3) = _make_line_graph()
    start = nearest_node_on_fluid_edges(g, 30.0001, 60.0001, "oil")
    assert start == n1


def test_schematic_water_centralized_to_bkns_then_formation():
    from app.services.calculations import EngineeringState
    from app.services.fluid_flow_schematic import _schematic_from_state
    from app.models import PointOfInterest

    n1, n2, n3 = uuid4(), uuid4(), uuid4()
    g = _Graph()
    g.node_coords = {n1: (30.0, 60.0), n2: (30.01, 60.0), n3: (30.02, 60.0)}
    g.node_subtype = {n1: None, n2: None, n3: "ground_pumping_station"}
    g.node_name = {n3: "БКНС-1"}
    g.adj = {
        n1: [(n2, "water_pipeline")],
        n2: [(n1, "water_pipeline"), (n3, "water_pipeline")],
        n3: [(n2, "water_pipeline")],
    }
    g.terminal_nodes = {"oil": set(), "water": {n3}, "gas": set()}

    poi = PointOfInterest(
        id=uuid4(),
        project_id=uuid4(),
        name="Куст 3",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        eng_injection="centralized",
        water_injection_volume=300.0,
    )
    state = EngineeringState(
        fluid_type="oil",
        eng_injection="centralized",
        water_injection_volume=300.0,
        eng_transport="auto",
    )
    data = _schematic_from_state(poi, state, g, network_built=True)
    terminals = [n for n in data["nodes"] if n.get("kind") == "terminal" and n.get("fluid") == "water"]
    utils = [
        n
        for n in data["nodes"]
        if n.get("kind") == "utilization" and n.get("fluid") == "water"
    ]
    assert len(terminals) == 1
    assert terminals[0]["subtype"] == "ground_pumping_station"
    assert terminals[0]["label"] == "БКНС-1"
    assert len(utils) == 1
    assert utils[0]["label"] == "В пласт"
    assert any(n.get("kind") == "network_segment" and n.get("fluid") == "water" for n in data["nodes"])
    assert "no_path_for_water" not in data["warnings"]


def test_schematic_water_local_injection_to_formation():
    from app.services.calculations import EngineeringState
    from app.services.fluid_flow_schematic import _schematic_from_state
    from app.models import PointOfInterest

    poi = PointOfInterest(
        id=uuid4(),
        project_id=uuid4(),
        name="Куст 2",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        eng_injection="local",
        water_injection_volume=150.0,
    )
    state = EngineeringState(
        fluid_type="oil",
        eng_injection="local",
        water_injection_volume=150.0,
        eng_transport="auto",
    )
    data = _schematic_from_state(poi, state, None, network_built=False)
    water_utils = [
        n
        for n in data["nodes"]
        if n.get("kind") == "utilization" and n.get("fluid") == "water"
    ]
    assert len(water_utils) == 1
    assert water_utils[0]["label"] == "В пласт"
    assert not any(
        n.get("kind") == "network_segment" and n.get("fluid") == "water" for n in data["nodes"]
    )
    assert "no_path_for_water" not in data["warnings"]


def test_schematic_water_inactive_for_gas_poi():
    from app.services.calculations import EngineeringState
    from app.services.fluid_flow_schematic import _schematic_from_state
    from app.models import PointOfInterest

    poi = PointOfInterest(
        id=uuid4(),
        project_id=uuid4(),
        name="Куст 1",
        longitude=30.0,
        latitude=60.0,
        fluid_type="gas",
        eng_injection="local",
        water_injection_volume=0,
    )
    state = EngineeringState(
        fluid_type="gas",
        eng_injection="local",
        water_injection_volume=0,
        eng_transport="auto",
    )
    data = _schematic_from_state(poi, state, None, network_built=False)
    branch_fluids = [n["fluid"] for n in data["nodes"] if n["kind"] == "fluid_branch"]
    assert "water" not in branch_fluids
    assert "gas" in branch_fluids
