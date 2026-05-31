"""import_rows_to_layer unit tests."""

import asyncio
from sqlalchemy import select

from app.core.database import async_session
from app.core.security import get_password_hash
from app.models import InfrastructureLayer, Project, User
from app.models.enums import UserRole
from app.services.import_service import import_rows_to_layer


def test_import_rows_to_layer_point_happy_path():
    asyncio.run(_test_import_rows_to_layer_point_happy_path())


async def _test_import_rows_to_layer_point_happy_path():
    async with async_session() as db:
        user = User(
            email="import-rows@test.ru",
            username="import_rows",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="test_import_rows", status="draft")
        db.add(project)
        await db.flush()
        layer = InfrastructureLayer(
            project_id=project.id,
            name="import",
            layer_type="vector",
            source_type="manual",
        )
        db.add(layer)
        await db.flush()

        from app.geo.geometry_utils import build_infra_geometry

        geom = build_infra_geometry("gas_processing", 37.6, 55.75)
        rows = [
            {
                "name": "Imported point",
                "subtype": "gas_processing",
                "lon": 37.6,
                "lat": 55.75,
                "end_lon": None,
                "end_lat": None,
                "geometry": geom,
                "category": "point",
                "properties": {},
            }
        ]
        count, errors = await import_rows_to_layer(db, layer, rows, skip_line_endpoint_validation=True)
        await db.commit()
        assert count == 1
        assert errors == []

        from app.models import InfrastructureObject

        objs = (
            await db.execute(
                select(InfrastructureObject).where(InfrastructureObject.layer_id == layer.id)
            )
        ).scalars().all()
        assert len(objs) == 1


def test_import_rows_to_layer_skips_invalid_subtype():
    asyncio.run(_test_import_rows_to_layer_skips_invalid_subtype())


async def _test_import_rows_to_layer_skips_invalid_subtype():
    from app.geo.geometry_utils import build_infra_geometry

    async with async_session() as db:
        user = User(
            email="import-bad@test.ru",
            username="import_bad",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()
        project = Project(user_id=user.id, name="test_import_bad", status="draft")
        db.add(project)
        await db.flush()
        layer = InfrastructureLayer(
            project_id=project.id,
            name="import",
            layer_type="vector",
            source_type="manual",
        )
        db.add(layer)
        await db.flush()

        line_geom = build_infra_geometry("autoroad", 1.0, 2.0, end_lon=9.0, end_lat=10.0)
        count, errors = await import_rows_to_layer(
            db,
            layer,
            [
                {
                    "name": "badline",
                    "subtype": "autoroad",
                    "lon": 1.0,
                    "lat": 2.0,
                    "end_lon": 9.0,
                    "end_lat": 10.0,
                    "geometry": line_geom,
                    "category": "line",
                    "properties": {},
                }
            ],
            skip_line_endpoint_validation=False,
        )
        assert count == 0
        assert errors
