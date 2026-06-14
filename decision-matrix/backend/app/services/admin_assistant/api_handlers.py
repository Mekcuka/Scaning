"""HTTP orchestration for admin assistant BFF."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

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
from app.models import User
from app.schemas import AssistantAuditLogItem, AssistantAuditLogListResponse
from app.services.admin_assistant.schemas import (
    AssistantLlmConfigDetailResponse,
    AssistantLlmConfigResponse,
    AssistantLlmConfigUpdate,
    AssistantLlmEffectiveConfig,
    AssistantLlmEmbeddingEffectiveConfig,
    AssistantLlmEnvConfig,
    AssistantLlmModelsResponse,
    AssistantLlmProbeResponse,
    AssistantLlmProbeSlice,
    AssistantLlmTestResponse,
    AssistantLlmWikiRagStatus,
)


def api_key_source() -> str:
    override = llm_override_snapshot_masked()
    if "api_key" in override:
        return "override"
    if api_key_configured(settings.ASSISTANT_LLM_API_KEY):
        return "env"
    return "none"


def mask_applied(applied_raw: dict[str, str | None]) -> dict[str, str | None]:
    applied: dict[str, str | None] = {}
    for key, val in applied_raw.items():
        if key in ("api_key", "embedding_api_key") and val:
            applied[key] = mask_api_key(val)
        else:
            applied[key] = val
    return applied


def normalize_rag_mode(rag: dict[str, object]) -> str:
    if not rag.get("wiki_rag_enabled"):
        return "disabled"
    raw = str(rag.get("wiki_rag_mode") or "keyword")
    if raw == "keyword":
        return "tfidf"
    if raw.startswith("hybrid-"):
        return raw.removeprefix("hybrid-")
    return raw


async def record_llm_audit(
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


async def build_llm_config_detail() -> AssistantLlmConfigDetailResponse:
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
            api_key_source=api_key_source(),
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
            rag_mode=normalize_rag_mode(rag),
            embedding_model=embedding_model(),
        ),
        probe_detail=get_cached_probe_detail(),
    )


async def handle_list_audit(
    db: AsyncSession,
    *,
    limit: int = 50,
    tool_name: str | None = None,
    user_id: UUID | None = None,
) -> AssistantAuditLogListResponse:
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


async def handle_get_llm_config() -> AssistantLlmConfigDetailResponse:
    return await build_llm_config_detail()


async def handle_update_llm_config(
    body: AssistantLlmConfigUpdate,
    user: User,
    db: AsyncSession,
) -> AssistantLlmConfigResponse:
    payload = body.model_dump(exclude_unset=True)
    for int_key in ("max_tokens", "timeout_seconds"):
        if int_key in payload and payload[int_key] is not None:
            payload[int_key] = str(payload[int_key])
    applied_raw = apply_llm_override(payload)
    applied = mask_applied(applied_raw)
    await record_llm_audit(db, user=user, action="update", args=applied)
    return AssistantLlmConfigResponse(applied=applied)


async def handle_reset_llm_config(
    user: User,
    db: AsyncSession,
) -> AssistantLlmConfigResponse:
    clear_llm_override()
    await record_llm_audit(db, user=user, action="reset", args={})
    return AssistantLlmConfigResponse(applied={})


async def handle_probe_llm() -> AssistantLlmProbeResponse:
    result = await run_full_llm_probe()
    return AssistantLlmProbeResponse(
        chat=result["chat"],
        embeddings=AssistantLlmProbeSlice(**result["embeddings"]),
        rag_mode=str(result["rag_mode"]),
        provider_ready=bool(result["provider_ready"]),
    )


async def handle_test_llm(
    user: User,
    db: AsyncSession,
) -> AssistantLlmTestResponse:
    result = await run_llm_test_message()
    await record_llm_audit(
        db,
        user=user,
        action="test",
        args={"model": result.get("model")},
        ok=bool(result.get("ok")),
        code=str(result.get("error")) if result.get("error") else None,
    )
    return AssistantLlmTestResponse(**result)


async def handle_list_llm_models() -> AssistantLlmModelsResponse:
    models = await list_chat_models()
    return AssistantLlmModelsResponse(models=models)
