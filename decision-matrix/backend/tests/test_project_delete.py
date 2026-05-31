"""Cascade delete for projects."""

import asyncio

import pytest
from sqlalchemy import select

from app.core.database import async_session
from app.core.security import get_password_hash
from app.geo.geometry_utils import point_wkt
from app.models import (
    ImportConnection,
    InfrastructureLayer,
    OnePager,
    PointOfInterest,
    Project,
    User,
)
from app.models.enums import UserRole
from app.services.project_delete import delete_project_cascade


async def _seed_project_with_children() -> str:
    async with async_session() as db:
        user = User(
            email="delete-cascade@test.ru",
            username="delete_user",
            password_hash=get_password_hash("password1"),
            role=UserRole.analyst.value,
        )
        db.add(user)
        await db.flush()

        project = Project(user_id=user.id, name="test_delete_cascade", status="draft")
        db.add(project)
        await db.flush()

        layer = InfrastructureLayer(
            project_id=project.id,
            name="L1",
            layer_type="vector",
            source_type="manual",
        )
        db.add(layer)
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
        db.add(
            OnePager(
                project_id=project.id,
                poi_id=poi.id,
                title="Test one-pager",
            )
        )
        db.add(
            ImportConnection(
                user_id=user.id,
                project_id=project.id,
                name="conn",
                api_url="https://example.com/api",
                auth_type="none",
            )
        )
        await db.commit()
        return str(project.id)


def test_delete_project_cascade_removes_children():
    asyncio.run(_test_delete_project_cascade_removes_children())


async def _test_delete_project_cascade_removes_children():
    project_id = await _seed_project_with_children()

    async with async_session() as db:
        from uuid import UUID

        pid = UUID(project_id)
        deleted = await delete_project_cascade(db, pid)
        await db.commit()
        assert deleted is True

        assert await db.get(Project, pid) is None
        layers = (
            await db.execute(
                select(InfrastructureLayer).where(InfrastructureLayer.project_id == pid)
            )
        ).scalars().all()
        assert layers == []
        pois = (
            await db.execute(select(PointOfInterest).where(PointOfInterest.project_id == pid))
        ).scalars().all()
        assert pois == []
        ops = (await db.execute(select(OnePager).where(OnePager.project_id == pid))).scalars().all()
        assert ops == []
        conns = (
            await db.execute(select(ImportConnection).where(ImportConnection.project_id == pid))
        ).scalars().all()
        assert conns == []


def test_delete_project_cascade_unknown_id():
    from uuid import uuid4

    async def _run():
        async with async_session() as db:
            ok = await delete_project_cascade(db, uuid4())
            assert ok is False

    asyncio.run(_run())
