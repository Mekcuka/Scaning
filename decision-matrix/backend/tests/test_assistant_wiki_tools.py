"""Assistant wiki tools — registry execute_tool."""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select

from app.assistant import ToolContext, execute_tool
from app.core.database import async_session
from app.models import User
from tests.conftest import seed_role_users


@pytest.fixture(scope="module", autouse=True)
def _seed():
    asyncio.run(seed_role_users())


async def _ctx(email: str = "analyst@test.ru") -> ToolContext:
    async with async_session() as db:
        user = await db.scalar(select(User).where(User.email == email))
        assert user is not None
        return ToolContext(user=user, db=db, env="test")


def test_list_wiki_articles_tool():
    async def _run():
        ctx = await _ctx()
        result = await execute_tool("list_wiki_articles", {}, ctx)
        assert result.ok is True
        assert isinstance(result.data, list)
        assert len(result.data) >= 8

    asyncio.run(_run())


def test_search_wiki_tool():
    async def _run():
        ctx = await _ctx()
        result = await execute_tool(
            "search_wiki",
            {"query": "фоновые задачи"},
            ctx,
        )
        assert result.ok is True
        hits = result.data["hits"]
        assert any(h["slug"] == "background-jobs" for h in hits)

    asyncio.run(_run())


def test_get_wiki_article_tool():
    async def _run():
        ctx = await _ctx()
        result = await execute_tool(
            "get_wiki_article",
            {"slug": "assistant-chat"},
            ctx,
        )
        assert result.ok is True
        assert "AI-помощник" in result.data["body_markdown"]

    asyncio.run(_run())
