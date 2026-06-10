"""Assistant chat API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.assistant.chat.errors import ChatError
from app.assistant.chat.ports.llm_port import default_llm_client
from app.assistant.chat.orchestrator import run_chat, run_chat_stream
from app.assistant.chat.history import (
    create_session,
    delete_session,
    history_enabled,
    list_session_messages,
    list_sessions,
)
from app.assistant.chat.schemas import (
    AssistantStatusResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionCreateRequest,
    ChatSessionMessagesResponse,
    ChatSessionSummary,
    ChatMessage,
)
from app.assistant.chat.sse import sse_response
from app.assistant.llm_override import apply_llm_override, get_effective_llm_config, llm_override_snapshot
from app.assistant.rate_limit import enforce_chat_rate_limit
from app.core.config import settings
from app.core.database import get_db
from app.models import User
from sqlalchemy.ext.asyncio import AsyncSession

assistant_router = APIRouter(prefix="/assistant", tags=["assistant"])

_MCP_SETUP_HINT_RU = (
    "Для Cursor: выполните scripts/get-atlas-grid-token.ps1 из корня репозитория, "
    "затем Settings → Tools & MCP → Reload. URL MCP должен заканчиваться на / "
    "(например /api/v1/mcp/). Токен живёт ~60 минут."
)


def _ensure_chat_enabled() -> None:
    if not settings.ASSISTANT_CHAT_ENABLED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assistant chat is disabled")


def _mcp_public_url() -> str | None:
    if not settings.ASSISTANT_MCP_ENABLED:
        return None
    return settings.ASSISTANT_MCP_PATH.rstrip("/") + "/"


@assistant_router.get("/status", response_model=AssistantStatusResponse)
async def assistant_status() -> AssistantStatusResponse:
    from app.assistant.chat.formatters.registry import FORMATTER_SPECS, covered_tool_names
    from app.assistant.knowledge import article_count, wiki_enabled
    from app.assistant.knowledge.rag import rag_status

    if not settings.ASSISTANT_CHAT_ENABLED:
        return AssistantStatusResponse(enabled=False, provider_ready=False)
    cfg = get_effective_llm_config()
    ready = await default_llm_client.probe_provider()
    model = cfg.model.strip() or None
    rag = await rag_status() if wiki_enabled() else {}
    return AssistantStatusResponse(
        enabled=True,
        model=model,
        provider_ready=ready,
        base_url=cfg.base_url.rstrip("/") or None,
        mcp_url=_mcp_public_url(),
        mcp_token_ttl_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        mcp_setup_hint_ru=_MCP_SETUP_HINT_RU if settings.ASSISTANT_MCP_ENABLED else None,
        llm_override=llm_override_snapshot() or None,
        formatters_count=len(FORMATTER_SPECS),
        formatter_tools=covered_tool_names(),
        wiki_enabled=wiki_enabled(),
        wiki_articles_count=article_count() if wiki_enabled() else 0,
        wiki_rag_enabled=rag.get("wiki_rag_enabled"),
        wiki_rag_mode=rag.get("wiki_rag_mode"),
        wiki_rag_embedding_ready=rag.get("wiki_rag_embedding_ready"),
        wiki_rag_chunks=rag.get("wiki_rag_chunks"),
        chat_history_enabled=history_enabled(),
    )


@assistant_router.get("/sessions", response_model=list[ChatSessionSummary])
async def list_chat_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatSessionSummary]:
    _ensure_chat_enabled()
    if not history_enabled():
        return []
    rows = await list_sessions(db, user.id)
    return [ChatSessionSummary.model_validate(row) for row in rows]


@assistant_router.post("/sessions", response_model=ChatSessionSummary, status_code=201)
async def create_chat_session(
    body: ChatSessionCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionSummary:
    _ensure_chat_enabled()
    if not history_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat history is disabled")
    session = await create_session(
        db, user_id=user.id, project_id=body.project_id, title=body.title
    )
    await db.commit()
    await db.refresh(session)
    return ChatSessionSummary(
        id=session.id,
        title=session.title,
        project_id=session.project_id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=0,
    )


@assistant_router.get("/sessions/{session_id}/messages", response_model=ChatSessionMessagesResponse)
async def get_chat_session_messages(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionMessagesResponse:
    _ensure_chat_enabled()
    if not history_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat history is disabled")
    raw = await list_session_messages(db, session_id, user.id)
    messages: list[ChatMessage] = []
    for row in raw:
        messages.append(
            ChatMessage(
                role=row["role"],
                content=row["content"],
                reasoning=row.get("reasoning"),
            )
        )
    return ChatSessionMessagesResponse(session_id=session_id, messages=messages)


@assistant_router.delete("/sessions/{session_id}", status_code=204)
async def remove_chat_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    _ensure_chat_enabled()
    if not history_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat history is disabled")
    await delete_session(db, session_id, user.id)
    await db.commit()


@assistant_router.post("/chat", response_model=ChatResponse)
async def assistant_chat(
    request: Request,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(enforce_chat_rate_limit),
) -> ChatResponse:
    _ensure_chat_enabled()
    try:
        return await run_chat(user, db, body)
    except ChatError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        ) from e


@assistant_router.post("/chat/stream")
async def assistant_chat_stream(
    request: Request,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(enforce_chat_rate_limit),
) -> StreamingResponse:
    _ensure_chat_enabled()
    try:
        return await sse_response(run_chat_stream(user, db, body))
    except ChatError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        ) from e
