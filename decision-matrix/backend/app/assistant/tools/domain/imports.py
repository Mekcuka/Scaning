"""Import logs and connections assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import select

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_PROJECTS, cats
from app.models import ImportConnection, ImportLog
from app.models.enums import AccessLevel, WriteScope
from app.schemas import ImportConnectionResponse, ImportLogResponse
from app.services.project_access import resolve_project


class ListImportLogsInput(BaseModel):
    project_id: UUID | None = None


class ImportLogIdInput(BaseModel):
    log_id: UUID


class ProjectIdInput(BaseModel):
    project_id: UUID


def _conn_response(c: ImportConnection) -> dict:
    return ImportConnectionResponse(
        id=c.id,
        project_id=c.project_id,
        name=c.name,
        api_url=c.api_url,
        auth_type=c.auth_type,
        registry_type=c.registry_type,
        created_at=c.created_at.isoformat() if c.created_at else "",
    ).model_dump(mode="json")


async def _list_import_logs(ctx: ToolContext, args: ListImportLogsInput) -> list[dict]:
    q = select(ImportLog).where(ImportLog.user_id == ctx.user.id)
    if args.project_id is not None:
        await resolve_project(
            args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
        )
        q = q.where(ImportLog.project_id == args.project_id)
    result = await ctx.db.execute(q.order_by(ImportLog.created_at.desc()).limit(20))
    return [
        ImportLogResponse.model_validate(log).model_dump(mode="json")
        for log in result.scalars().all()
    ]


async def _get_import_log(ctx: ToolContext, args: ImportLogIdInput) -> dict:
    log = await ctx.db.get(ImportLog, args.log_id)
    if not log or log.user_id != ctx.user.id:
        raise ToolError("not_found", "Import log not found")
    return ImportLogResponse.model_validate(log).model_dump(mode="json")


async def _list_import_connections(ctx: ToolContext, args: ProjectIdInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    rows = (
        await ctx.db.execute(
            select(ImportConnection).where(
                ImportConnection.project_id == args.project_id,
                ImportConnection.user_id == ctx.user.id,
            )
        )
    ).scalars().all()
    return [_conn_response(c) for c in rows]


def register() -> None:
    register_tool(
        ToolDefinition(
            name="list_import_logs",
            description="List recent file import logs for the current user (optional project filter).",
            input_model=ListImportLogsInput,
            handler=_list_import_logs,
            categories=cats(CAT_PROJECTS),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_import_log",
            description="Get a single import log by id (owner only).",
            input_model=ImportLogIdInput,
            handler=_get_import_log,
            categories=cats(CAT_PROJECTS),
        )
    )
    register_tool(
        ToolDefinition(
            name="list_import_connections",
            description="List corporate API import connections configured for a project.",
            input_model=ProjectIdInput,
            handler=_list_import_connections,
            categories=cats(CAT_PROJECTS),
        )
    )
