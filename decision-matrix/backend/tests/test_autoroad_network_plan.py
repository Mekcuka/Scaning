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


def _assert_one_autoroad_per_terminal(out, terminal_ids):
    for tid in terminal_ids:
        assert _object_snap_count(out.new_lines, tid) <= 1
    assert not any("multiple_autoroad_connections" in w for w in out.warnings)


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
    assert not out.new_nodes
    _assert_one_autoroad_per_terminal(out, [p1, p2])


def test_plan_three_terminals_off_network_mst():
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
    links = [ln for ln in out.new_lines if ln.kind == "link"]
    assert len(links) == 2
    _assert_one_autoroad_per_terminal(out, [p1, p2, p3])
    assert _object_snap_count(out.new_lines, p1) == 1
    assert _object_snap_count(out.new_lines, p3) == 1


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
