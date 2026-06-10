"""User-facing assistant text — no UUIDs in answers."""

from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

from sqlalchemy import select

from app.assistant.chat.poi_resolve import find_poi_by_name, normalize_poi_lookup_name
from app.assistant.chat.schemas import ChatMessage, ChatRequest
from app.assistant.chat.user_text import humanize_user_facing_text
from app.assistant.context import ToolContext
from app.assistant.chat.tool_payload import resolve_tool_arguments
from app.core.database import async_session
from app.models import PointOfInterest, Project, User
from app.services.spatial import point_wkt
from tests.conftest import seed_role_users


def test_humanize_strips_uuid_and_uses_names():
    poi_id = str(uuid4())
    project_id = str(uuid4())
    text = f"POI {poi_id} в проекте {project_id}."
    out = humanize_user_facing_text(
        text,
        request=ChatRequest(
            messages=[ChatMessage(role="user", content="x")],
            project_id=UUID(project_id),
            project_name="Демо",
            selected_poi_id=UUID(poi_id),
            selected_poi_name="Точка_1",
        ),
    )
    assert poi_id not in out
    assert project_id not in out
    assert "Точка_1" in out
    assert "Демо" in out


def test_normalize_poi_lookup_name_variants():
    assert normalize_poi_lookup_name("ТОЧКА_1") == normalize_poi_lookup_name("точка 1")
    assert normalize_poi_lookup_name("Точка-1") == "точка_1"


def test_resolve_tool_arguments_accepts_poi_name_variants():
    asyncio.run(seed_role_users())

    async def _run():
        async with async_session() as db:
            user = await db.scalar(select(User).where(User.email == "analyst@test.ru"))
            assert user is not None
            project = Project(user_id=user.id, name="name resolve", status="draft")
            db.add(project)
            await db.flush()
            poi = PointOfInterest(
                project_id=project.id,
                name="Точка_1",
                longitude=50.0,
                latitude=60.0,
                geometry=point_wkt(50.0, 60.0),
            )
            db.add(poi)
            await db.commit()

            found = await find_poi_by_name(db, project.id, "ТОЧКА_1")
            assert found is not None
            assert found.id == poi.id

            ctx = ToolContext(user=user, db=db, env={}, tool_source="chat")
            request = ChatRequest(
                messages=[ChatMessage(role="user", content="электроснабжение")],
                project_id=project.id,
                selected_poi_id=poi.id,
                selected_poi_name="Точка_1",
            )
            resolved = await resolve_tool_arguments(
                ctx,
                "get_poi",
                {"project_id": str(project.id), "poi_id": "точка 1"},
                request,
            )
            assert resolved["poi_id"] == str(poi.id)

    asyncio.run(_run())
