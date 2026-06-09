"""Assistant chat API."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.assistant.chat.errors import ChatError
from app.assistant.chat.llm_client import probe_provider
from app.assistant.chat.orchestrator import run_chat, run_chat_stream
from app.assistant.chat.schemas import AssistantStatusResponse, ChatRequest, ChatResponse
from app.assistant.chat.sse import sse_response
from app.assistant.llm_override import apply_llm_override, get_effective_llm_config, llm_override_snapshot
from app.assistant.rate_limit import assistant_rate_limit_key, chat_rate_limit_value
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
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
    if not settings.ASSISTANT_CHAT_ENABLED:
        return AssistantStatusResponse(enabled=False, provider_ready=False)
    cfg = get_effective_llm_config()
    ready = await probe_provider()
    model = cfg.model.strip() or None
    return AssistantStatusResponse(
        enabled=True,
        model=model,
        provider_ready=ready,
        base_url=cfg.base_url.rstrip("/") or None,
        mcp_url=_mcp_public_url(),
        mcp_token_ttl_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        mcp_setup_hint_ru=_MCP_SETUP_HINT_RU if settings.ASSISTANT_MCP_ENABLED else None,
        llm_override=llm_override_snapshot() or None,
    )


@assistant_router.post("/chat", response_model=ChatResponse)
@limiter.limit(chat_rate_limit_value, key_func=assistant_rate_limit_key)
async def assistant_chat(
    request: Request,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
@limiter.limit(chat_rate_limit_value, key_func=assistant_rate_limit_key)
async def assistant_chat_stream(
    request: Request,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    _ensure_chat_enabled()
    try:
        return await sse_response(run_chat_stream(user, db, body))
    except ChatError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        ) from e
