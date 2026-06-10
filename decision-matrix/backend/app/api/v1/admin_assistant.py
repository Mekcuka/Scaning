"""Admin assistant audit and LLM config API."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_csrf
from app.api.rbac import require_admin
from app.assistant.audit import list_audit_entries, record_tool_audit
from app.assistant.chat.ports.llm_port import default_llm_client
from app.assistant.knowledge import wiki_enabled
from app.assistant.knowledge.embeddings import embedding_model
from app.assistant.knowledge.rag import rag_status
from app.assistant.llm_override import (
    api_key_configured,
    apply_llm_override,
    clear_llm_override,
    embedding_uses_chat_config,
    get_effective_embedding_config,
    get_effective_llm_config,
    llm_override_snapshot_masked,
    mask_api_key,
)
from app.assistant.llm_probe import (
    get_cached_probe_detail,
    list_chat_models,
    probe_chat_completion,
    run_full_llm_probe,
    run_llm_test_message,
)
from app.assistant.schemas import ToolResult
from app.core.config import settings
from app.core.database import get_db
from app.models import User
from app.schemas import AssistantAuditLogItem, AssistantAuditLogListResponse


class AssistantLlmConfigUpdate(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None
    max_tokens: int | None = None
    timeout_seconds: int | None = None
    embedding_base_url: str | None = None
    embedding_api_key: str | None = None
    embedding_model: str | None = None


class AssistantLlmEffectiveConfig(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key_masked: str | None = None
    api_key_source: str = "none"
    max_tokens: int
    timeout_seconds: int


class AssistantLlmEmbeddingEffectiveConfig(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key_masked: str | None = None
    uses_chat_config: bool = True


class AssistantLlmEnvConfig(BaseModel):
    base_url: str | None = None
    model: str | None = None
    max_tokens: int
    timeout_seconds: int
    api_key_configured: bool
    embedding_base_url: str | None = None
    embedding_model: str | None = None
    embedding_api_key_configured: bool = False


class AssistantLlmProbeSlice(BaseModel):
    ok: bool = False
    http_status: int | None = None
    hint_ru: str = ""


class AssistantLlmWikiRagStatus(BaseModel):
    enabled: bool = False
    embedding_ready: bool | None = None
    rag_mode: str | None = None
    embedding_model: str | None = None


class AssistantLlmConfigDetailResponse(BaseModel):
    provider_ready: bool = False
    chat_enabled: bool = False
    effective: AssistantLlmEffectiveConfig
    embedding_effective: AssistantLlmEmbeddingEffectiveConfig
    env: AssistantLlmEnvConfig
    runtime_override: dict[str, str | None] = Field(default_factory=dict)
    wiki_rag: AssistantLlmWikiRagStatus = Field(default_factory=AssistantLlmWikiRagStatus)
    probe_detail: dict[str, object] | None = None


class AssistantLlmConfigResponse(BaseModel):
    applied: dict[str, str | None] = Field(default_factory=dict)


class AssistantLlmProbeResponse(BaseModel):
    chat: dict[str, object]
    embeddings: AssistantLlmProbeSlice
    rag_mode: str
    provider_ready: bool


class AssistantLlmTestResponse(BaseModel):
    ok: bool
    latency_ms: int | None = None
    model: str | None = None
    reply: str | None = None
    error: str | None = None


class AssistantLlmModelsResponse(BaseModel):
    models: list[str] = Field(default_factory=list)


admin_assistant_router = APIRouter(
    prefix="/admin/assistant",
    tags=["admin", "assistant"],
    dependencies=[Depends(verify_csrf)],
)


def _api_key_source() -> str:
    override = llm_override_snapshot_masked()
    if "api_key" in override:
        return "override"
    if api_key_configured(settings.ASSISTANT_LLM_API_KEY):
        return "env"
    return "none"


def _mask_applied(applied_raw: dict[str, str | None]) -> dict[str, str | None]:
    applied: dict[str, str | None] = {}
    for key, val in applied_raw.items():
        if key in ("api_key", "embedding_api_key") and val:
            applied[key] = mask_api_key(val)
        else:
            applied[key] = val
    return applied


def _normalize_rag_mode(rag: dict[str, object]) -> str:
    if not rag.get("wiki_rag_enabled"):
        return "disabled"
    raw = str(rag.get("wiki_rag_mode") or "keyword")
    if raw == "keyword":
        return "tfidf"
    if raw.startswith("hybrid-"):
        return raw.removeprefix("hybrid-")
    return raw


async def _record_llm_audit(
    db: AsyncSession,
    *,
    user: User,
    action: str,
    args: dict[str, object],
    ok: bool = True,
    code: str | None = None,
) -> None:
    await record_tool_audit(
        db,
        user_id=user.id,
        tool_name=f"admin_llm_config_{action}",
        args=args,
        result=ToolResult(ok=ok, code=code),
        source="mcp",
    )


async def _build_llm_config_detail() -> AssistantLlmConfigDetailResponse:
    cfg = get_effective_llm_config()
    emb = get_effective_embedding_config()
    model = cfg.model.strip() or None
    base_url = cfg.base_url.rstrip("/") or None
    rag = await rag_status() if wiki_enabled() else {}

    provider_ready = await default_llm_client.probe_provider()
    if provider_ready and cfg.model.strip():
        completion = await probe_chat_completion()
        provider_ready = completion["ok"]

    return AssistantLlmConfigDetailResponse(
        provider_ready=provider_ready,
        chat_enabled=settings.ASSISTANT_CHAT_ENABLED,
        effective=AssistantLlmEffectiveConfig(
            base_url=base_url,
            model=model,
            api_key_masked=mask_api_key(cfg.api_key),
            api_key_source=_api_key_source(),
            max_tokens=cfg.max_tokens,
            timeout_seconds=cfg.timeout_seconds,
        ),
        embedding_effective=AssistantLlmEmbeddingEffectiveConfig(
            base_url=emb.base_url.rstrip("/") or None,
            model=emb.model,
            api_key_masked=mask_api_key(emb.api_key) if emb.api_key.strip() else None,
            uses_chat_config=embedding_uses_chat_config(),
        ),
        env=AssistantLlmEnvConfig(
            base_url=settings.ASSISTANT_LLM_BASE_URL.rstrip("/") or None,
            model=settings.ASSISTANT_LLM_MODEL.strip() or None,
            max_tokens=settings.ASSISTANT_LLM_MAX_TOKENS,
            timeout_seconds=settings.ASSISTANT_LLM_TIMEOUT_SECONDS,
            api_key_configured=api_key_configured(settings.ASSISTANT_LLM_API_KEY),
            embedding_base_url=settings.ASSISTANT_WIKI_EMBEDDING_BASE_URL.rstrip("/") or None,
            embedding_model=settings.ASSISTANT_WIKI_EMBEDDING_MODEL.strip() or None,
            embedding_api_key_configured=api_key_configured(settings.ASSISTANT_WIKI_EMBEDDING_API_KEY),
        ),
        runtime_override=llm_override_snapshot_masked(),
        wiki_rag=AssistantLlmWikiRagStatus(
            enabled=bool(rag.get("wiki_rag_enabled")),
            embedding_ready=rag.get("wiki_rag_embedding_ready"),
            rag_mode=_normalize_rag_mode(rag),
            embedding_model=embedding_model(),
        ),
        probe_detail=get_cached_probe_detail(),
    )


@admin_assistant_router.get("/audit", response_model=AssistantAuditLogListResponse)
async def list_assistant_audit(
    limit: int = Query(default=50, ge=1, le=200),
    tool_name: str | None = None,
    user_id: UUID | None = None,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_audit_entries(db, limit=limit, tool_name=tool_name, user_id=user_id)
    return AssistantAuditLogListResponse(
        items=[
            AssistantAuditLogItem(
                id=row.id,
                user_id=row.user_id,
                tool_name=row.tool_name,
                args_hash=row.args_hash,
                ok=row.ok,
                code=row.code,
                source=row.source,
                created_at=row.created_at,
            )
            for row in rows
        ],
        count=len(rows),
    )


@admin_assistant_router.get("/llm-config", response_model=AssistantLlmConfigDetailResponse)
async def get_assistant_llm_config(_: User = Depends(require_admin)):
    return await _build_llm_config_detail()


@admin_assistant_router.post("/llm-config", response_model=AssistantLlmConfigResponse)
async def update_assistant_llm_config(
    body: AssistantLlmConfigUpdate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    payload = body.model_dump(exclude_unset=True)
    for int_key in ("max_tokens", "timeout_seconds"):
        if int_key in payload and payload[int_key] is not None:
            payload[int_key] = str(payload[int_key])
    applied_raw = apply_llm_override(payload)
    applied = _mask_applied(applied_raw)
    await _record_llm_audit(db, user=user, action="update", args=applied)
    return AssistantLlmConfigResponse(applied=applied)


@admin_assistant_router.delete("/llm-config", response_model=AssistantLlmConfigResponse)
async def reset_assistant_llm_config(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    clear_llm_override()
    await _record_llm_audit(db, user=user, action="reset", args={})
    return AssistantLlmConfigResponse(applied={})


@admin_assistant_router.post("/llm-probe", response_model=AssistantLlmProbeResponse)
async def probe_assistant_llm(_: User = Depends(require_admin)):
    result = await run_full_llm_probe()
    return AssistantLlmProbeResponse(
        chat=result["chat"],
        embeddings=AssistantLlmProbeSlice(**result["embeddings"]),
        rag_mode=str(result["rag_mode"]),
        provider_ready=bool(result["provider_ready"]),
    )


@admin_assistant_router.post("/llm-test", response_model=AssistantLlmTestResponse)
async def test_assistant_llm(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await run_llm_test_message()
    await _record_llm_audit(
        db,
        user=user,
        action="test",
        args={"model": result.get("model")},
        ok=bool(result.get("ok")),
        code=str(result.get("error")) if result.get("error") else None,
    )
    return AssistantLlmTestResponse(**result)


@admin_assistant_router.get("/llm-models", response_model=AssistantLlmModelsResponse)
async def list_assistant_llm_models(_: User = Depends(require_admin)):
    models = await list_chat_models()
    return AssistantLlmModelsResponse(models=models)
