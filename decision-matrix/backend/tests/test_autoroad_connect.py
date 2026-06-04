"""Autoroad connect plan."""

import asyncio
from uuid import UUID, uuid4

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
            subtype="gas_processing",
            category="point",
            longitude=37.61,
            latitude=55.76,
            geometry=build_infra_geometry("gas_processing", 37.61, 55.76),
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


def test_apply_star_hub_preserves_junction_end():
    asyncio.run(_test_apply_star_hub_preserves_junction_end())


async def _test_apply_star_hub_preserves_junction_end():
    from sqlalchemy import select

    from app.services.autoroad_connect import apply_autoroad_connect_plan, build_autoroad_connect_plan
    from app.services.graph_builder import build_network_from_lines

    async with async_session() as db:
        user = User(
            email=f"arc3-{uuid4().hex[:8]}@test.ru",
            username="arc3",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="arc3", status="draft")
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
        p_hub = InfrastructureObject(
            layer_id=layer.id,
            name="Hub",
            subtype="refinery",
            category="point",
            longitude=37.62,
            latitude=55.751,
            geometry=build_infra_geometry("refinery", 37.62, 55.751),
        )
        p_a = InfrastructureObject(
            layer_id=layer.id,
            name="A",
            subtype="gas_processing",
            category="point",
            longitude=37.60,
            latitude=55.76,
            geometry=build_infra_geometry("gas_processing", 37.60, 55.76),
        )
        p_c = InfrastructureObject(
            layer_id=layer.id,
            name="C",
            subtype="oil_pad",
            category="point",
            longitude=37.64,
            latitude=55.76,
            geometry=build_infra_geometry("oil_pad", 37.64, 55.76),
        )
        db.add_all([p_hub, p_a, p_c])
        await db.flush()
        await build_network_from_lines(db, project.id)
        await db.commit()

        plan = await build_autoroad_connect_plan(db, project.id, [p_a.id, p_hub.id, p_c.id])
        assert any(n.reason == "junction" for n in plan.new_nodes)
        applied = await apply_autoroad_connect_plan(db, project.id, plan)
        await db.commit()

        roads = (
            await db.execute(
                select(InfrastructureObject).join(InfrastructureLayer).where(
                    InfrastructureLayer.project_id == project.id,
                    InfrastructureObject.subtype == "autoroad",
                    InfrastructureObject.id.in_([UUID(i) for i in applied["created_line_ids"]]),
                )
            )
        ).scalars().all()

        hub_lon, hub_lat = p_hub.longitude, p_hub.latitude
        hub_touching = 0
        for road in roads:
            at_start = abs(road.longitude - hub_lon) < 1e-6 and abs(road.latitude - hub_lat) < 1e-6
            at_end = (
                road.end_longitude is not None
                and abs(road.end_longitude - hub_lon) < 1e-6
                and abs(road.end_latitude - hub_lat) < 1e-6
            )
            if at_start or at_end:
                hub_touching += 1
        assert hub_touching == 1
