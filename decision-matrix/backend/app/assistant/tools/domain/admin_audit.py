"""Admin assistant audit log tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.assistant.audit import list_audit_entries
from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_ADMIN, cats
from app.models.enums import UserRole


class AdminListAssistantAuditInput(BaseModel):
    limit: int = Field(default=50, ge=1, le=200)
    tool_name: str | None = None
    user_id: UUID | None = None


_NON_ADMIN = frozenset({UserRole.analyst, UserRole.data_manager, UserRole.viewer})


async def _admin_list_assistant_audit(ctx: ToolContext, args: AdminListAssistantAuditInput) -> dict:
    rows = await list_audit_entries(
        ctx.db,
        limit=args.limit,
        tool_name=args.tool_name,
        user_id=args.user_id,
    )
    return {
        "items": [
            {
                "id": str(row.id),
                "user_id": str(row.user_id),
                "tool_name": row.tool_name,
                "args_hash": row.args_hash,
                "ok": row.ok,
                "code": row.code,
                "source": row.source,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
        "count": len(rows),
    }


def register() -> None:
    register_tool(
        ToolDefinition(
            name="admin_list_assistant_audit",
            description="List recent assistant tool executions (admin audit journal).",
            input_model=AdminListAssistantAuditInput,
            handler=_admin_list_assistant_audit,
            hide_from_roles=_NON_ADMIN,
            categories=cats(CAT_ADMIN),
        )
    )
