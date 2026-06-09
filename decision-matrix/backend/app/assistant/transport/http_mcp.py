"""Streamable HTTP MCP bridge — delegates list_tools / call_tool to the shared registry."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterable, Sequence
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.types import Resource as MCPResource, TextContent, Tool as MCPTool
from pydantic import AnyUrl
from starlette.types import ASGIApp

from app.assistant.context import ToolContext, ToolEnv
from app.assistant.registry import execute_tool, get_tool, list_tools as registry_list_tools
from app.assistant.schemas import ToolResult
from app.assistant.transport.auth import McpAuthMiddleware, require_mcp_user
from app.assistant.transport.resources import list_mcp_resources, read_mcp_resource
from app.core.config import settings
from app.core.database import async_session

_mcp: AtlasGridMCP | None = None

_MCP_CONFIRM_REQUIRED_MSG = (
    "Mutating tools require confirmation in the web assistant chat (AI-помощник panel). "
    "HTTP MCP supports read-only tools only."
)


def _tool_env() -> ToolEnv:
    env = settings.ENVIRONMENT
    if env in ("development", "staging", "production", "test"):
        return env  # type: ignore[return-value]
    return "development"


class AtlasGridMCP(FastMCP):
    async def list_tools(self) -> list[MCPTool]:
        user = require_mcp_user()
        async with async_session() as db:
            ctx = ToolContext(user=user, db=db, env=_tool_env(), tool_source="mcp")
            metas = registry_list_tools(ctx)
        return [
            MCPTool(name=m.name, description=m.description, inputSchema=m.input_schema)
            for m in metas
        ]

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Sequence[TextContent]:
        user = require_mcp_user()
        defn = get_tool(name)
        if defn and defn.mutating:
            result = ToolResult(ok=False, error=_MCP_CONFIRM_REQUIRED_MSG, code="confirm_required")
            return [TextContent(type="text", text=json.dumps(result.model_dump(), ensure_ascii=False))]
        async with async_session() as db:
            ctx = ToolContext(user=user, db=db, env=_tool_env(), tool_source="mcp")
            result = await execute_tool(name, arguments or {}, ctx)
        return [TextContent(type="text", text=json.dumps(result.model_dump(), ensure_ascii=False))]

    async def list_resources(self) -> list[MCPResource]:
        require_mcp_user()
        return list_mcp_resources()

    async def read_resource(self, uri: AnyUrl | str) -> Iterable[ReadResourceContents]:
        require_mcp_user()
        text, mime_type = read_mcp_resource(str(uri))
        return [ReadResourceContents(content=text, mime_type=mime_type)]


def _get_mcp() -> AtlasGridMCP:
    global _mcp
    if _mcp is None:
        _mcp = AtlasGridMCP(
            "Atlas Grid",
            stateless_http=True,
            json_response=True,
            streamable_http_path="/",
            transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
        )
    return _mcp


def create_mcp_asgi_app() -> ASGIApp:
    inner = _get_mcp().streamable_http_app()
    return McpAuthMiddleware(inner)


@asynccontextmanager
async def mcp_lifespan() -> AsyncIterator[None]:
    mcp = _get_mcp()
    mcp.streamable_http_app()
    async with mcp.session_manager.run():
        yield


def reset_mcp_singleton() -> None:
    """Reset lazy MCP instance (pytest: fresh session manager per TestClient)."""
    global _mcp
    _mcp = None


def mount_assistant_mcp(app: FastAPI) -> None:
    if not settings.ASSISTANT_MCP_ENABLED:
        return
    mcp_asgi = create_mcp_asgi_app()
    path = settings.ASSISTANT_MCP_PATH.rstrip("/")
    # Trailing slash mount — bare path 307 redirect drops Authorization in some MCP clients (Cursor).
    app.mount(path + "/", mcp_asgi)
