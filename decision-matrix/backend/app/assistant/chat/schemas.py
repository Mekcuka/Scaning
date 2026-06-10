"""Pydantic schemas for assistant chat API."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    reasoning: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    project_id: UUID | None = None
    project_name: str | None = None
    selected_poi_id: UUID | None = None
    selected_poi_name: str | None = None
    active_tab: str | None = None
    confirm_action_id: str | None = None
    route_path: str | None = None
    session_id: UUID | None = None


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
    answer_source: Literal["formatter", "llm", "tool_error"] | None = None
    session_id: UUID | None = None


class ChatSessionSummary(BaseModel):
    id: UUID
    title: str
    project_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ChatSessionCreateRequest(BaseModel):
    project_id: UUID | None = None
    title: str | None = Field(default=None, max_length=255)


class ChatSessionMessagesResponse(BaseModel):
    session_id: UUID
    messages: list[ChatMessage]


class AssistantStatusResponse(BaseModel):
    enabled: bool
    model: str | None = None
    provider_ready: bool = False
    base_url: str | None = None
    mcp_url: str | None = None
    mcp_token_ttl_minutes: int | None = None
    mcp_setup_hint_ru: str | None = None
    llm_override: dict[str, str] | None = None
    formatters_count: int | None = None
    formatter_tools: list[str] | None = None
    wiki_enabled: bool | None = None
    wiki_articles_count: int | None = None
    wiki_rag_enabled: bool | None = None
    wiki_rag_mode: str | None = None
    wiki_rag_embedding_ready: bool | None = None
    wiki_rag_chunks: int | None = None
    chat_history_enabled: bool | None = None
