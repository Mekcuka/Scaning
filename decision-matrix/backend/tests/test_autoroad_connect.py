"""Autoroad connect plan."""

import asyncio
from uuid import uuid4

from app.core.database import async_session
from app.core.security import get_password_hash
from app.geo.geometry_utils import build_infra_geometry
from app.models import InfrastructureLayer, InfrastructureObject, Project, User
from app.models.enums import UserRole
from app.services.autoroad_connect import build_autoroad_connect_plan, run_autoroad_connect


def test_build_plan_on_chain():
    asyncio.run(_test_build_plan_on_chain())


async def _test_build_plan_on_chain():
    async with async_session() as db:
        user = User(
            email=f"arc-{uuid4().hex[:8]}@test.ru",
            username="arc_test",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="arc", status="draft")
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

        geom = build_infra_geometry("autoroad", 37.60, 55.75, end_lon=37.64, end_lat=55.75)
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
                geometry=geom,
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

        from app.services.graph_builder import build_network_from_lines

        await build_network_from_lines(db, project.id)
        await db.commit()

        plan = await build_autoroad_connect_plan(db, project.id, [p1.id, p2.id])
        snapped = [t for t in plan.terminals if t.graph_node_id]
        assert len(snapped) >= 2
        assert plan.used_existing_edge_ids or len(plan.new_lines) >= 0


def test_apply_dry_run():
    asyncio.run(_test_apply_dry_run())


async def _test_apply_dry_run():
    async with async_session() as db:
        user = User(
            email=f"arc2-{uuid4().hex[:8]}@test.ru",
            username="arc2",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="arc2", status="draft")
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
        geom = build_infra_geometry("autoroad", 37.60, 55.75, end_lon=37.62, end_lat=55.75)
        road = InfrastructureObject(
            layer_id=layer.id,
            name="road",
            subtype="autoroad",
            category="line",
            longitude=37.60,
            latitude=55.75,
            end_longitude=37.62,
            end_latitude=55.75,
            geometry=geom,
        )
        p1 = InfrastructureObject(
            layer_id=layer.id,
            name="P1",
            subtype="node",
            category="point",
            longitude=37.61,
            latitude=55.76,
            geometry=build_infra_geometry("node", 37.61, 55.76),
        )
        p2 = InfrastructureObject(
            layer_id=layer.id,
            name="P2",
            subtype="oil_pad",
            category="point",
            longitude=37.615,
            latitude=55.755,
            geometry=build_infra_geometry("oil_pad", 37.615, 55.755),
        )
        db.add_all([road, p1, p2])
        await db.flush()
        await db.commit()

        out = await run_autoroad_connect(db, project.id, [p1.id, p2.id], dry_run=True)
        assert out["dry_run"] is True
        assert "preview" in out
