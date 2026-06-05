"""Unit tests for network-planner adapter."""

from uuid import uuid4

import pytest

from app.services.autoroad_network.planner_adapter import (
    from_planner_response,
    to_planner_request,
)
from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    PlanOptionsInput,
    PlanTerminalInput,
)
from network_planner.schemas.io import (
    PlanResponse,
    SteinerEdgeOut,
    SteinerPointOut,
    SteinerTreeOut,
    TerminalResultOut,
)


def _terminal(lon: float, lat: float) -> PlanTerminalInput:
    return PlanTerminalInput(
        id=uuid4(),
        subtype="oil_pad",
        name="T",
        lon=lon,
        lat=lat,
    )


def test_to_planner_request_roles():
    t1, t2, t3 = _terminal(37.6, 55.75), _terminal(37.62, 55.76), _terminal(37.64, 55.74)
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[t1, t2, t3],
        options=PlanOptionsInput(solver="steinerpy"),
    )
    planner_req, warnings = to_planner_request(req)
    assert len(planner_req.terminals) == 3
    assert planner_req.terminals[0].role == "start"
    assert planner_req.terminals[1].role == "intermediate"
    assert planner_req.terminals[2].role == "end"
    assert planner_req.options.connector_max_km == 0.2
    assert not warnings


def test_to_planner_request_existing_roads_warning():
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[_terminal(37.6, 55.75), _terminal(37.62, 55.76)],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=uuid4(),
                coordinates=[[37.6, 55.75], [37.62, 55.76]],
            )
        ],
    )
    _, warnings = to_planner_request(req)
    assert "legacy_existing_roads_ignored" in warnings


def test_from_planner_response_maps_edges():
    t1, t2 = _terminal(37.6, 55.75), _terminal(37.62, 55.76)
    req = NetworkPlanRequest(project_id=uuid4(), terminals=[t1, t2])
    tid1 = f"terminal:{t1.id}"
    tid2 = f"terminal:{t2.id}"
    resp = PlanResponse(
        steiner_tree=SteinerTreeOut(
            edges=[
                SteinerEdgeOut(
                    from_id=tid1,
                    to_id="steiner:hub:0",
                    coordinates=[[37.6, 55.75], [37.61, 55.755]],
                ),
                SteinerEdgeOut(
                    from_id="steiner:hub:0",
                    to_id="steiner:0",
                    coordinates=[[37.61, 55.755], [37.615, 55.758]],
                ),
                SteinerEdgeOut(
                    from_id="steiner:0",
                    to_id=tid2,
                    coordinates=[[37.615, 55.758], [37.62, 55.76]],
                ),
            ],
            steiner_points=[
                SteinerPointOut(id="steiner:0", lon=37.615, lat=55.758),
                SteinerPointOut(id="steiner:hub:0", lon=37.61, lat=55.755),
            ],
            length_m=5000.0,
        ),
        terminals=[
            TerminalResultOut(
                id=t1.id,
                type="oil_pad",
                role="start",
                lon=t1.lon,
                lat=t1.lat,
                attached_to="steiner:hub:0",
                length_m=100.0,
            ),
            TerminalResultOut(
                id=t2.id,
                type="oil_pad",
                role="end",
                lon=t2.lon,
                lat=t2.lat,
                attached_to="steiner:0",
                length_m=200.0,
            ),
        ],
        warnings=["solver:steinerpy"],
        total_length_m=5000.0,
        solver="steinerpy",
    )
    out = from_planner_response(resp, req)
    assert out.new_line_count == 3
    assert any(ln.kind == "connector" for ln in out.new_lines)
    assert any(ln.kind == "link" for ln in out.new_lines)
    assert out.new_node_count >= 1
    assert out.total_new_km == pytest.approx(5.0, rel=1e-3)


def test_compute_via_network_planner_steinerpy():
    import asyncio

    from app.services.autoroad_network.planner_adapter import compute_via_network_planner
    from network_planner.steiner.steinerpy import is_steinerpy_available

    if not is_steinerpy_available():
        pytest.skip("steinerpy not installed")

    t1, t2, t3 = _terminal(37.60, 55.75), _terminal(37.62, 55.76), _terminal(37.64, 55.74)
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[t1, t2, t3],
        options=PlanOptionsInput(solver="steinerpy"),
    )
    out = asyncio.run(compute_via_network_planner(req))
    assert out.new_line_count >= 2
    assert out.total_new_km > 0
    assert any("solver:" in w for w in out.warnings)
