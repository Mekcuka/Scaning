"""Autoroad network planner (stateless)."""

import asyncio
from uuid import uuid4

from app.services.autoroad_network.plan_core import (
    _object_snap_count,
    plan_from_request,
)
from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    PlanTerminalInput,
)
from app.services.road_graph import geodesic_midpoint, haversine_km, mst_terminal_edges


def _assert_one_autoroad_per_terminal(out, terminal_ids):
    for tid in terminal_ids:
        assert _object_snap_count(out.new_lines, tid) <= 1
    assert not any("multiple_autoroad_connections" in w for w in out.warnings)


def _legacy_sorted_chain_km(req: NetworkPlanRequest) -> float:
    """Pre-quality baseline: midpoint links chained by distance from each terminal."""
    terminals = {t.id: t for t in req.terminals}
    ids = [t.id for t in req.terminals]
    dist = {
        a: {
            b: (
                0.0
                if a == b
                else haversine_km(
                    terminals[a].lon,
                    terminals[a].lat,
                    terminals[b].lon,
                    terminals[b].lat,
                )
            )
            for b in ids
        }
        for a in ids
    }
    edge_mid: dict[frozenset, tuple[float, float]] = {}
    term_edges: dict = {i: [] for i in ids}
    for a, b in mst_terminal_edges(ids, dist):
        ek = frozenset((a, b))
        ta, tb = terminals[a], terminals[b]
        edge_mid[ek] = geodesic_midpoint(ta.lon, ta.lat, tb.lon, tb.lat)
        term_edges[a].append(ek)
        term_edges[b].append(ek)
    total = 0.0
    seen: set[tuple] = set()
    for tid in ids:
        t = terminals[tid]
        keys = term_edges[tid]
        if len(keys) >= 2:
            ordered = sorted(
                keys,
                key=lambda ek: haversine_km(
                    t.lon, t.lat, edge_mid[ek][0], edge_mid[ek][1]
                ),
            )
            for i in range(len(ordered) - 1):
                ek1, ek2 = ordered[i], ordered[i + 1]
                pair = tuple(sorted((tuple(sorted(ek1)), tuple(sorted(ek2)))))
                if pair in seen:
                    continue
                seen.add(pair)
                m1, m2 = edge_mid[ek1], edge_mid[ek2]
                total += haversine_km(m1[0], m1[1], m2[0], m2[1])
        best = min(
            (edge_mid[ek] for ek in keys),
            key=lambda m: haversine_km(t.lon, t.lat, m[0], m[1]),
        )
        total += haversine_km(t.lon, t.lat, best[0], best[1])
    return total


def _connector_finish_coords(out) -> set[tuple[float, float]]:
    ends: set[tuple[float, float]] = set()
    for ln in out.new_lines:
        if ln.kind == "connector" and len(ln.coordinates) >= 2:
            c = ln.coordinates[-1]
            ends.add((round(c[0], 6), round(c[1], 6)))
    return ends


def test_plan_rejects_node_cluster():
    t1 = uuid4()
    t2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=t1, subtype="node", name="U1", lon=37.6, lat=55.75),
            PlanTerminalInput(id=t2, subtype="gas_processing", name="G1", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert "excluded_terminal_subtype" in "".join(out.warnings)


def test_plan_two_terminals_no_road_single_link():
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_lines) == 1
    link = out.new_lines[0]
    assert link.kind == "link"
    assert link.snap_start_object_id == p1
    assert link.snap_finish_object_id == p2
    assert len(out.new_nodes) == 2
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_three_terminals_off_network_steiner_mst():
    p1 = uuid4()
    p2 = uuid4()
    p3 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.75),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_nodes) >= 2
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    links = [ln for ln in out.new_lines if ln.kind == "link"]
    assert len(connectors) == 3
    assert len(links) >= 1
    assert len(_connector_finish_coords(out)) >= 2
    object_links = [
        ln
        for ln in out.new_lines
        if ln.kind == "link"
        and (ln.snap_start_object_id or ln.snap_finish_object_id)
    ]
    assert not object_links
    _assert_one_autoroad_per_terminal(out, [p1, p2, p3])
    assert "terminals_not_connected" not in out.warnings


