"""Execution context for assistant tools."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

ToolEnv = Literal["development", "staging", "production", "test"]


@dataclass(frozen=True, slots=True)
class ToolContext:
    user: User
    db: AsyncSession
    env: ToolEnv = "development"
