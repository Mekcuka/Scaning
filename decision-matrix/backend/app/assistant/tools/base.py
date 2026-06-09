"""Tool definition primitives."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel

from app.assistant.context import ToolContext
from app.models.enums import UserRole

ToolHandler = Callable[[ToolContext, BaseModel], Awaitable[Any]]


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    name: str
    description: str
    input_model: type[BaseModel]
    handler: ToolHandler
    mutating: bool = False
    categories: frozenset[str] = field(default_factory=frozenset)
    hide_from_roles: frozenset[UserRole] = field(default_factory=frozenset)

    def visible_for(self, role: UserRole) -> bool:
        if self.mutating and role == UserRole.viewer:
            return False
        if self.hide_from_roles and role in self.hide_from_roles:
            return False
        return True