def test_plan_four_terminals_off_network_steiner_mst():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=ids[1], subtype="refinery", name="B", lon=37.64, lat=55.76),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="C", lon=37.64, lat=55.74),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="D", lon=37.60, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_nodes) >= 3
    assert len([ln for ln in out.new_lines if ln.kind == "connector"]) == 4
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 2
    assert len(_connector_finish_coords(out)) >= 2
    _assert_one_autoroad_per_terminal(out, ids)


def test_plan_spread_three_steiner_not_single_hub():
    """MST tree uses several junctions, not one hub for all connectors."""
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.76),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(_connector_finish_coords(out)) >= 2
    assert len(out.new_nodes) >= 2
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 1


def test_plan_collinear_three_uses_backbone_not_central_hub():
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.75),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_nodes) >= 2
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 1
    assert len(_connector_finish_coords(out)) >= 2


def test_collinear_three_shorter_than_naive_chain():
    p1, p2, p3 = uuid4(), uuid4(), uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.62, lat=55.75),
            PlanTerminalInput(id=p3, subtype="oil_pad", name="C", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    legacy = _legacy_sorted_chain_km(req)
    assert out.total_new_km < legacy
    assert "terminals_not_connected" not in out.warnings


def test_y_shape_four_midpoint_mst_shorter_than_chain():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="refinery", name="H", lon=37.62, lat=55.75),
            PlanTerminalInput(id=ids[1], subtype="gas_processing", name="W", lon=37.60, lat=55.75),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="NE", lon=37.63, lat=55.76),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="SE", lon=37.63, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert out.total_new_km <= _legacy_sorted_chain_km(req)
    assert len([ln for ln in out.new_lines if ln.kind == "link"]) >= 2


def _link_endpoints(ln) -> tuple[tuple[float, float], tuple[float, float]]:
    a = ln.coordinates[0]
    b = ln.coordinates[-1]
    return (round(a[0], 5), round(a[1], 5)), (round(b[0], 5), round(b[1], 5))


def test_y_shape_uses_hub_not_direct_mid_chord():
    """Degree-3 terminal: star from hub junction, no chord between edge midpoints."""
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="refinery", name="H", lon=37.62, lat=55.75),
            PlanTerminalInput(id=ids[1], subtype="gas_processing", name="W", lon=37.50, lat=55.75),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="NE", lon=37.74, lat=55.75),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="SE", lon=37.62, lat=55.63),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    hub_nodes = [n for n in out.new_nodes if n.reason == "hub_junction"]
    assert len(hub_nodes) >= 1
    edge_mids = {
        (round(n.lon, 5), round(n.lat, 5)) for n in out.new_nodes if n.reason == "junction"
    }
    for ln in out.new_lines:
        if ln.kind != "link":
            continue
        a, b = _link_endpoints(ln)
        if a in edge_mids and b in edge_mids:
            raise AssertionError("direct link between two edge midpoints without hub")


