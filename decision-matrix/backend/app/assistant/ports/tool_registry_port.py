"""Tool registry port — DIP boundary for chat, MCP, and dev stdio."""

from __future__ import annotations

from typing import Any, Protocol

from app.assistant.context import ToolContext
from app.assistant.registry import (
    execute_tool as registry_execute_tool,
    get_tool as registry_get_tool,
    list_tools as registry_list_tools,
)
from app.assistant.schemas import ToolMeta, ToolResult
from app.assistant.tools.base import ToolDefinition


class ToolRegistryPort(Protocol):
    def get_tool(self, name: str) -> ToolDefinition | None: ...

    def list_tools(self, ctx: ToolContext) -> list[ToolMeta]: ...

    async def execute_tool(
        self, name: str, args: dict[str, Any], ctx: ToolContext
    ) -> ToolResult: ...


class DefaultToolRegistry:
    """Production adapter — shared in-process tool registry."""

    def get_tool(self, name: str) -> ToolDefinition | None:
        return registry_get_tool(name)

    def list_tools(self, ctx: ToolContext) -> list[ToolMeta]:
        return registry_list_tools(ctx)

    async def execute_tool(
        self, name: str, args: dict[str, Any], ctx: ToolContext
    ) -> ToolResult:
        return await registry_execute_tool(name, args, ctx)


default_tool_registry: ToolRegistryPort = DefaultToolRegistry()
