"""Pydantic schemas for assistant chat API."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    project_id: UUID | None = None
    project_name: str | None = None
    selected_poi_id: UUID | None = None
    active_tab: str | None = None
    confirm_action_id: str | None = None
    route_path: str | None = None


class ToolCallSummary(BaseModel):
    name: str
    ok: bool
    code: str | None = None


class PendingAction(BaseModel):
    action_id: str
    tool: str
    arguments: dict[str, Any]
    description: str


class ChatResponse(BaseModel):
    message: ChatMessage
    tool_calls_made: list[ToolCallSummary] = Field(default_factory=list)
    pending_action: PendingAction | None = None


class AssistantStatusResponse(BaseModel):
    enabled: bool
    model: str | None = None
    provider_ready: bool = False
    base_url: str | None = None
    mcp_url: str | None = None
    mcp_token_ttl_minutes: int | None = None
    mcp_setup_hint_ru: str | None = None
    llm_override: dict[str, str] | None = None
