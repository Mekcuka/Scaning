"""LLM provider port — DIP boundary for orchestrator and status endpoints."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Protocol

from app.assistant.chat.llm_client import (
    LlmResponse,
    LlmStreamChunk,
    chat_completion as http_chat_completion,
    chat_completion_stream as http_chat_completion_stream,
    probe_provider as http_probe_provider,
)


class LlmClientPort(Protocol):
    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
    ) -> LlmResponse: ...

    def chat_completion_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[LlmStreamChunk]: ...

    async def probe_provider(self) -> bool: ...


class HttpLlmClient:
    """Production adapter — httpx calls to LM Studio / OpenAI-compatible API."""

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
    ) -> LlmResponse:
        return await http_chat_completion(messages, tools=tools)

    async def chat_completion_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[LlmStreamChunk]:
        async for chunk in http_chat_completion_stream(messages, tools=tools):
            yield chunk

    async def probe_provider(self) -> bool:
        return await http_probe_provider()


default_llm_client: LlmClientPort = HttpLlmClient()
