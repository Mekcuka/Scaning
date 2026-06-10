"""Read-only domain tool proxy for dev stdio MCP."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from sqlalchemy import select

from app.assistant.context import ToolContext
from app.assistant.ports.tool_registry_port import default_tool_registry
from app.core.database import async_session
from app.models import User
from mcp.server.fastmcp import FastMCP


def _json_result(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)


async def _resolve_dev_user() -> User:
    email = os.environ.get("ASSISTANT_DEV_MCP_USER_EMAIL", "admin@test.ru").strip()
    async with async_session() as db:
        user = await db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
        if not user:
            raise RuntimeError(f"Dev MCP user not found: {email}")
        return user


async def _dev_execute_tool(name: str, arguments: dict[str, Any]) -> dict:
    user = await _resolve_dev_user()
    async with async_session() as db:
        ctx = ToolContext(user=user, db=db, env="development", tool_source="mcp")
        result = await default_tool_registry.execute_tool(name, arguments, ctx)
    return result.model_dump()


def _run_async(coro):
    return asyncio.run(coro)


def register_readonly_domain_tools(mcp: FastMCP) -> int:
    """Register non-mutating domain tools from the shared registry. Returns count."""

    async def _metas():
        user = await _resolve_dev_user()
        async with async_session() as db:
            ctx = ToolContext(user=user, db=db, env="development", tool_source="mcp")
            return [m for m in default_tool_registry.list_tools(ctx) if not m.mutating]

    metas = _run_async(_metas())
    for meta in metas:
        def _make_handler(name: str, description: str):
            def handler(**kwargs: Any) -> str:
                args = {k: v for k, v in kwargs.items() if v is not None}
                return _json_result(_run_async(_dev_execute_tool(name, args)))

            handler.__name__ = name
            handler.__doc__ = description
            return handler

        mcp.tool(name=meta.name, description=meta.description)(
            _make_handler(meta.name, meta.description)
        )
    return len(metas)
