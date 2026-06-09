"""Flow schematic assistant tools."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_FLOW, cats
from app.models import PointOfInterest
from app.models.enums import AccessLevel, WriteScope
from app.schemas import EconomicFlowResponse, FlowSchematicResponse
from app.services.economic_flow_schematic import get_economic_flow_schematic
from app.services.flow_schematic_store import get_flow_schematic
from app.services.project_access import resolve_project


class GetFlowSchematicInput(BaseModel):
    project_id: UUID
    poi_id: UUID
    kind: Literal["technology", "economic"] = "technology"


async def _get_poi(ctx: ToolContext, project_id: UUID, poi_id: UUID) -> PointOfInterest:
    poi = await ctx.db.scalar(
        select(PointOfInterest).where(
            PointOfInterest.id == poi_id,
            PointOfInterest.project_id == project_id,
        )
    )
    if not poi:
        raise ToolError("not_found", "POI not found")
    return poi


async def _get_flow_schematic(ctx: ToolContext, args: GetFlowSchematicInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    poi = await _get_poi(ctx, args.project_id, args.poi_id)
    if args.kind == "economic":
        data = await get_economic_flow_schematic(ctx.db, args.project_id, poi)
        return EconomicFlowResponse(**data).model_dump(mode="json")
    data = await get_flow_schematic(ctx.db, args.project_id, poi)
    return FlowSchematicResponse(**data).model_dump(mode="json")


def register() -> None:
    register_tool(
        ToolDefinition(
            name="get_flow_schematic",
            description="Get technology or economic flow schematic (PFD) for a POI.",
            input_model=GetFlowSchematicInput,
            handler=_get_flow_schematic,
            categories=cats(CAT_FLOW),
        )
    )
