"""Category-based assistant tool routing (phase 7.1)."""

from __future__ import annotations

import asyncio

import pytest

from sqlalchemy import select

from app.assistant import ToolContext, list_tools
from app.assistant.chat.schemas import ChatMessage, ChatRequest
from app.assistant.chat.tool_router import select_tools_for_chat
from app.core.config import settings
from app.core.database import async_session
from app.models import User
from tests.conftest import seed_role_users


@pytest.fixture(scope="module", autouse=True)
def _seed():
    asyncio.run(seed_role_users())


async def _ctx(email: str) -> ToolContext:
    async with async_session() as db:
        user = await db.scalar(select(User).where(User.email == email))
        assert user is not None
        return ToolContext(user=user, db=db, env="test")


def _names(request: ChatRequest, email: str = "analyst@test.ru") -> set[str]:
    async def _run() -> set[str]:
        ctx = await _ctx(email)
        return {t.name for t in select_tools_for_chat(request, ctx)}

    return asyncio.run(_run())


def test_router_projects_keyword_includes_list_projects():
    request = ChatRequest(messages=[ChatMessage(role="user", content="Сколько проектов?")])
    names = _names(request)
    assert "list_projects" in names
    assert len(names) <= settings.ASSISTANT_CHAT_MAX_ROUTED_TOOLS


def test_router_map_tab_includes_infra_tools():
    from uuid import uuid4

    request = ChatRequest(
        messages=[ChatMessage(role="user", content="покажи карту")],
        project_id=uuid4(),
        active_tab="map",
    )
    names = _names(request)
    assert "list_infra_objects" in names


def test_router_admin_tools_hidden_for_analyst():
    request = ChatRequest(messages=[ChatMessage(role="user", content="admin users list")])
    names = _names(request)
    assert "admin_list_users" not in names


def test_router_rates_tab():
    from uuid import uuid4

    request = ChatRequest(
        messages=[ChatMessage(role="user", content="тарифы")],
        project_id=uuid4(),
        active_tab="parameters/rates",
    )
    names = _names(request)
    assert "get_cost_rates" in names


def test_router_core_set_without_project():
    request = ChatRequest(messages=[ChatMessage(role="user", content="привет")])
    names = _names(request)
    assert "list_projects" in names
    assert "get_me" in names


def test_list_tools_still_returns_full_registry():
    async def _run() -> int:
        ctx = await _ctx("analyst@test.ru")
        return len(list_tools(ctx))

    total = asyncio.run(_run())
    assert total >= 20
