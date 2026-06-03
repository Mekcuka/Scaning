"""Autoroad network planner (stateless)."""

import asyncio
from uuid import uuid4

from app.services.autoroad_network.access_nodes import destination_toward_km
from app.services.autoroad_network.plan_core import plan_from_request
from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    PlanTerminalInput,
)
from app.services.road_graph import haversine_km


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


def test_plan_two_terminals_no_road_builds_access_topology():
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
    assert "insufficient_snapped_terminals" not in out.warnings
    access_nodes = [n for n in out.new_nodes if n.reason == "terminal_access"]
    assert len(access_nodes) == 2
    connectors = [ln for ln in out.new_lines if ln.kind == "connector"]
    assert len(connectors) == 2
    link = next(ln for ln in out.new_lines if ln.kind == "link")
    assert link.snap_start_terminal_id == p1
    assert link.snap_finish_terminal_id == p2
    assert link.snap_start_object_id is None
    assert link.snap_finish_object_id is None
    t1 = next(tr for tr in out.terminals if tr.id == p1)
    dist = haversine_km(37.60, 55.75, t1.access_lon, t1.access_lat)
    assert 0.045 <= dist <= 0.055


def test_access_node_offset_50m():
    lon, lat = 37.60, 55.75
    target_lon, target_lat = 37.64, 55.76
    alon, alat = destination_toward_km(lon, lat, target_lon, target_lat, 0.05)
    assert 0.045 <= haversine_km(lon, lat, alon, alat) <= 0.055


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
    attached = [t for t in out.terminals if t.graph_attached]
    assert len(attached) >= 2
    assert len(out.used_existing_edge_ids) >= 1
    assert not any(ln.kind == "link" for ln in out.new_lines)
    assert len([n for n in out.new_nodes if n.reason == "terminal_access"]) == 2


def test_plan_methanol_facility_has_access_node():
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
    assert any(n.reason == "terminal_access" and n.terminal_id == p1 for n in out.new_nodes)


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
        assert len([n for n in plan.new_nodes if n.reason == "terminal_access"]) == 2
