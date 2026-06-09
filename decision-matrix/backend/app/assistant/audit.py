"""Assistant tool execution audit log."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assistant.schemas import ToolResult
from app.models import AssistantAuditLog

ToolSource = Literal["chat", "mcp", "confirm"]


def hash_tool_args(args: dict[str, Any]) -> str:
    canonical = json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def record_tool_audit(
    db: AsyncSession,
    *,
    user_id: UUID,
    tool_name: str,
    args: dict[str, Any],
    result: ToolResult,
    source: ToolSource,
) -> None:
    entry = AssistantAuditLog(
        user_id=user_id,
        tool_name=tool_name,
        args_hash=hash_tool_args(args),
        ok=result.ok,
        code=result.code,
        source=source,
    )
    db.add(entry)
    try:
        await db.commit()
    except Exception:
        await db.rollback()


async def list_audit_entries(
    db: AsyncSession,
    *,
    limit: int = 50,
    tool_name: str | None = None,
    user_id: UUID | None = None,
) -> list[AssistantAuditLog]:
    q = select(AssistantAuditLog).order_by(AssistantAuditLog.created_at.desc()).limit(limit)
    if tool_name:
        q = q.where(AssistantAuditLog.tool_name == tool_name)
    if user_id:
        q = q.where(AssistantAuditLog.user_id == user_id)
    result = await db.execute(q)
    return list(result.scalars().all())
