"""Admin assistant audit and LLM config API."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_csrf
from app.api.rbac import require_admin
from app.core.database import get_db
from app.models import User
from app.schemas import AssistantAuditLogListResponse
from app.services.admin_assistant.api_handlers import (
    handle_get_llm_config,
    handle_list_audit,
    handle_list_llm_models,
    handle_probe_llm,
    handle_reset_llm_config,
    handle_test_llm,
    handle_update_llm_config,
)
from app.services.admin_assistant.schemas import (
    AssistantLlmConfigDetailResponse,
    AssistantLlmConfigResponse,
    AssistantLlmConfigUpdate,
    AssistantLlmModelsResponse,
    AssistantLlmProbeResponse,
    AssistantLlmTestResponse,
)

admin_assistant_router = APIRouter(
    prefix="/admin/assistant",
    tags=["admin", "assistant"],
    dependencies=[Depends(verify_csrf)],
)


@admin_assistant_router.get("/audit", response_model=AssistantAuditLogListResponse)
async def list_assistant_audit(
    limit: int = Query(default=50, ge=1, le=200),
    tool_name: str | None = None,
    user_id: UUID | None = None,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await handle_list_audit(db, limit=limit, tool_name=tool_name, user_id=user_id)


@admin_assistant_router.get("/llm-config", response_model=AssistantLlmConfigDetailResponse)
async def get_assistant_llm_config(_: User = Depends(require_admin)):
    return await handle_get_llm_config()


@admin_assistant_router.post("/llm-config", response_model=AssistantLlmConfigResponse)
async def update_assistant_llm_config(
    body: AssistantLlmConfigUpdate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_llm_config(body, user, db)


@admin_assistant_router.delete("/llm-config", response_model=AssistantLlmConfigResponse)
async def reset_assistant_llm_config(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await handle_reset_llm_config(user, db)


@admin_assistant_router.post("/llm-probe", response_model=AssistantLlmProbeResponse)
async def probe_assistant_llm(_: User = Depends(require_admin)):
    return await handle_probe_llm()


@admin_assistant_router.post("/llm-test", response_model=AssistantLlmTestResponse)
async def test_assistant_llm(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await handle_test_llm(user, db)


@admin_assistant_router.get("/llm-models", response_model=AssistantLlmModelsResponse)
async def list_assistant_llm_models(_: User = Depends(require_admin)):
    return await handle_list_llm_models()
