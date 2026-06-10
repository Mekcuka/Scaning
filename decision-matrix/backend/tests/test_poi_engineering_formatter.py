"""POI engineering formatter and get_poi tool."""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.assistant.chat.formatters.poi_engineering import match_poi_engineering
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary
from app.assistant.context import ToolContext
from app.assistant.poi_engineering import format_engineering_summary_ru
from app.assistant.tools.domain.projects import GetPoiInput, _get_poi
from app.core.database import async_session
from app.models import PointOfInterest, Project, User
from app.services.spatial import point_wkt
from tests.conftest import seed_role_users


def test_format_engineering_summary_single_field():
    text = format_engineering_summary_ru(
        {"name": "Точка_1", "eng_power": "external"},
        field="eng_power",
    )
    assert "Точка_1" in text
    assert "Внешнее" in text
    assert "Электроснабжение" in text


def test_match_poi_engineering_from_get_poi_cache():
    answer = match_poi_engineering(
        [ToolCallSummary(name="get_poi", ok=True)],
        {
            "get_poi": {
                "name": "Точка_1",
                "eng_power": "external",
                "eng_injection": "centralized",
            }
        },
        [ChatMessage(role="user", content="Какой тип электроснабжения у POI Точка_1?")],
        ChatRequest(messages=[ChatMessage(role="user", content="x")]),
    )
    assert answer is not None
    assert "Внешнее" in answer


def test_get_poi_tool_returns_engineering_labels():
    asyncio.run(seed_role_users())

    async def _run():
        async with async_session() as db:
            user = await db.scalar(select(User).where(User.email == "analyst@test.ru"))
            assert user is not None
            project = Project(user_id=user.id, name="eng test", status="draft")
            db.add(project)
            await db.flush()
            poi = PointOfInterest(
                project_id=project.id,
                name="T1",
                longitude=50.0,
                latitude=60.0,
                geometry=point_wkt(50.0, 60.0),
                eng_power="external",
            )
            db.add(poi)
            await db.commit()

            ctx = ToolContext(user=user, db=db, env={}, tool_source="chat")
            data = await _get_poi(ctx, GetPoiInput(project_id=project.id, poi_id=poi.id))
            assert data["engineering_labels_ru"]["eng_power"] == "Внешнее"

    asyncio.run(_run())
