"""GeoSteiner plan stays connected after attachment limits."""

from __future__ import annotations

from uuid import uuid4

import pytest
from network_planner.geo.projection import LocalProjection
from network_planner.plan.pipeline import plan_from_request_geosteiner
from network_planner.schemas.io import PlanOptions, PlanRequest, TerminalInput
from network_planner.steiner.geosteiner import is_geosteiner_available
from network_planner.steiner.terminal_attach import apply_attachment_limits
from network_planner.steiner.geosteiner.solver import solve_steiner_tree_geosteiner

pytestmark = pytest.mark.skipif(
    not is_geosteiner_available(),
    reason="geosteiner not installed",
)


def _sample_plan_request(n: int = 5, *, connector_km: float = 0.2) -> PlanRequest:
    proj = LocalProjection.from_points([37.62] * n, [55.75] * n)
    terminals: list[TerminalInput] = []
    for i in range(n):
        x = float(i * 5000)
        y = 1000.0 if i % 2 == 0 else -1000.0
        lon, lat = proj.to_wgs84(x, y)
        role = "start" if i == 0 else ("end" if i == n - 1 else "intermediate")
        terminals.append(
            TerminalInput(id=uuid4(), role=role, lon=lon, lat=lat)
        )
    return PlanRequest(
        terminals=terminals,
        options=PlanOptions(
            connector_max_km=connector_km,
            enforce_attachment_radius=True,
            normalize_terminal_leaves=True,
        ),
    )


def test_geosteiner_plan_stays_connected_with_limits():
    resp = plan_from_request_geosteiner(_sample_plan_request())
    assert "start_end_not_connected" not in resp.warnings


def test_attachment_adjustment_preserves_connectivity():
    req = _sample_plan_request()
    proj = LocalProjection.from_points([t.lon for t in req.terminals], [t.lat for t in req.terminals])
    gids = [f"terminal:{t.id}" for t in req.terminals]
    lpts = [proj.to_local(t.lon, t.lat) for t in req.terminals]
    limits = {gid: req.options.connector_max_km * 1000.0 for gid in gids}
    tree = solve_steiner_tree_geosteiner(gids, lpts, normalize_leaves=True)
    adjusted = apply_attachment_limits(tree, gids, lpts, limits)
    from network_planner.steiner.union_find import UnionFind

    nodes: set[str] = set()
    for a, b, _, _ in adjusted.edges:
        nodes.add(a)
        nodes.add(b)
    index = {v: i for i, v in enumerate(nodes)}
    uf = UnionFind(len(index))
    for a, b, _, _ in adjusted.edges:
        uf.union(index[a], index[b])
    assert len({uf.find(i) for i in range(len(index))}) == 1
