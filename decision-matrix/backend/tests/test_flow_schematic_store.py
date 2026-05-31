"""flow_schematic_store round-trip tests."""

import asyncio

from sqlalchemy import select

from app.core.database import async_session
from app.geo.geometry_utils import point_wkt
from app.core.security import get_password_hash
from app.models import PointOfInterest, Project, User
from app.models.enums import UserRole
from app.services.flow_schematic_store import get_flow_schematic, save_flow_schematic


def test_flow_schematic_save_and_reload():
    asyncio.run(_test_flow_schematic_save_and_reload())


async def _test_flow_schematic_save_and_reload():
    async with async_session() as db:
        user = User(
            email="flow-store@test.ru",
            username="flow_store",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="test_flow_store", status="draft")
        db.add(project)
        await db.flush()
        poi = PointOfInterest(
            project_id=project.id,
            name="POI",
            longitude=37.6,
            latitude=55.75,
            geometry=point_wkt(37.6, 55.75),
            fluid_type="oil",
        )
        db.add(poi)
        await db.flush()

        saved = await save_flow_schematic(
            db,
            poi,
            [{"id": "n1", "kind": "poi", "label": "POI"}],
            [],
        )
        await db.commit()
        assert saved["nodes"]

        poi_db = await db.scalar(select(PointOfInterest).where(PointOfInterest.id == poi.id))
        assert poi_db is not None
        loaded = await get_flow_schematic(db, project.id, poi_db)
        assert loaded["source"] in ("layout", "merged", "auto")