def test_t_junction_attachment_has_junction_node():
    """Connector to backbone interior gets a junction and splits the backbone."""
    ids = [uuid4() for _ in range(5)]
    terminals = [
        PlanTerminalInput(
            id=ids[i],
            subtype="gas_processing",
            name=f"T{i}",
            lon=37.60 + i * 0.02,
            lat=55.75,
        )
        for i in range(5)
    ]
    out = plan_from_request(
        NetworkPlanRequest(
            project_id=uuid4(),
            terminals=terminals,
            existing_autoroads=[],
        )
    )
    mid_id = ids[2]
    mid_conn = next(
        ln
        for ln in out.new_lines
        if ln.kind == "connector" and ln.snap_start_object_id == mid_id
    )
    fin = mid_conn.coordinates[-1]
    node_at = [
        n
        for n in out.new_nodes
        if haversine_km(n.lon, n.lat, fin[0], fin[1]) < 0.02
    ]
    assert node_at, "connector finish must have a junction node"

    def _endpoint_degree(lon: float, lat: float) -> int:
        deg = 0
        for ln in out.new_lines:
            if len(ln.coordinates) < 2:
                continue
            for pt in (ln.coordinates[0], ln.coordinates[-1]):
                if haversine_km(pt[0], pt[1], lon, lat) < 0.02:
                    deg += 1
        return deg

    assert _endpoint_degree(fin[0], fin[1]) >= 3, (
        "T-attachment needs connector plus two backbone link ends"
    )
    assert "terminals_not_connected" not in out.warnings


def test_collinear_chain_fourteen_few_links():
    ids = [uuid4() for _ in range(14)]
    terminals = [
        PlanTerminalInput(
            id=ids[i],
            subtype="gas_processing",
            name=f"T{i}",
            lon=37.60 + i * 0.01,
            lat=55.75,
        )
        for i in range(14)
    ]
    out = plan_from_request(req := NetworkPlanRequest(
        project_id=uuid4(), terminals=terminals, existing_autoroads=[]
    ))
    links = [ln for ln in out.new_lines if ln.kind == "link"]
    assert len(links) <= 15
    assert out.total_new_km < _legacy_sorted_chain_km(req) * 1.05


def test_hub_junction_bend_angle_reasonable():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="refinery", name="H", lon=37.62, lat=55.75),
            PlanTerminalInput(id=ids[1], subtype="gas_processing", name="W", lon=37.50, lat=55.75),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="NE", lon=37.74, lat=55.75),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="SE", lon=37.62, lat=55.63),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert any(n.reason == "hub_junction" for n in out.new_nodes)
    hub_links = sum(
        1
        for ln in out.new_lines
        if ln.kind == "link"
        and any(
            abs(ln.coordinates[0][0] - n.lon) < 1e-4
            for n in out.new_nodes
            if n.reason == "hub_junction"
        )
    )
    assert hub_links >= 3


def test_four_corners_total_km_improves():
    ids = [uuid4() for _ in range(4)]
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=ids[0], subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=ids[1], subtype="refinery", name="B", lon=37.64, lat=55.76),
            PlanTerminalInput(id=ids[2], subtype="oil_pad", name="C", lon=37.64, lat=55.74),
            PlanTerminalInput(id=ids[3], subtype="methanol_facility", name="D", lon=37.60, lat=55.74),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert out.total_new_km < _legacy_sorted_chain_km(req)
    assert out.total_new_km <= 7.25


