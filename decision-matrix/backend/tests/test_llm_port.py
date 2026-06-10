"""LlmClientPort DIP tests (SOLID phase 11)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.assistant.chat.llm_client import LlmResponse
from app.assistant.chat.ports.llm_port import HttpLlmClient, default_llm_client
from app.assistant.chat.schemas import ChatMessage, ChatRequest
from app.models import User
from app.models.enums import UserRole


def test_http_llm_client_delegates_chat_completion():
    client = HttpLlmClient()
    expected = LlmResponse(content="ok")

    async def _run():
        with patch(
            "app.assistant.chat.ports.llm_port.http_chat_completion",
            new_callable=AsyncMock,
            return_value=expected,
        ) as mock_http:
            result = await client.chat_completion([{"role": "user", "content": "hi"}])
        assert result is expected
        mock_http.assert_awaited_once()

    asyncio.run(_run())


def test_http_llm_client_delegates_probe():
    client = HttpLlmClient()

    async def _run():
        with patch(
            "app.assistant.chat.ports.llm_port.http_probe_provider",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_probe:
            ready = await client.probe_provider()
        assert ready is True
        mock_probe.assert_awaited_once()

    asyncio.run(_run())


def test_orchestrator_accepts_injected_llm_port():
    from app.assistant.chat.orchestrator import run_chat

    mock_client = AsyncMock()
    mock_client.chat_completion = AsyncMock(return_value=LlmResponse(content="injected"))

    user = User(
        id=1,
        email=f"u-{uuid4().hex[:8]}@test.ru",
        username="u_test",
        password_hash="x",
        role=UserRole.analyst.value,
    )
    request = ChatRequest(messages=[ChatMessage(role="user", content="hello")])

    async def _run():
        return await run_chat(user, None, request, llm_client=mock_client)

    response = asyncio.run(_run())

    assert response.message.content == "injected"
    mock_client.chat_completion.assert_awaited()


def test_default_llm_client_is_http_adapter():
    assert isinstance(default_llm_client, HttpLlmClient)
