"""Map infrastructure assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import cast, or_, select, String

from app.api.v1.map_deps import get_infra_object
from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_MAP, cats
from app.geo.bbox_filter import infra_bbox_filter
from app.models import InfrastructureLayer, InfrastructureObject
from app.schemas import InfraObjectUpdate, LayerResponse
from app.models.enums import AccessLevel, WriteScope
from app.services.infra_update import update_infra_object_record
from app.services.project_access import resolve_project
from app.services.serializers import infra_to_response


class ProjectIdInput(BaseModel):
    project_id: UUID


class ListInfraObjectsInput(BaseModel):
    project_id: UUID
    subtype: str | None = None
    q: str | None = None
    bbox: str | None = Field(
        default=None,
        description="Bounding box as minLon,minLat,maxLon,maxLat",
    )
    visible_layers_only: bool = True


class UpdateInfraObjectInput(BaseModel):
    project_id: UUID
    object_id: UUID
    name: str | None = None
    subtype: str | None = None
    description: str | None = None


async def _list_infra_layers(ctx: ToolContext, args: ProjectIdInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    result = await ctx.db.execute(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == args.project_id)
        .order_by(InfrastructureLayer.sort_order, InfrastructureLayer.name)
    )
    return [
        LayerResponse(
            id=layer.id,
            project_id=layer.project_id,
            name=layer.name,
            layer_type=layer.layer_type,
            source_type=layer.source_type,
            is_visible=layer.is_visible,
            opacity=layer.opacity,
            sort_order=layer.sort_order,
            style_config=layer.style_config or {},
        ).model_dump(mode="json")
        for layer in result.scalars().all()
    ]


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


async def _update_infra_object(ctx: ToolContext, args: UpdateInfraObjectInput) -> dict:
    if not any([args.name, args.subtype, args.description]):
        raise ToolError("validation", "At least one of name, subtype, description is required")
    project = await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.write, write_scope=WriteScope.infra
    )
    obj = await get_infra_object(args.object_id, args.project_id, ctx.db)
    try:
        obj = await update_infra_object_record(
            ctx.db,
            project=project,
            project_id=args.project_id,
            user=ctx.user,
            obj=obj,
            data=InfraObjectUpdate(
                name=args.name,
                subtype=args.subtype,
                description=args.description,
            ),
        )
    except ValueError as e:
        raise ToolError("validation", str(e)) from e
    await ctx.db.commit()
    await ctx.db.refresh(obj)
    return infra_to_response(obj).model_dump(mode="json")


def register() -> None:
    register_tool(
        ToolDefinition(
            name="list_infra_layers",
            description="List infrastructure map layers for a project.",
            input_model=ProjectIdInput,
            handler=_list_infra_layers,
            categories=cats(CAT_MAP),
        )
    )
    register_tool(
        ToolDefinition(
            name="list_infra_objects",
            description="List infrastructure map objects with optional subtype, text search, and bbox filter.",
            input_model=ListInfraObjectsInput,
            handler=_list_infra_objects,
            categories=cats(CAT_MAP),
        )
    )
    register_tool(
        ToolDefinition(
            name="update_infra_object",
            description="Update infrastructure object metadata (name, subtype, description only — no geometry).",
            input_model=UpdateInfraObjectInput,
            handler=_update_infra_object,
            mutating=True,
            categories=cats(CAT_MAP),
        )
    )
