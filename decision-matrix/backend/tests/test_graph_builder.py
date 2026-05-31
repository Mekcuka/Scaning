"""graph_builder unit smoke test."""

import asyncio

from app.core.database import async_session
from app.core.security import get_password_hash
from app.models import InfrastructureLayer, InfrastructureObject, Project, User
from app.models.enums import UserRole
from app.geo.geometry_utils import build_infra_geometry
from app.services.graph_builder import build_network_from_lines


def test_build_network_from_single_line():
    asyncio.run(_test_build_network_from_single_line())


async def _test_build_network_from_single_line():
    async with async_session() as db:
        user = User(
            email="graph-build@test.ru",
            username="graph_build",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="test_graph", status="draft")
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
        geom = build_infra_geometry("autoroad", 37.6, 55.75, end_lon=37.62, end_lat=55.77)
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name="road",
                subtype="autoroad",
                category="line",
                longitude=37.6,
                latitude=55.75,
                end_longitude=37.62,
                end_latitude=55.77,
                geometry=geom,
            )
        )
        await db.flush()

        net = await build_network_from_lines(db, project.id)
        await db.commit()
        assert net.project_id == project.id
