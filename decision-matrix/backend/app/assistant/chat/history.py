"""Persist assistant chat sessions and messages (phase 8.2)."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assistant.chat.schemas import ChatMessage, ChatRequest, ChatResponse, ToolCallSummary
from app.core.config import settings
from app.models import AssistantChatMessage, AssistantChatSession, Project

logger = logging.getLogger(__name__)


def history_enabled() -> bool:
    return settings.ASSISTANT_CHAT_HISTORY_ENABLED


def _title_from_text(text: str) -> str:
    one_line = " ".join(text.strip().split())
    if len(one_line) <= 60:
        return one_line or "Новый чат"
    return one_line[:57] + "…"


async def get_user_session(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> AssistantChatSession:
    session = await db.get(AssistantChatSession, session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


async def _validated_project_id(
    db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID | None
) -> uuid.UUID | None:
    if project_id is None:
        return None
    exists = await db.scalar(
        select(Project.id).where(Project.id == project_id, Project.user_id == user_id)
    )
    return project_id if exists else None


async def create_session(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
    title: str | None = None,
) -> AssistantChatSession:
    session = AssistantChatSession(
        user_id=user_id,
        project_id=project_id,
        title=title or "Новый чат",
    )
    db.add(session)
    await db.flush()
    return session


async def list_sessions(
    db: AsyncSession, user_id: uuid.UUID, *, limit: int = 20
) -> list[dict]:
    msg_count = (
        select(func.count(AssistantChatMessage.id))
        .where(AssistantChatMessage.session_id == AssistantChatSession.id)
        .correlate(AssistantChatSession)
        .scalar_subquery()
    )
    result = await db.execute(
        select(AssistantChatSession, msg_count.label("message_count"))
        .where(AssistantChatSession.user_id == user_id)
        .order_by(AssistantChatSession.updated_at.desc())
        .limit(limit)
    )
    rows = []
    for session, message_count in result.all():
        rows.append(
            {
                "id": session.id,
                "title": session.title,
                "project_id": session.project_id,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "message_count": int(message_count or 0),
            }
        )
    return rows


async def list_session_messages(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> list[dict]:
    await get_user_session(db, session_id, user_id)
    result = await db.execute(
        select(AssistantChatMessage)
        .where(AssistantChatMessage.session_id == session_id)
        .order_by(AssistantChatMessage.seq.asc())
    )
    out: list[dict] = []
    for msg in result.scalars().all():
        tools = None
        if msg.tool_calls_json:
            try:
                tools = json.loads(msg.tool_calls_json)
            except json.JSONDecodeError:
                tools = None
        out.append(
            {
                "role": msg.role,
                "content": msg.content,
                "reasoning": msg.reasoning,
                "tool_calls": tools,
            }
        )
    return out


async def delete_session(db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID) -> None:
    session = await get_user_session(db, session_id, user_id)
    await db.delete(session)
    await db.flush()


async def _next_seq(db: AsyncSession, session_id: uuid.UUID) -> int:
    current = await db.scalar(
        select(func.max(AssistantChatMessage.seq)).where(AssistantChatMessage.session_id == session_id)
    )
    return int(current or 0) + 1


async def _append_message(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    role: str,
    content: str,
    reasoning: str | None = None,
    tool_calls: list[ToolCallSummary] | None = None,
) -> None:
    seq = await _next_seq(db, session_id)
    db.add(
        AssistantChatMessage(
            session_id=session_id,
            seq=seq,
            role=role,
            content=content,
            reasoning=reasoning,
            tool_calls_json=(
                json.dumps([t.model_dump() for t in tool_calls], ensure_ascii=False)
                if tool_calls
                else None
            ),
        )
    )


async def persist_turn(
    db: AsyncSession | None,
    user_id: uuid.UUID,
    request: ChatRequest,
    response: ChatResponse,
    *,
    session_id: uuid.UUID | None,
) -> uuid.UUID | None:
    if db is None or not history_enabled():
        return session_id

    project_id = await _validated_project_id(db, user_id, request.project_id)

    sid = session_id
    if sid is None:
        session = await create_session(db, user_id=user_id, project_id=project_id)
        sid = session.id
    else:
        session = await get_user_session(db, sid, user_id)

    if request.confirm_action_id:
        user_text = "Подтверждаю операцию"
    else:
        user_msgs = [m for m in request.messages if m.role == "user"]
        user_text = user_msgs[-1].content if user_msgs else ""

    if user_text:
        last = await db.scalar(
            select(AssistantChatMessage)
            .where(AssistantChatMessage.session_id == sid)
            .order_by(AssistantChatMessage.seq.desc())
            .limit(1)
        )
        if not last or last.role != "user" or last.content != user_text:
            await _append_message(db, session_id=sid, role="user", content=user_text)
            if session.title == "Новый чат" and not request.confirm_action_id:
                session.title = _title_from_text(user_text)

    assistant_content = response.message.content or ""
    if assistant_content or response.message.reasoning:
        await _append_message(
            db,
            session_id=sid,
            role="assistant",
            content=assistant_content,
            reasoning=response.message.reasoning,
            tool_calls=response.tool_calls_made or None,
        )

    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return sid


async def attach_session_to_response(
    db: AsyncSession | None,
    user_id: uuid.UUID,
    request: ChatRequest,
    response: ChatResponse,
) -> ChatResponse:
    if db is None:
        return response
    try:
        sid = await persist_turn(db, user_id, request, response, session_id=request.session_id)
    except Exception:
        logger.exception("assistant chat history persist failed")
        return response
    if sid:
        return response.model_copy(update={"session_id": sid})
    return response


async def with_persisted_done(
    db: AsyncSession | None,
    user_id: uuid.UUID,
    request: ChatRequest,
    response: ChatResponse,
) -> ChatResponse:
    return await attach_session_to_response(db, user_id, request, response)
