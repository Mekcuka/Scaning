"""Map 3D custom model assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_MAP, cats
from app.models.enums import AccessLevel, WriteScope
from app.schemas import Map3dCustomModelResponse
from app.services.map3d_custom_models import (
    default_display_name,
    list_custom_models,
    normalize_assigned_subtypes,
)
from app.services.project_access import resolve_project


class ProjectIdInput(BaseModel):
    project_id: UUID


def _to_response(row) -> dict:
    return Map3dCustomModelResponse(
        id=row.id,
        project_id=row.project_id,
        filename=row.filename,
        display_name=(row.display_name or "").strip() or default_display_name(row.filename),
        target_height_m=float(row.target_height_m),
        file_size_bytes=int(row.file_size_bytes or 0),
        created_at=row.created_at,
        updated_at=row.updated_at,
        assigned_subtypes=normalize_assigned_subtypes(row.assigned_subtypes),
        usage_count=0,
    ).model_dump(mode="json")


async def _list_map3d_custom_models(ctx: ToolContext, args: ProjectIdInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    rows = await list_custom_models(ctx.db, args.project_id)
    return [_to_response(m) for m in rows]


def register() -> None:
    register_tool(
        ToolDefinition(
            name="list_map3d_custom_models",
            description="List custom GLB 3D models uploaded for a project (metadata only).",
            input_model=ProjectIdInput,
            handler=_list_map3d_custom_models,
            categories=cats(CAT_MAP),
        )
    )
