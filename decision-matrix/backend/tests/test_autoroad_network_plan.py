"""Autoroad network planner integration (network-planner adapter)."""

from uuid import uuid4

import pytest
from network_planner.steiner.steinerpy import is_steinerpy_available

from app.services.autoroad_network.planner_adapter import compute_via_network_planner
from app.services.autoroad_network.schemas import (
    NetworkPlanRequest,
    PlanOptionsInput,
    PlanTerminalInput,
)

GKS_TWELVE = [
    ("GKS_1", 37.142939119144025, 56.04061323280081),
    ("GKS_2", 37.209717990505276, 56.04061323280081),
    ("GKS_3", 37.16123879581562, 55.94803530058053),
    ("GKS_4", 37.22213184325423, 55.94938438681757),
    ("GKS_5", 37.28356554653648, 55.9487153552989),
    ("GKS_6", 37.35034441789771, 55.9487153552989),
]


def _terminals_from_layout(layout: list[tuple[str, float, float]]) -> list[PlanTerminalInput]:
    return [
        PlanTerminalInput(id=uuid4(), subtype="oil_pad", name=name, lon=lon, lat=lat)
        for name, lon, lat in layout
    ]


def _object_snap_count(new_lines, terminal_id) -> int:
    n = 0
    for ln in new_lines:
        if ln.snap_start_object_id == terminal_id or ln.snap_finish_object_id == terminal_id:
            n += 1
    return n


def test_two_terminals_produce_lines():
    import asyncio
    if not is_steinerpy_available():
        pytest.skip("steinerpy not installed")
    t = _terminals_from_layout([("A", 37.6, 55.75), ("B", 37.62, 55.76)])
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=t,
        options=PlanOptionsInput(solver="steinerpy"),
    )
    out = asyncio.run(compute_via_network_planner(req))
    assert out.new_line_count >= 1
    assert out.total_new_km > 0
    for term in t:
        assert _object_snap_count(out.new_lines, term.id) <= 1


def test_three_terminals_connected_tree():
    import asyncio
    if not is_steinerpy_available():
        pytest.skip("steinerpy not installed")
    t = _terminals_from_layout(
        [
            ("A", 37.60, 55.75),
            ("B", 37.62, 55.76),
            ("C", 37.64, 55.74),
        ]
    )
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=t,
        options=PlanOptionsInput(solver="steinerpy", steiner_radius_km=0.2),
    )
    out = asyncio.run(compute_via_network_planner(req))
    assert out.new_line_count >= 2
    for term in t:
        assert _object_snap_count(out.new_lines, term.id) <= 1


def test_six_terminals_gks_subset():
    import asyncio
    if not is_steinerpy_available():
        pytest.skip("steinerpy not installed")
    t = _terminals_from_layout(GKS_TWELVE)
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=t,
        options=PlanOptionsInput(solver="steinerpy", max_terminals=50),
    )
    out = asyncio.run(compute_via_network_planner(req))
    assert out.new_line_count >= len(t) - 1
    assert out.total_new_km > 0
