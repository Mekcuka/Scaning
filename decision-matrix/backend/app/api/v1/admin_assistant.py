"""Admin assistant audit and LLM config API."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_csrf
from app.api.rbac import require_admin
from app.assistant.audit import list_audit_entries
from app.assistant.llm_override import apply_llm_override, clear_llm_override
from app.core.database import get_db
from app.models import User
from app.schemas import AssistantAuditLogItem, AssistantAuditLogListResponse


class AssistantLlmConfigUpdate(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None


class AssistantLlmConfigResponse(BaseModel):
    applied: dict[str, str | None] = Field(default_factory=dict)

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


@admin_assistant_router.post("/llm-config", response_model=AssistantLlmConfigResponse)
async def update_assistant_llm_config(
    body: AssistantLlmConfigUpdate,
    _: User = Depends(require_admin),
):
    applied = apply_llm_override(body.model_dump(exclude_unset=True))
    return AssistantLlmConfigResponse(applied=applied)


@admin_assistant_router.delete("/llm-config", response_model=AssistantLlmConfigResponse)
async def reset_assistant_llm_config(_: User = Depends(require_admin)):
    clear_llm_override()
    return AssistantLlmConfigResponse(applied={})
