"""Shared schemas for assistant tool registry."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ToolMeta(BaseModel):
    name: str
    description: str
    mutating: bool = False
    input_schema: dict[str, Any] = Field(default_factory=dict)


class ToolResult(BaseModel):
    ok: bool = True
    data: Any = None
    error: str | None = None
    code: str | None = None
