"""One-pager report assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_PROJECTS, cats
from app.models import OnePager, PointOfInterest
from app.models.enums import AccessLevel
from app.schemas import OnePagerResponse
from app.services.project_access import resolve_project


class ProjectIdInput(BaseModel):
    project_id: UUID


class OnePagerIdInput(BaseModel):
    project_id: UUID
    op_id: UUID


async def _enrich(ctx: ToolContext, op: OnePager) -> dict:
    poi = await ctx.db.get(PointOfInterest, op.poi_id)
    return OnePagerResponse(
        id=op.id,
        project_id=op.project_id,
        poi_id=op.poi_id,
        title=op.title,
        coordinates=op.coordinates,
        engineer_name=op.engineer_name,
        report_date=op.report_date,
        final_variant_data=op.final_variant_data or {},
        engineering_params=op.engineering_params or {},
        roadmap=op.roadmap or [],
        recommendation_text=op.recommendation_text,
        is_recommendation_edited=op.is_recommendation_edited,
        generation_status=op.generation_status,
        poi_name=poi.name if poi else None,
        created_at=op.created_at,
        updated_at=op.updated_at,
    ).model_dump(mode="json")


async def _list_one_pagers(ctx: ToolContext, args: ProjectIdInput) -> list[dict]:
    await resolve_project(args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read)
    rows = (
        await ctx.db.execute(
            select(OnePager)
            .where(OnePager.project_id == args.project_id)
            .order_by(OnePager.created_at.desc())
        )
    ).scalars().all()
    return [await _enrich(ctx, op) for op in rows]


async def _get_one_pager(ctx: ToolContext, args: OnePagerIdInput) -> dict:
    await resolve_project(args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read)
    op = await ctx.db.get(OnePager, args.op_id)
    if not op or op.project_id != args.project_id:
        raise ToolError("not_found", "One-pager not found")
    return await _enrich(ctx, op)


def register() -> None:
    register_tool(
        ToolDefinition(
            name="list_one_pagers",
            description="List management one-pager reports for a project.",
            input_model=ProjectIdInput,
            handler=_list_one_pagers,
            categories=cats(CAT_PROJECTS),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_one_pager",
            description="Get a single one-pager report by id.",
            input_model=OnePagerIdInput,
            handler=_get_one_pager,
            categories=cats(CAT_PROJECTS),
        )
    )