def test_plan_three_terminals_on_road_spurs_only():
    road_id = uuid4()
    p_a = uuid4()
    p_hub = uuid4()
    p_c = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p_a, subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=p_hub, subtype="refinery", name="Hub", lon=37.62, lat=55.751),
            PlanTerminalInput(id=p_c, subtype="oil_pad", name="C", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    object_links = [
        ln
        for ln in out.new_lines
        if ln.kind == "link"
        and (ln.snap_start_object_id or ln.snap_finish_object_id)
    ]
    assert not object_links
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    assert len(connectors) == 3
    _assert_one_autoroad_per_terminal(out, [p_a, p_hub, p_c])


def test_plan_two_terminals_on_road_uses_graph():
    road_id = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.75),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    assert len(out.used_existing_edge_ids) >= 1
    assert not any(ln.kind == "link" for ln in out.new_lines)
    assert all(t.warning == "already_connected" for t in out.terminals)
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_two_on_road_no_duplicate_connectors():
    road_id = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.751),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.751),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    assert len(connectors) == 2
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_disconnected_network_bridge_between_snaps():
    road_a = uuid4()
    road_b = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.76),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_a,
                coordinates=[[37.60, 55.75], [37.61, 55.75]],
            ),
            ExistingAutoroadInput(
                id=road_b,
                coordinates=[[37.63, 55.75], [37.64, 55.75]],
            ),
        ],
    )
    out = plan_from_request(req)
    network_links = [
        ln
        for ln in out.new_lines
        if ln.kind == "link" and not ln.snap_start_object_id and not ln.snap_finish_object_id
    ]
    assert len(network_links) == 1
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_far_from_road_still_gets_spur():
    road_id = uuid4()
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(id=p1, subtype="gas_processing", name="A", lon=37.60, lat=55.80),
            PlanTerminalInput(id=p2, subtype="refinery", name="B", lon=37.64, lat=55.75),
        ],
        existing_autoroads=[
            ExistingAutoroadInput(
                id=road_id,
                coordinates=[[37.60, 55.75], [37.64, 55.75]],
            )
        ],
    )
    out = plan_from_request(req)
    assert any(t.warning == "far_from_autoroad" for t in out.terminals if t.id == p1)
    connectors = [ln for ln in out.new_lines if ln.kind == "connector" and ln.snap_start_object_id == p1]
    assert len(connectors) == 1
    assert not any(
        ln.snap_start_object_id == p1 and ln.snap_finish_object_id == p2 for ln in out.new_lines
    )


def test_plan_methanol_facility_off_network_single_link():
    p1 = uuid4()
    p2 = uuid4()
    req = NetworkPlanRequest(
        project_id=uuid4(),
        terminals=[
            PlanTerminalInput(
                id=p1, subtype="methanol_facility", name="M1", lon=37.60, lat=55.75
            ),
            PlanTerminalInput(id=p2, subtype="gas_processing", name="G1", lon=37.64, lat=55.76),
        ],
        existing_autoroads=[],
    )
    out = plan_from_request(req)
    assert len(out.new_lines) == 1
    assert out.new_lines[0].snap_start_object_id == p1
    assert out.new_lines[0].snap_finish_object_id == p2


def test_build_connect_plan_integration():
    asyncio.run(_test_build_connect_integration())


async def _test_build_connect_integration():
    from app.core.database import async_session
    from app.core.security import get_password_hash
    from app.geo.geometry_utils import build_infra_geometry
    from app.models import InfrastructureLayer, InfrastructureObject, Project, User
    from app.models.enums import UserRole
    from app.services.autoroad_connect import build_autoroad_connect_plan

    async with async_session() as db:
        user = User(
            email=f"arn-{uuid4().hex[:8]}@test.ru",
            username="arn",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="arn", status="draft")
        db.add(project)
        await db.flush()
        layer = InfrastructureLayer(
            project_id=project.id,
            name="L",
            layer_type="vector",
            source_type="manual",
        )
        db.add(layer)
        await db.flush()
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name="road",
                subtype="autoroad",
                category="line",
                longitude=37.60,
                latitude=55.75,
                end_longitude=37.64,
                end_latitude=55.75,
                geometry=build_infra_geometry("autoroad", 37.60, 55.75, end_lon=37.64, end_lat=55.75),
            )
        )
        p1 = InfrastructureObject(
            layer_id=layer.id,
            name="A",
            subtype="gas_processing",
            category="point",
            longitude=37.60,
            latitude=55.75,
            geometry=build_infra_geometry("gas_processing", 37.60, 55.75),
        )
        p2 = InfrastructureObject(
            layer_id=layer.id,
            name="B",
            subtype="refinery",
            category="point",
            longitude=37.64,
            latitude=55.75,
            geometry=build_infra_geometry("refinery", 37.64, 55.75),
        )
        db.add_all([p1, p2])
        await db.flush()
        await db.commit()

        plan = await build_autoroad_connect_plan(db, project.id, [p1.id, p2.id])
        snapped = [t for t in plan.terminals if t.graph_node_id]
        assert len(snapped) >= 2
        assert not any(n.reason == "terminal_access" for n in plan.new_nodes)
