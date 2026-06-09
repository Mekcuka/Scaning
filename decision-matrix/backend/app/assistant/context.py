"""Execution context for assistant tools."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

ToolEnv = Literal["development", "staging", "production", "test"]
ToolSource = Literal["chat", "mcp", "confirm"]


@dataclass(frozen=True, slots=True)
class ToolContext:
    user: User
    db: AsyncSession
    env: ToolEnv = "development"
    tool_source: ToolSource = "chat"
