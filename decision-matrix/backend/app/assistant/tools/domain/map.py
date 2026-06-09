"""Map infrastructure assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import cast, or_, select, String

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.geo.bbox_filter import infra_bbox_filter
from app.models import InfrastructureLayer, InfrastructureObject
from app.models.enums import AccessLevel, WriteScope
from app.services.project_access import resolve_project
from app.services.serializers import infra_to_response


class ListInfraObjectsInput(BaseModel):
    project_id: UUID
    subtype: str | None = None
    q: str | None = None
    bbox: str | None = Field(
        default=None,
        description="Bounding box as minLon,minLat,maxLon,maxLat",
    )
    visible_layers_only: bool = True


async def _list_infra_objects(ctx: ToolContext, args: ListInfraObjectsInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    qry = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == args.project_id)
    )
    if args.visible_layers_only:
        qry = qry.where(InfrastructureLayer.is_visible.is_(True))
    if args.subtype:
        qry = qry.where(InfrastructureObject.subtype == args.subtype)
    if args.q:
        qry = qry.where(
            or_(
                InfrastructureObject.name.ilike(f"%{args.q}%"),
                cast(InfrastructureObject.properties, String).ilike(f"%{args.q}%"),
            )
        )
    if args.bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x) for x in args.bbox.split(",")]
            qry = qry.where(infra_bbox_filter(min_lon, min_lat, max_lon, max_lat))
        except ValueError as e:
            raise ToolError("validation", "Invalid bbox format") from e
    result = await ctx.db.execute(qry)
    return [infra_to_response(obj).model_dump(mode="json") for obj in result.scalars().all()]


def register() -> None:
    register_tool(
        ToolDefinition(
            name="list_infra_objects",
            description="List infrastructure map objects with optional subtype, text search, and bbox filter.",
            input_model=ListInfraObjectsInput,
            handler=_list_infra_objects,
        )
    )
