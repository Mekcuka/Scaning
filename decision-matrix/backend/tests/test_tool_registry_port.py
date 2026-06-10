"""ToolRegistryPort DIP tests (SOLID phase 12)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.assistant.chat.llm_client import LlmResponse, LlmToolCall
from app.assistant.chat.schemas import ChatMessage, ChatRequest
from app.assistant.ports.tool_registry_port import DefaultToolRegistry, default_tool_registry
from app.assistant.schemas import ToolResult
from app.models import User
from app.models.enums import UserRole


def test_default_tool_registry_delegates_get_tool():
    registry = DefaultToolRegistry()
    with patch(
        "app.assistant.ports.tool_registry_port.registry_get_tool",
        return_value=MagicMock(mutating=False),
    ) as mock_get:
        defn = registry.get_tool("list_projects")
    assert defn is not None
    mock_get.assert_called_once_with("list_projects")


def test_default_tool_registry_delegates_execute_tool():
    registry = DefaultToolRegistry()
    expected = ToolResult(ok=True, data={"items": []})
    ctx = MagicMock()

    async def _run():
        with patch(
            "app.assistant.ports.tool_registry_port.registry_execute_tool",
            new_callable=AsyncMock,
            return_value=expected,
        ) as mock_exec:
            result = await registry.execute_tool("list_projects", {}, ctx)
        assert result is expected
        mock_exec.assert_awaited_once()

    asyncio.run(_run())


def test_tool_loop_accepts_injected_registry():
    from app.assistant.chat.tool_loop import execute_llm_tool_calls

    mock_registry = MagicMock()
    mock_registry.get_tool.return_value = None
    mock_registry.execute_tool = AsyncMock(
        return_value=ToolResult(ok=True, data={"count": 3})
    )

    llm = LlmResponse(
        tool_calls=[LlmToolCall(id="c1", name="list_projects", arguments={})]
    )
    user = User(
        id=1,
        email=f"u-{uuid4().hex[:8]}@test.ru",
        username="u_test",
        password_hash="x",
        role=UserRole.analyst.value,
    )
    request = ChatRequest(messages=[ChatMessage(role="user", content="сколько проектов")])

    async def _run():
        events = []
        async for event in execute_llm_tool_calls(
            llm,
            ctx=MagicMock(),
            user=user,
            request=request,
            llm_thread=[],
            tool_summaries=[],
            tool_registry=mock_registry,
        ):
            events.append(event)
        return events

    events = asyncio.run(_run())

    assert any(e.kind == "tool_done" for e in events)
    mock_registry.execute_tool.assert_awaited_once()


def test_default_tool_registry_is_default_adapter():
    assert isinstance(default_tool_registry, DefaultToolRegistry)
