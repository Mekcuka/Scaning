"""Sand logistics assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_FLOW, cats
from app.models.enums import AccessLevel, WriteScope
from app.schemas import SandLogisticsAnalyzeResponse
from app.services.project_access import resolve_project
from app.services.sand_logistics_store import get_sand_logistics_result


class SandLogisticsInput(BaseModel):
    project_id: UUID


async def _get_sand_logistics_result(ctx: ToolContext, args: SandLogisticsInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    stored = await get_sand_logistics_result(ctx.db, args.project_id)
    if stored is None:
        raise ToolError("not_found", "Sand logistics result not found")
    return SandLogisticsAnalyzeResponse.model_validate(stored).model_dump(mode="json")


def register() -> None:
    register_tool(
        ToolDefinition(
            name="get_sand_logistics_result",
            description="Get stored sand logistics analysis result for a project.",
            input_model=SandLogisticsInput,
            handler=_get_sand_logistics_result,
            categories=cats(CAT_FLOW),
        )
    )
