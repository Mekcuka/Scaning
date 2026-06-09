"""Assistant audit log tests."""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select

from app.assistant import ToolContext, execute_tool
from app.assistant.audit import hash_tool_args, list_audit_entries
from app.core.database import async_session
from app.models import AssistantAuditLog, User
from tests.conftest import seed_role_users


@pytest.fixture(scope="module", autouse=True)
def _seed():
    asyncio.run(seed_role_users())


def test_hash_tool_args_stable():
    h1 = hash_tool_args({"project_id": "abc", "limit": 10})
    h2 = hash_tool_args({"limit": 10, "project_id": "abc"})
    assert h1 == h2
    assert len(h1) == 64


def test_execute_tool_writes_audit():
    async def _run():
        async with async_session() as db:
            user = await db.scalar(select(User).where(User.email == "analyst@test.ru"))
            assert user
            ctx = ToolContext(user=user, db=db, env="test", tool_source="chat")
            before = await db.scalar(select(AssistantAuditLog.id).limit(1))
            result = await execute_tool("get_me", {}, ctx)
            assert result.ok is True
            rows = await list_audit_entries(db, limit=5, tool_name="get_me")
            assert rows
            latest = rows[0]
            assert latest.tool_name == "get_me"
            assert latest.ok is True
            assert latest.source == "chat"
            assert latest.user_id == user.id

    asyncio.run(_run())


def test_admin_list_assistant_audit_tool():
    async def _run():
        async with async_session() as db:
            admin = await db.scalar(select(User).where(User.email == "admin@test.ru"))
            assert admin
            ctx = ToolContext(user=admin, db=db, env="test", tool_source="mcp")
            result = await execute_tool("admin_list_assistant_audit", {"limit": 5}, ctx)
            assert result.ok is True
            assert "items" in result.data
            assert "count" in result.data

    asyncio.run(_run())
