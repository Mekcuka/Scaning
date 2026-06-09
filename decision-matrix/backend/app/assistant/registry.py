"""Shared tool registry — register, list, and execute domain tools."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ValidationError
from fastapi import HTTPException

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError, tool_error_from_http
from app.assistant.schemas import ToolMeta, ToolResult
from app.assistant.tools.base import ToolDefinition
from app.services.project_access import user_role

_REGISTRY: dict[str, ToolDefinition] = {}
_INITIALIZED = False


def register_tool(defn: ToolDefinition) -> None:
    if defn.name in _REGISTRY:
        raise ValueError(f"Duplicate tool name: {defn.name}")
    _REGISTRY[defn.name] = defn


def _ensure_initialized() -> None:
    global _INITIALIZED
    if _INITIALIZED:
        return
    from app.assistant.tools import register_all_tools

    register_all_tools()
    _INITIALIZED = True


def list_tools(ctx: ToolContext) -> list[ToolMeta]:
    _ensure_initialized()
    role = user_role(ctx.user)
    out: list[ToolMeta] = []
    for defn in _REGISTRY.values():
        if not defn.visible_for(role):
            continue
        out.append(
            ToolMeta(
                name=defn.name,
                description=defn.description,
                mutating=defn.mutating,
                input_schema=defn.input_model.model_json_schema(),
            )
        )
    return sorted(out, key=lambda m: m.name)


def _serialize_result(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_serialize_result(item) for item in value]
    if isinstance(value, dict):
        return value
    return value


async def execute_tool(name: str, args: dict[str, Any], ctx: ToolContext) -> ToolResult:
    _ensure_initialized()
    defn = _REGISTRY.get(name)
    if not defn:
        return ToolResult(ok=False, error=f"Unknown tool: {name}", code="not_found")
    role = user_role(ctx.user)
    if not defn.visible_for(role):
        return ToolResult(ok=False, error="Insufficient permissions for this tool", code="forbidden")
    try:
        parsed = defn.input_model.model_validate(args)
    except ValidationError as e:
        return ToolResult(ok=False, error=str(e), code="validation")
    try:
        data = await defn.handler(ctx, parsed)
        return ToolResult(ok=True, data=_serialize_result(data))
    except ToolError as e:
        return ToolResult(ok=False, error=e.message, code=e.code)
    except HTTPException as e:
        err = tool_error_from_http(e)
        return ToolResult(ok=False, error=err.message, code=err.code)
    except ValueError as e:
        return ToolResult(ok=False, error=str(e), code="validation")
